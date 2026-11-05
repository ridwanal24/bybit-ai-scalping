import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  configurationHash,
  researchPreset,
  type ResearchConfiguration,
} from '@bybit/contracts';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import {
  parseEnvironment,
  type Environment,
} from '../src/config/environment.js';

const url = process.env.FOUNDATION_TEST_DATABASE_URL;
if (!url || url !== process.env.DATABASE_URL)
  throw new Error('Dedicated integration database required');
const target = new URL(url);
if (
  target.hostname !== '127.0.0.1' ||
  target.port !== '55433' ||
  !/^\/bybit_test_[a-z0-9_]+$/.test(target.pathname)
)
  throw new Error('Refusing non-test configuration database');

type Draft = {
  id: string;
  revision: number;
  payload: ResearchConfiguration;
  configHash: string;
  provenance: Record<string, unknown>;
};
type Snapshot = {
  id: string;
  sourceRevision: number;
  payload: ResearchConfiguration;
  configHash: string;
  provenance: Record<string, unknown>;
};

describe('configuration HTTP/PostgreSQL integration', () => {
  let app: INestApplication;
  let database: DatabaseService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    database = app.get(DatabaseService);
  });
  afterAll(async () => {
    await app?.close();
  });

  async function create(
    configuration = researchPreset(),
    name = 'Research draft',
  ): Promise<Draft> {
    const response = await request(app.getHttpServer())
      .post('/configurations')
      .send({ name, configuration })
      .expect(201);
    return response.body as Draft;
  }
  async function freeze(
    id: string,
    expectedRevision: number,
  ): Promise<Snapshot> {
    const response = await request(app.getHttpServer())
      .post(`/configurations/${id}/snapshots`)
      .send({ expectedRevision })
      .expect(201);
    return response.body as Snapshot;
  }

  it('runs preset -> validate -> persist/read -> snapshot -> edit -> old snapshot -> compatibility E2E', async () => {
    const presets = await request(app.getHttpServer())
      .get('/configuration-presets')
      .expect(200);
    const preset = presets.body.items[0] as {
      configuration: ResearchConfiguration;
    };
    const validation = await request(app.getHttpServer())
      .post('/configurations/validate')
      .send(preset.configuration)
      .expect(200);
    expect(validation.body.configuration_valid).toBe(true);
    expect(validation.body.execution_checks_pending).toContain(
      'exchange_capabilities',
    );
    const draft = await create(preset.configuration);
    expect(draft.revision).toBe(1);
    expect(draft.provenance.source).toBe('builtin_preset');
    const read = await request(app.getHttpServer())
      .get(`/configurations/${draft.id}`)
      .expect(200);
    expect(read.body.configHash).toBe(validation.body.config_hash);
    const snapshot = await freeze(draft.id, 1);
    const edited = researchPreset();
    edited.risk.initial_capital = '2000';
    const update = await request(app.getHttpServer())
      .put(`/configurations/${draft.id}`)
      .send({ name: 'Revised', expectedRevision: 1, configuration: edited })
      .expect(200);
    expect(update.body.revision).toBe(2);
    expect(update.body.provenance.source).toBe('user_configuration');
    const old = await request(app.getHttpServer())
      .get(`/configuration-snapshots/${snapshot.id}`)
      .expect(200);
    expect(old.body.payload.risk.initial_capital).toBe('1000');
    expect(old.body.configHash).toBe(snapshot.configHash);
    const comparison = await request(app.getHttpServer())
      .post('/configurations/compatibility')
      .send({ referenceSnapshotId: snapshot.id, candidate: edited })
      .expect(200);
    expect(comparison.body.status).toBe('reevaluation_required');
    expect(comparison.body.model_approval).toBe('not_assessed');
    const list = await request(app.getHttpServer())
      .get('/configurations?limit=1&offset=0')
      .expect(200);
    expect(list.body.items).toHaveLength(1);
  });

  it('rejects invalid create/update without any write or revision change', async () => {
    const before = await database.client.researchConfiguration.count();
    const invalid = researchPreset();
    invalid.stop_loss.hard_stop_required = false as true;
    const response = await request(app.getHttpServer())
      .post('/configurations')
      .send({ name: 'Invalid', configuration: invalid })
      .expect(400);
    expect(response.body.code).toBe('invalid_configuration');
    expect(response.body.issues[0].field).toBe('stop_loss.hard_stop_required');
    expect(await database.client.researchConfiguration.count()).toBe(before);
    const draft = await create();
    await request(app.getHttpServer())
      .put(`/configurations/${draft.id}`)
      .send({ name: 'Invalid', expectedRevision: 1, configuration: invalid })
      .expect(400);
    expect(
      (
        await database.client.researchConfiguration.findUniqueOrThrow({
          where: { id: draft.id },
        })
      ).revision,
    ).toBe(1);
  });

  it('rejects invalid names, unknown envelope fields, IDs, pagination and revisions', async () => {
    await request(app.getHttpServer())
      .post('/configurations')
      .send({ name: ' ', configuration: researchPreset() })
      .expect(400);
    await request(app.getHttpServer())
      .post('/configurations')
      .send({
        name: 'Name',
        configuration: researchPreset(),
        credentials: 'do_not_echo',
      })
      .expect(400);
    await request(app.getHttpServer())
      .get('/configurations/invalid-id')
      .expect(400);
    await request(app.getHttpServer())
      .get('/configurations?limit=101')
      .expect(400);
    await request(app.getHttpServer())
      .get('/configurations?offset=-1')
      .expect(400);
    await request(app.getHttpServer())
      .get('/configurations?unknown=1')
      .expect(400);
    await request(app.getHttpServer())
      .get(`/configurations/${randomUUID()}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/configuration-snapshots/${randomUUID()}`)
      .expect(404);
    const draft = await create();
    await request(app.getHttpServer())
      .post(`/configurations/${draft.id}/snapshots`)
      .send({ expectedRevision: '1' })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/configurations/${draft.id}`)
      .send({
        name: 'Name',
        configuration: researchPreset(),
        expectedRevision: 0,
      })
      .expect(400);
  });

  it('allows only one concurrent update for a revision and rejects stale edits', async () => {
    const draft = await create();
    const updates = await Promise.all(
      ['First', 'Second'].map((name) =>
        request(app.getHttpServer())
          .put(`/configurations/${draft.id}`)
          .send({ name, expectedRevision: 1, configuration: researchPreset() }),
      ),
    );
    expect(updates.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (
        await database.client.researchConfiguration.findUniqueOrThrow({
          where: { id: draft.id },
        })
      ).revision,
    ).toBe(2);
    await request(app.getHttpServer())
      .post(`/configurations/${draft.id}/snapshots`)
      .send({ expectedRevision: 1 })
      .expect(409);
  });

  it('makes concurrent same-revision snapshots idempotent including retry after draft revision changes', async () => {
    const draft = await create();
    const [first, second] = await Promise.all([
      freeze(draft.id, 1),
      freeze(draft.id, 1),
    ]);
    expect(first.id).toBe(second.id);
    await request(app.getHttpServer())
      .put(`/configurations/${draft.id}`)
      .send({
        name: 'Revised',
        expectedRevision: 1,
        configuration: researchPreset(),
      })
      .expect(200);
    expect((await freeze(draft.id, 1)).id).toBe(first.id);
    expect(
      await database.client.configurationSnapshot.count({
        where: { sourceConfigurationId: draft.id },
      }),
    ).toBe(1);
  });

  it('serializes snapshot/edit races so snapshots never claim a different revision payload', async () => {
    const draft = await create();
    const edited = researchPreset();
    edited.exit.rr = '3';
    const [snapshotResponse, updateResponse] = await Promise.all([
      request(app.getHttpServer())
        .post(`/configurations/${draft.id}/snapshots`)
        .send({ expectedRevision: 1 }),
      request(app.getHttpServer())
        .put(`/configurations/${draft.id}`)
        .send({ name: 'Edited', expectedRevision: 1, configuration: edited }),
    ]);
    expect(updateResponse.status).toBe(200);
    expect([201, 409]).toContain(snapshotResponse.status);
    if (snapshotResponse.status === 201) {
      const snapshot = snapshotResponse.body as Snapshot;
      expect(snapshot.sourceRevision).toBe(1);
      expect(snapshot.payload.exit.rr).toBe('2');
      expect(snapshot.configHash).toBe(draft.configHash);
    }
    expect(
      (
        await database.client.researchConfiguration.findUniqueOrThrow({
          where: { id: draft.id },
        })
      ).configHash,
    ).toBe(configurationHash(edited));
  });

  it('prevents snapshot API writes and database UPDATE/DELETE/TRUNCATE', async () => {
    const draft = await create();
    const snapshot = await freeze(draft.id, 1);
    await request(app.getHttpServer())
      .put(`/configuration-snapshots/${snapshot.id}`)
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/configuration-snapshots/${snapshot.id}`)
      .expect(404);
    await expect(
      database.client
        .$executeRaw`UPDATE configuration_snapshots SET config_hash = ${'0'.repeat(64)} WHERE id = ${snapshot.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      database.client
        .$executeRaw`DELETE FROM configuration_snapshots WHERE id = ${snapshot.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      database.client.$executeRaw`TRUNCATE configuration_snapshots`,
    ).rejects.toThrow();
    await expect(
      database.client.researchConfiguration.delete({ where: { id: draft.id } }),
    ).rejects.toThrow();
    expect(
      (
        await database.client.configurationSnapshot.findUniqueOrThrow({
          where: { id: snapshot.id },
        })
      ).configHash,
    ).toBe(snapshot.configHash);
  });

  it('rejects unsupported or corrupted stored snapshots without exposing raw storage errors', async () => {
    const draft = await create();
    for (const data of [
      { schemaVersion: '2', configHash: draft.configHash },
      { schemaVersion: '1', configHash: '0'.repeat(64) },
    ]) {
      // Direct insert represents an unsupported importer/tampered source, not an API write.
      const snapshot = await database.client.configurationSnapshot.create({
        data: {
          sourceConfigurationId: draft.id,
          sourceRevision: data.schemaVersion === '2' ? 20 : 21,
          payload: draft.payload,
          provenance: {},
          ...data,
        },
      });
      const response = await request(app.getHttpServer())
        .get(`/configuration-snapshots/${snapshot.id}`)
        .expect(409);
      expect(response.body).toEqual({ code: 'configuration_integrity_error' });
    }
  });

  it('classifies incompatible schema and changed features without approving deployment', async () => {
    const draft = await create();
    const snapshot = await freeze(draft.id, 1);
    for (const [candidate, expected] of [
      [researchPreset(), 'exact_config_match'],
      [{ ...researchPreset(), action_schema_version: '2' }, 'incompatible'],
      [
        { ...researchPreset(), exit: { ...researchPreset().exit, rr: '3' } },
        'retraining_required',
      ],
    ] as const) {
      const response = await request(app.getHttpServer())
        .post('/configurations/compatibility')
        .send({ referenceSnapshotId: snapshot.id, candidate })
        .expect(200);
      expect(response.body.status).toBe(expected);
      expect(response.body.execution_readiness).toBe('not_assessed');
    }
    await request(app.getHttpServer())
      .post('/configurations/compatibility')
      .send({ referenceSnapshotId: snapshot.id, candidate: {} })
      .expect(400);
  });

  it('returns sanitized 503 on configuration storage failure while validation remains available', async () => {
    const config = new ConfigService<Environment, true>(
      parseEnvironment({
        DATABASE_URL: 'postgresql://bot:do_not_leak@127.0.0.1:1/unreachable',
        DATABASE_TIMEOUT_MS: 100,
      }),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(new DatabaseService(config))
      .compile();
    const failedApp = module.createNestApplication({ logger: false });
    await failedApp.init();
    try {
      const response = await request(failedApp.getHttpServer())
        .get('/configurations')
        .expect(503);
      expect(response.body).toEqual({
        code: 'configuration_storage_unavailable',
      });
      expect(JSON.stringify(response.body)).not.toContain('do_not_leak');
      await request(failedApp.getHttpServer())
        .post('/configurations/validate')
        .send(researchPreset())
        .expect(200);
    } finally {
      await failedApp.close();
    }
  });
});
