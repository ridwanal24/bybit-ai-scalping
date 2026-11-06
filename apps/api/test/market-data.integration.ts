import 'reflect-metadata';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { ResearchConfigurationsService } from '../src/research-configurations/configurations.service.js';
import { MarketDataService } from '../src/market-data/market-data.service.js';
import {
  BybitDataError,
  BybitPublicClient,
} from '../src/market-data/bybit-public.client.js';
import { checkpointSchema } from '../src/market-data/state.js';
import {
  fixtureTransport,
  marketTestConfiguration,
  MARKET_START,
} from './market-fixtures.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const testUrl = process.env.FOUNDATION_TEST_DATABASE_URL;
if (!testUrl || testUrl !== process.env.DATABASE_URL)
  throw new Error('Dedicated test database required');
const target = new URL(testUrl);
if (
  target.hostname !== '127.0.0.1' ||
  target.port !== '55433' ||
  !/^\/bybit_test_[a-z0-9_]+$/.test(target.pathname)
)
  throw new Error('Refusing market tests on a non-test DB');

describe('market data PostgreSQL/HTTP/resume/export integration', () => {
  let app: INestApplication,
    service: MarketDataService,
    db: DatabaseService,
    configurations: ResearchConfigurationsService;
  const fixture = fixtureTransport();
  let snapshotId: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(BybitPublicClient)
      .useValue(fixture.client)
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    service = app.get(MarketDataService);
    db = app.get(DatabaseService);
    configurations = app.get(ResearchConfigurationsService);
    const draft = await configurations.create(
      'Market integration',
      marketTestConfiguration(),
    );
    snapshotId = (await configurations.snapshot(draft.id, 1)).id;
  });
  beforeEach(() => {
    Object.assign(fixture.controls, {
      pageRows: 2,
      fundingIntervalMs: 28800000,
      priceShift: 0,
      omit: new Set(),
      duplicates: false,
      conflict: false,
      ascending: false,
      incomplete: false,
      invalid: false,
      nonProgress: false,
      failures: 0,
      forbidden: false,
      hold: null,
      holdOnce: false,
      serverMs: Date.UTC(2026, 0, 10),
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  async function create(extra: Record<string, unknown> = {}) {
    return service.create({
      configurationSnapshotId: snapshotId,
      startMs: MARKET_START,
      endMs: MARKET_START + 360000,
      ...extra,
    });
  }

  it('collects, reads ascending and exports immutable fixtures consumable in Python', async () => {
    const response = await request(app.getHttpServer())
      .post('/market-data/downloads')
      .send({
        configurationSnapshotId: snapshotId,
        startMs: MARKET_START,
        endMs: MARKET_START + 360000,
      })
      .expect(201);
    const created = response.body as {
      download_id: string;
      dataset_id: string;
    };
    expect(await service.quality(created.dataset_id)).toMatchObject({
      final: false,
    });
    await request(app.getHttpServer())
      .get(`/market-data/datasets/${created.dataset_id}/candles?stream=last:1m`)
      .expect(409);
    expect((await service.run(created.download_id)).status).toBe('COMPLETED');
    const dataset = await service.getDataset(created.dataset_id);
    expect(dataset.status).toBe('READY');
    expect(dataset.fingerprint).toHaveLength(64);
    const rows = await request(app.getHttpServer())
      .get(`/market-data/datasets/${dataset.id}/candles?stream=last:1m&limit=2`)
      .expect(200);
    expect(
      rows.body.items.map((c: { open_time_ms: number }) => c.open_time_ms),
    ).toEqual([MARKET_START, MARKET_START + 60000]);
    const next = await request(app.getHttpServer())
      .get(
        `/market-data/datasets/${dataset.id}/candles?stream=last:1m&afterMs=${rows.body.next_after_ms}&limit=10`,
      )
      .expect(200);
    expect(next.body.items).toHaveLength(4);
    const funding = await service.funding(dataset.id, 100, null);
    expect(funding.items).toHaveLength(1);
    const exported = await service.exportDataset(
      dataset.id,
      path.join(root, '.runtime', 'test-exports'),
    );
    const check = spawnSync(
      path.join(root, 'services/quant/.venv/Scripts/python.exe'),
      [
        path.join(root, 'services/quant/tests/check_dataset_export.py'),
        exported.directory,
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    expect(check.status, check.stderr).toBe(0);
    expect(JSON.parse(check.stdout).status).toBe('passed');
    const repeated = await service.exportDataset(
      dataset.id,
      path.join(root, '.runtime', 'test-exports'),
    );
    expect(repeated.files).toEqual(exported.files);
    await request(app.getHttpServer())
      .get(`/market-data/downloads/${created.download_id}`)
      .expect(200)
      .then((r) => expect(r.body.leaseToken).toBeUndefined());
    await request(app.getHttpServer())
      .get('/market-data/datasets?limit=1')
      .expect(200);
    await request(app.getHttpServer())
      .get(`/market-data/datasets/${dataset.id}`)
      .expect(200);
  });

  it('resumes page-budget checkpoints to the same fingerprint as an uninterrupted run', async () => {
    const first = await create();
    expect((await service.run(first.download_id, { maxPages: 1 })).status).toBe(
      'PAUSED',
    );
    const before = await service.download(first.download_id);
    const cutoff = checkpointSchema.parse(before.checkpoint).cutoff_ms;
    fixture.controls.serverMs += 86400000;
    await service.run(first.download_id);
    const after = await service.download(first.download_id);
    expect(checkpointSchema.parse(after.checkpoint).cutoff_ms).toBe(cutoff);
    const second = await create();
    await service.run(second.download_id);
    expect((await service.getDataset(first.dataset_id)).fingerprint).toBe(
      (await service.getDataset(second.dataset_id)).fingerprint,
    );
    expect(checkpointSchema.parse(after.checkpoint).metrics.resumes).toBe(1);
  });

  it('deduplicates identical and out-of-order data without changing content hash', async () => {
    const baseline = await create();
    await service.run(baseline.download_id);
    fixture.controls.duplicates = true;
    fixture.controls.ascending = true;
    const duplicated = await create();
    await service.run(duplicated.download_id);
    const q = await service.quality(duplicated.dataset_id);
    expect(q).toMatchObject({
      candles_usable: true,
      counters: {
        duplicates: expect.any(Number),
        out_of_order: expect.any(Number),
      },
    });
    const cp = checkpointSchema.parse(
      (await service.download(duplicated.download_id)).checkpoint,
    );
    expect(cp.metrics.duplicates).toBeGreaterThan(0);
    expect(cp.metrics.out_of_order).toBeGreaterThan(0);
    expect((await service.getDataset(duplicated.dataset_id)).fingerprint).toBe(
      (await service.getDataset(baseline.dataset_id)).fingerprint,
    );
    expect(
      await db.client.marketDatasetCandle.count({
        where: { datasetId: duplicated.dataset_id },
      }),
    ).toBe(6);
  });

  it('keeps leading/internal/trailing gaps explicit and never fills them', async () => {
    fixture.controls.omit = new Set([
      MARKET_START,
      MARKET_START + 120000,
      MARKET_START + 300000,
    ]);
    const created = await create();
    await service.run(created.download_id);
    expect((await service.getDataset(created.dataset_id)).status).toBe(
      'QUALITY_FAILED',
    );
    expect(await service.quality(created.dataset_id)).toMatchObject({
      candles_usable: false,
      streams: [{ count: 3, expected: 6, missing: 3 }],
    });
    expect(
      await db.client.marketDatasetCandle.count({
        where: { datasetId: created.dataset_id },
      }),
    ).toBe(3);
  });

  it('flags invalid rows and conflicting revisions without selecting a clean winner', async () => {
    fixture.controls.conflict = true;
    const conflict = await create();
    await service.run(conflict.download_id);
    expect((await service.getDataset(conflict.dataset_id)).status).toBe(
      'QUALITY_FAILED',
    );
    expect(
      checkpointSchema.parse(
        (await service.download(conflict.download_id)).checkpoint,
      ).metrics.conflicts,
    ).toBeGreaterThan(0);
    fixture.controls.conflict = false;
    fixture.controls.invalid = true;
    const invalid = await create();
    await service.run(invalid.download_id);
    expect((await service.getDataset(invalid.dataset_id)).status).toBe(
      'QUALITY_FAILED',
    );
    expect(
      checkpointSchema.parse(
        (await service.download(invalid.download_id)).checkpoint,
      ).metrics.invalid,
    ).toBeGreaterThan(0);
  });

  it('excludes incomplete candles with a frozen server cutoff and marks clipping', async () => {
    fixture.controls.serverMs = MARKET_START + 240000;
    fixture.controls.incomplete = true;
    const created = await create();
    await service.run(created.download_id);
    const rows = await service.candles(
      created.dataset_id,
      'last:1m',
      100,
      null,
    );
    expect(rows.items).toHaveLength(3);
    expect(await service.quality(created.dataset_id)).toMatchObject({
      requested_range_clipped: true,
      safety_delay_ms: 2000,
    });
    expect(
      checkpointSchema.parse(
        (await service.download(created.download_id)).checkpoint,
      ).metrics.incomplete,
    ).toBeGreaterThan(0);
  });

  it('preserves old dataset and revision content when upstream values change', async () => {
    const old = await create();
    await service.run(old.download_id);
    const original = await service.getDataset(old.dataset_id);
    fixture.controls.priceShift = 10;
    const revised = await create();
    await service.run(revised.download_id);
    expect((await service.getDataset(revised.dataset_id)).fingerprint).not.toBe(
      original.fingerprint,
    );
    expect((await service.getDataset(old.dataset_id)).fingerprint).toBe(
      original.fingerprint,
    );
    const oldRows = await service.candles(old.dataset_id, 'last:1m', 10, null);
    expect(oldRows.items[0]).toMatchObject({ open: '100' });
  });

  it('prevents revision mutation and final dataset/membership writes at the database', async () => {
    const created = await create();
    await service.run(created.download_id);
    const member = await db.client.marketDatasetCandle.findFirstOrThrow({
      where: { datasetId: created.dataset_id },
    });
    await expect(
      db.client
        .$executeRaw`UPDATE candle_revisions SET open=1 WHERE id=${member.candleId}::uuid`,
    ).rejects.toThrow();
    await expect(
      db.client
        .$executeRaw`DELETE FROM candle_revisions WHERE id=${member.candleId}::uuid`,
    ).rejects.toThrow();
    await expect(
      db.client.$executeRaw`TRUNCATE dataset_candles`,
    ).rejects.toThrow();
    await expect(
      db.client.marketDataset.update({
        where: { id: created.dataset_id },
        data: { fingerprint: '0'.repeat(64) },
      }),
    ).rejects.toThrow();
    await expect(
      db.client.marketDatasetCandle.create({
        data: {
          datasetId: created.dataset_id,
          stream: 'last:1m',
          openTime: BigInt(MARKET_START + 999 * 60000),
          candleId: member.candleId,
        },
      }),
    ).rejects.toThrow();
    await expect(
      db.client.marketDatasetCandle.delete({
        where: {
          datasetId_stream_openTime: {
            datasetId: member.datasetId,
            stream: member.stream,
            openTime: member.openTime,
          },
        },
      }),
    ).rejects.toThrow();
  });

  it('pauses transient failures without changing cursor, then resumes', async () => {
    fixture.controls.failures = 4;
    const created = await create();
    await expect(service.run(created.download_id)).rejects.toBeInstanceOf(
      BybitDataError,
    );
    const paused = await service.download(created.download_id);
    const cp = checkpointSchema.parse(paused.checkpoint);
    expect(paused.status).toBe('PAUSED');
    expect(cp.metrics.pages).toBe(0);
    expect(cp.metrics.retries).toBe(3);
    expect(cp.streams[0]!.cursor_ms).toBe(MARKET_START + 360000 - 1);
    await service.run(created.download_id);
    expect((await service.getDataset(created.dataset_id)).status).toBe('READY');
  });

  it('persists final-attempt rate cooldown and blocks a new worker before another request', async () => {
    let calls = 0;
    const client = new BybitPublicClient({
      source: 'fixture',
      minIntervalMs: 0,
      sleep: async () => {},
      random: () => 0,
      fetcher: async () => {
        calls++;
        return new Response('', {
          status: 429,
          headers: calls === 4 ? { 'retry-after': '600' } : {},
        });
      },
    });
    const worker = new MarketDataService(db, configurations, client);
    const created = await create();
    const before = Date.now();
    await expect(worker.run(created.download_id)).rejects.toMatchObject({
      resumable: true,
    });
    const paused = await service.download(created.download_id);
    expect(paused.status).toBe('PAUSED');
    expect(paused.blocked_until?.getTime()).toBeGreaterThanOrEqual(
      before + 600000,
    );
    expect(checkpointSchema.parse(paused.checkpoint).metrics.pages).toBe(0);
    const restarted = new MarketDataService(db, configurations, client);
    await expect(restarted.run(created.download_id)).rejects.toMatchObject({
      response: { code: 'download_cooldown' },
    });
    expect(calls).toBe(4);
  });

  it('records access cooldown and non-progress errors without silently ending history', async () => {
    fixture.controls.forbidden = true;
    const forbidden = await create();
    await expect(service.run(forbidden.download_id)).rejects.toMatchObject({
      code: 'public_access_forbidden',
    });
    expect(
      (await service.download(forbidden.download_id)).blocked_until?.getTime(),
    ).toBeGreaterThan(Date.now());
    await expect(service.run(forbidden.download_id)).rejects.toMatchObject({
      response: { code: 'download_cooldown' },
    });
    fixture.controls.forbidden = false;
    fixture.controls.nonProgress = true;
    const stalled = await create();
    await expect(service.run(stalled.download_id)).rejects.toMatchObject({
      code: 'non_progressing_or_invalid_page',
    });
    expect((await service.getDataset(stalled.dataset_id)).status).toBe(
      'BUILDING',
    );
    expect((await service.download(stalled.download_id)).status).toBe('FAILED');
  });

  it('rejects a second worker and prevents writes by a revoked lease owner', async () => {
    let unblock!: () => void, arrived!: () => void;
    const gate = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const held = new Promise<void>((resolve) => {
      arrived = resolve;
    });
    fixture.controls.hold = async () => {
      arrived();
      await gate;
    };
    const first = await create(),
      second = await create();
    const running = service.run(first.download_id);
    const result = running.catch((error: unknown) => error);
    await held;
    await expect(service.run(second.download_id)).rejects.toMatchObject({
      response: { code: 'market_worker_busy' },
    });
    await db.client.marketDataDownload.update({
      where: { id: first.download_id },
      data: { status: 'PAUSED', leaseToken: null, leaseExpires: null },
    });
    unblock();
    await expect(result).resolves.toMatchObject({
      response: { code: 'download_lease_lost' },
    });
    expect(
      await db.client.marketDatasetCandle.count({
        where: { datasetId: first.dataset_id },
      }),
    ).toBe(0);
    fixture.controls.hold = null;
    await service.run(first.download_id);
    expect((await service.getDataset(first.dataset_id)).status).toBe('READY');
  });

  it('takes over an expired worker lease and resumes a sealed finalization without refetching', async () => {
    const created = await create();
    await service.run(created.download_id, { maxPages: 1 });
    await db.client.marketDataDownload.update({
      where: { id: created.download_id },
      data: {
        status: 'RUNNING',
        leaseToken: randomUUID(),
        leaseExpires: new Date(Date.now() - 1000),
      },
    });
    type Finalizer = { finalize(...args: unknown[]): Promise<void> };
    const spy = vi
      .spyOn(service as unknown as Finalizer, 'finalize')
      .mockRejectedValueOnce(
        new BybitDataError('simulated_finalizer_crash', true),
      );
    await expect(service.run(created.download_id)).rejects.toMatchObject({
      code: 'simulated_finalizer_crash',
    });
    spy.mockRestore();
    expect((await service.getDataset(created.dataset_id)).sealed).toBe(true);
    const requests = fixture.client.metrics.requests;
    await service.run(created.download_id);
    expect(fixture.client.metrics.requests).toBe(requests);
    expect((await service.getDataset(created.dataset_id)).status).toBe('READY');
  });

  it('atomically rolls back page records and cursor on database insert failure', async () => {
    const created = await create();
    fixture.controls.priceShift = 33;
    const before = await db.client.candleRevision.count();
    await db.client.$executeRawUnsafe(
      "CREATE FUNCTION fail_market_test_page() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.dataset_id::text = TG_ARGV[0] THEN RAISE EXCEPTION 'injected page failure'; END IF; RETURN NEW; END; $$",
    );
    await db.client.$executeRawUnsafe(
      `CREATE TRIGGER market_test_page_failure BEFORE INSERT ON dataset_candles FOR EACH ROW EXECUTE FUNCTION fail_market_test_page('${created.dataset_id}')`,
    );
    try {
      await expect(service.run(created.download_id)).rejects.toThrow();
      expect(await db.client.candleRevision.count()).toBe(before);
      expect(
        await db.client.marketDatasetCandle.count({
          where: { datasetId: created.dataset_id },
        }),
      ).toBe(0);
      const cp = checkpointSchema.parse(
        (await service.download(created.download_id)).checkpoint,
      );
      expect(cp.metrics.pages).toBe(0);
      expect(cp.streams[0]!.cursor_ms).toBe(MARKET_START + 360000 - 1);
    } finally {
      await db.client.$executeRawUnsafe(
        'DROP TRIGGER market_test_page_failure ON dataset_candles',
      );
      await db.client.$executeRawUnsafe(
        'DROP FUNCTION fail_market_test_page()',
      );
    }
    await service.run(created.download_id);
    expect((await service.getDataset(created.dataset_id)).status).toBe('READY');
  });

  it('handles reference OHLC and empty funding ranges without fake volume or zero-fill', async () => {
    const created = await create({
      startMs: MARKET_START + 60000,
      references: ['mark', 'index'],
    });
    await service.run(created.download_id);
    const mark = await service.candles(created.dataset_id, 'mark:1m', 10, null);
    expect(mark.items[0]).toMatchObject({ volume: null, turnover: null });
    expect(
      (await service.funding(created.dataset_id, 10, null)).items,
    ).toHaveLength(0);
    expect(await service.quality(created.dataset_id)).toMatchObject({
      funding: {
        count: 0,
        coverage: 'historical_cadence_unverified_no_zero_fill',
      },
    });
  });

  it('rejects invalid requests, bounds, pagination, unknown IDs and unsafe export paths', async () => {
    const before = await db.client.marketDataset.count();
    for (const body of [
      { configurationSnapshotId: snapshotId, startMs: MARKET_START },
      {
        configurationSnapshotId: snapshotId,
        startMs: MARKET_START - 1,
        endMs: MARKET_START + 60000,
      },
      { configurationSnapshotId: snapshotId, references: ['mark', 'mark'] },
      { configurationSnapshotId: snapshotId, source: 'untrusted' },
    ])
      await request(app.getHttpServer())
        .post('/market-data/downloads')
        .send(body)
        .expect(400);
    expect(await db.client.marketDataset.count()).toBe(before);
    await request(app.getHttpServer())
      .get('/market-data/datasets?limit=1001')
      .expect(400);
    await request(app.getHttpServer())
      .get('/market-data/datasets?offset=-1')
      .expect(400);
    await request(app.getHttpServer())
      .get(`/market-data/datasets/${randomUUID()}`)
      .expect(404);
    const created = await create();
    await service.run(created.download_id);
    await expect(
      service.candles(created.dataset_id, 'fake:1m', 10, null),
    ).rejects.toThrow();
    await request(app.getHttpServer())
      .get(`/market-data/datasets/${created.dataset_id}/candles`)
      .expect(400);
    await expect(
      service.run(created.download_id, { maxPages: 5001 }),
    ).rejects.toThrow();
    await expect(
      service.exportDataset(
        '../outside',
        path.join(root, '.runtime', 'test-exports'),
      ),
    ).rejects.toThrow();
    const exported = await service.exportDataset(
      created.dataset_id,
      path.join(root, '.runtime', 'test-exports'),
    );
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(exported.directory, 'manifest.json'),
          'utf8',
        ),
      ).quality.execution_ready,
    ).toBe(false);
  });

  it('reports historical funding cadence changes without inventing settlements or claiming completeness', async () => {
    fixture.controls.pageRows = 1000;
    fixture.controls.fundingIntervalMs = 14400000;
    const created = await create({ endMs: MARKET_START + 12 * 3600000 });
    await service.run(created.download_id);
    expect((await service.getDataset(created.dataset_id)).status).toBe('READY');
    expect(await service.quality(created.dataset_id)).toMatchObject({
      funding: {
        count: 3,
        cadence_anomalies_vs_current_interval: 2,
        coverage: 'historical_cadence_unverified_no_zero_fill',
      },
    });
    expect(
      (await service.funding(created.dataset_id, 100, null)).items,
    ).toHaveLength(3);
  });
});
