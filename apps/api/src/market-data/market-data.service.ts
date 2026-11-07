import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import {
  canonicalJson,
  marketDownloadRequestSchema,
  marketManifestSchema,
  marketQualitySchema,
  marketCandleSchema,
  fundingRecordSchema,
  instrumentObservationSchema,
  marketContentHash,
  normalizeCandle,
  normalizeFunding,
  parseTimestamp,
  effectiveRange,
  CandleCoverage,
  INTERVAL_MS,
  MarketContractError,
  type MarketCandle,
  type FundingRecord,
  type MarketManifest,
} from '@bybit/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.service.js';
import { ResearchConfigurationsService } from '../research-configurations/configurations.service.js';
import { BybitDataError, BybitPublicClient } from './bybit-public.client.js';
import {
  checkpointSchema,
  descriptorSchema,
  newCheckpoint,
  type DownloadCheckpoint,
  type DatasetDescriptor,
} from './state.js';

const LEASE_MS = 120000;
type Tx = Prisma.TransactionClient;
type Stream = DownloadCheckpoint['streams'][number];
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export function marketPublicValue(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item !== 'bigint') return item;
      const n = Number(item);
      if (!Number.isSafeInteger(n))
        throw new ConflictException({ code: 'market_data_integrity_error' });
      return n;
    }),
  );
}

@Injectable()
export class MarketDataService {
  private readonly background = new Map<string, Promise<void>>();
  private readonly starting = new Set<string>();
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ResearchConfigurationsService)
    private readonly configurations: ResearchConfigurationsService,
    @Inject(BybitPublicClient) private readonly client: BybitPublicClient,
  ) {}

  async create(input: unknown) {
    const parsed = marketDownloadRequestSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException({ code: 'invalid_download_request' });
    const r = parsed.data;
    const snapshot = await this.configurations.getSnapshot(
      r.configurationSnapshotId,
    );
    const c = this.configurations.verifyStored(snapshot);
    if (
      (r.startMs === undefined) !== (r.endMs === undefined) ||
      new Set(r.references).size !== r.references.length
    )
      throw new BadRequestException({
        code: 'invalid_download_range_or_references',
      });
    const start = r.startMs ?? c.market.historical_start_ms;
    const end = r.endMs ?? c.market.historical_end_ms;
    if (
      start >= end ||
      start < c.market.historical_start_ms ||
      end > c.market.historical_end_ms ||
      end - start > 366 * 86400000
    )
      throw new BadRequestException({
        code: 'download_range_outside_snapshot_or_budget',
      });
    const timeframes = [c.market.timeframe, ...c.market.secondary_timeframes];
    const streams: DatasetDescriptor['streams'] = timeframes.map(
      (timeframe) => ({
        id: `last:${timeframe}`,
        price_type: 'last',
        timeframe,
      }),
    );
    const references = new Set(r.references);
    if (c.stop_loss.trigger_reference !== 'last')
      references.add(c.stop_loss.trigger_reference);
    for (const priceType of references)
      streams.push({
        id: `${priceType}:${c.market.timeframe}`,
        price_type: priceType,
        timeframe: c.market.timeframe,
      });
    streams.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (
      streams.reduce(
        (sum, s) => sum + Math.ceil((end - start) / INTERVAL_MS[s.timeframe]),
        0,
      ) > 2000000
    )
      throw new BadRequestException({
        code: 'download_record_budget_exceeded',
      });
    const descriptor: DatasetDescriptor = {
      source: this.client.source,
      symbol: c.market.symbol,
      category: 'linear',
      configuration_hash: snapshot.configHash,
      start_ms: start,
      end_ms: end,
      streams,
    };
    return this.database.client.$transaction(async (tx) => {
      const dataset = await tx.marketDataset.create({
        data: { snapshotId: snapshot.id, request: json(descriptor) },
      });
      const run = await tx.marketDataDownload.create({
        data: { datasetId: dataset.id, checkpoint: json(newCheckpoint()) },
      });
      return {
        download_id: run.id,
        dataset_id: dataset.id,
        status: run.status,
        source: descriptor.source,
      };
    });
  }

  async download(id: string) {
    const run = await this.database.client.marketDataDownload.findUnique({
      where: { id },
    });
    if (!run) throw new NotFoundException({ code: 'download_not_found' });
    return {
      id: run.id,
      dataset_id: run.datasetId,
      status: run.status,
      checkpoint: run.checkpoint,
      lease_expires: run.leaseExpires,
      blocked_until: run.blockedUntil,
      last_error: run.lastError,
    };
  }

  async downloads(limit: number, offset: number, exportRoot: string) {
    const rows = await this.database.client.marketDataDownload.findMany({
      take: limit,
      skip: offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { dataset: true },
    });
    const items = await Promise.all(
      rows.map(async (run) => {
        const request = descriptorSchema.parse(run.dataset.request);
        const exported =
          run.dataset.status === 'READY' &&
          (await fs
            .access(path.join(exportRoot, run.datasetId, 'manifest.json'))
            .then(
              () => true,
              () => false,
            ));
        return {
          id: run.id,
          dataset_id: run.datasetId,
          snapshot_id: run.dataset.snapshotId,
          status: run.status,
          dataset_status: run.dataset.status,
          exported,
          preparing: this.background.has(run.id),
          symbol: request.symbol,
          start_ms: request.start_ms,
          end_ms: request.end_ms,
          streams: request.streams.map((s) => s.id),
          checkpoint: run.checkpoint,
          blocked_until: run.blockedUntil,
          lease_expires: run.leaseExpires,
          last_error: run.lastError,
        };
      }),
    );
    return { items, limit, offset };
  }

  async start(id: string, exportRoot: string) {
    if (this.background.has(id) || this.starting.has(id))
      throw new ConflictException({ code: 'market_worker_busy' });
    this.starting.add(id);
    let acquired: Awaited<ReturnType<MarketDataService['acquire']>>;
    try {
      acquired = await this.acquire(id);
    } finally {
      this.starting.delete(id);
    }
    const task = this.runAcquired(id, acquired, 1000, 1800)
      .then(async () => {
        const dataset = await this.getDataset(acquired.run.datasetId);
        if (dataset.status === 'READY') {
          await this.exportDataset(dataset.id, exportRoot);
          await this.database.client.marketDataDownload.updateMany({
            where: { id, status: 'COMPLETED' },
            data: { lastError: null },
          });
        }
      })
      .catch(async () => {
        // Ingestion records its own error; export failures need a retryable status too.
        await this.database.client.marketDataDownload
          .updateMany({
            where: { id, status: 'COMPLETED' },
            data: { lastError: 'download_export_failed' },
          })
          .catch(() => {});
      })
      .finally(() => {
        this.background.delete(id);
      });
    this.background.set(id, task);
    return {
      id,
      dataset_id: acquired.run.datasetId,
      status: acquired.run.status,
    };
  }

  async getDataset(id: string) {
    const dataset = await this.database.client.marketDataset.findUnique({
      where: { id },
    });
    if (!dataset) throw new NotFoundException({ code: 'dataset_not_found' });
    descriptorSchema.parse(dataset.request);
    if (dataset.status !== 'BUILDING') {
      const manifest = marketManifestSchema.safeParse(dataset.manifest);
      if (
        !manifest.success ||
        marketContentHash(manifest.data) !== dataset.fingerprint
      )
        throw new ConflictException({ code: 'market_data_integrity_error' });
    }
    return dataset;
  }

  async list(limit: number, offset: number) {
    const items = await this.database.client.marketDataset.findMany({
      take: limit,
      skip: offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        snapshotId: true,
        status: true,
        fingerprint: true,
        createdAt: true,
        completedAt: true,
      },
    });
    return { items, limit, offset };
  }

  async quality(id: string) {
    const dataset = await this.getDataset(id);
    if (dataset.quality !== null) return dataset.quality;
    const run = await this.database.client.marketDataDownload.findUniqueOrThrow(
      { where: { datasetId: id } },
    );
    return {
      final: false,
      status: run.status,
      checkpoint: run.checkpoint,
      last_error: run.lastError,
    };
  }

  private async acquire(id: string) {
    return this.database.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(50603)`;
      const run = await tx.marketDataDownload.findUnique({
        where: { id },
        include: { dataset: true },
      });
      if (!run) throw new NotFoundException({ code: 'download_not_found' });
      if (
        !descriptorSchema.safeParse(run.dataset.request).success ||
        !checkpointSchema.safeParse(run.checkpoint).success
      )
        throw new ConflictException({ code: 'market_data_integrity_error' });
      if (run.status === 'COMPLETED') return { run, token: null };
      if (run.status === 'FAILED')
        throw new ConflictException({
          code: 'download_failed_create_new_request',
        });
      const now = new Date();
      if (run.blockedUntil && run.blockedUntil > now)
        throw new ConflictException({
          code: 'download_cooldown',
          blocked_until: run.blockedUntil,
        });
      await tx.marketDataDownload.updateMany({
        where: { status: 'RUNNING', leaseExpires: { lte: now } },
        data: { status: 'PAUSED', leaseToken: null, leaseExpires: null },
      });
      if (await tx.marketDataDownload.count({ where: { status: 'RUNNING' } }))
        throw new ConflictException({ code: 'market_worker_busy' });
      const checkpoint = checkpointSchema.parse(run.checkpoint);
      if (run.status !== 'PENDING') checkpoint.metrics.resumes++;
      const token = randomUUID();
      const updated = await tx.marketDataDownload.update({
        where: { id },
        data: {
          status: 'RUNNING',
          leaseToken: token,
          leaseExpires: new Date(Date.now() + LEASE_MS),
          checkpoint: json(checkpoint),
          lastError: null,
          blockedUntil: null,
        },
        include: { dataset: true },
      });
      return { run: updated, token };
    });
  }

  private async owned<T>(
    id: string,
    token: string,
    checkpoint: DownloadCheckpoint,
    action: (tx: Tx) => Promise<T>,
    complete = false,
  ): Promise<T> {
    return this.database.client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM market_data_downloads WHERE id = ${id}::uuid FOR UPDATE`;
        const run = await tx.marketDataDownload.findUniqueOrThrow({
          where: { id },
        });
        if (
          run.status !== 'RUNNING' ||
          run.leaseToken !== token ||
          !run.leaseExpires ||
          run.leaseExpires.getTime() <= Date.now()
        )
          throw new ConflictException({ code: 'download_lease_lost' });
        const result = await action(tx);
        const updated = await tx.marketDataDownload.updateMany({
          where: {
            id,
            status: 'RUNNING',
            leaseToken: token,
            leaseExpires: { gt: new Date() },
          },
          data: {
            checkpoint: json(checkpoint),
            ...(complete
              ? { status: 'COMPLETED', leaseToken: null, leaseExpires: null }
              : { leaseExpires: new Date(Date.now() + LEASE_MS) }),
          },
        });
        if (updated.count !== 1)
          throw new ConflictException({ code: 'download_lease_lost' });
        return result;
      },
      { timeout: 30000, maxWait: 10000 },
    );
  }

  async run(
    id: string,
    options: { maxPages?: number; maxSeconds?: number } = {},
  ) {
    const maxPages = options.maxPages ?? 25,
      maxSeconds = options.maxSeconds ?? 120;
    if (
      !Number.isInteger(maxPages) ||
      maxPages < 1 ||
      maxPages > 5000 ||
      !Number.isInteger(maxSeconds) ||
      maxSeconds < 1 ||
      maxSeconds > 3600
    )
      throw new BadRequestException({ code: 'invalid_download_budget' });
    const { run, token } = await this.acquire(id);
    return this.runAcquired(id, { run, token }, maxPages, maxSeconds);
  }

  private async runAcquired(
    id: string,
    { run, token }: Awaited<ReturnType<MarketDataService['acquire']>>,
    maxPages: number,
    maxSeconds: number,
  ) {
    if (token === null) return this.download(id);
    const descriptor = descriptorSchema.parse(run.dataset.request);
    let cp = checkpointSchema.parse(run.checkpoint);
    const retries = cp.metrics.retries,
      initialRetries = this.client.metrics.retries;
    const updateRetries = (next: DownloadCheckpoint) => {
      next.metrics.retries =
        retries + this.client.metrics.retries - initialRetries;
    };
    const deadline = Date.now() + maxSeconds * 1000;
    try {
      if (descriptor.source !== this.client.source)
        throw new BybitDataError('dataset_source_mismatch');
      if (cp.cutoff_ms === null) {
        const next = structuredClone(cp);
        next.cutoff_ms = await this.client.serverTime();
        updateRetries(next);
        await this.owned(id, token, next, (tx) =>
          tx.marketDataset.update({
            where: { id: run.datasetId },
            data: { serverCutoff: BigInt(next.cutoff_ms!) },
          }),
        );
        cp = next;
      }
      if (!cp.initialized) {
        const instrument = await this.client.instrument(descriptor.symbol);
        const next = structuredClone(cp);
        next.initialized = true;
        next.streams = descriptor.streams.map((stream) => {
          const range = effectiveRange(
            descriptor.start_ms,
            descriptor.end_ms,
            next.cutoff_ms!,
            stream.timeframe,
          );
          return {
            ...stream,
            ...range,
            cursor_ms: range.end_ms > range.start_ms ? range.end_ms - 1 : null,
          };
        });
        const fundingEnd = Math.max(
          descriptor.start_ms,
          Math.min(descriptor.end_ms, next.cutoff_ms! - 2000),
        );
        next.funding = {
          start_ms: descriptor.start_ms,
          end_ms: fundingEnd,
          cursor_ms: fundingEnd > descriptor.start_ms ? fundingEnd - 1 : null,
        };
        updateRetries(next);
        await this.owned(id, token, next, async (tx) => {
          const observation = await tx.instrumentObservation.create({
            data: {
              source: descriptor.source,
              symbol: descriptor.symbol,
              payload: json(instrument),
              contentHash: marketContentHash(instrument),
            },
          });
          await tx.marketDataset.update({
            where: { id: run.datasetId },
            data: { instrumentId: observation.id },
          });
        });
        cp = next;
      }
      let pages = 0;
      while (
        cp.phase === 'collect' &&
        pages < maxPages &&
        Date.now() < deadline
      ) {
        const index = cp.streams.findIndex(
          (stream) => stream.cursor_ms !== null,
        );
        if (index === -1 && cp.funding.cursor_ms === null) break;
        const next = structuredClone(cp);
        if (index >= 0) {
          const stream = next.streams[index]!;
          const raw = await this.client.candles(
            descriptor.symbol,
            stream.timeframe,
            stream.price_type,
            stream.start_ms,
            stream.cursor_ms!,
          );
          let records: MarketCandle[];
          try {
            records = this.candlePage(raw, stream, descriptor, next);
          } catch (error) {
            if (error instanceof BybitDataError) {
              next.metrics.pages++;
              updateRetries(next);
              await this.owned(id, token, next, async () => {});
              cp = next;
            }
            throw error;
          }
          next.metrics.pages++;
          updateRetries(next);
          await this.owned(id, token, next, (tx) =>
            this.saveCandles(tx, run.datasetId, stream, records, next),
          );
        } else {
          const raw = await this.client.funding(
            descriptor.symbol,
            next.funding.start_ms,
            next.funding.cursor_ms!,
          );
          let records: FundingRecord[];
          try {
            records = this.fundingPage(raw, descriptor, next);
          } catch (error) {
            if (error instanceof BybitDataError) {
              next.metrics.pages++;
              updateRetries(next);
              await this.owned(id, token, next, async () => {});
              cp = next;
            }
            throw error;
          }
          next.metrics.pages++;
          updateRetries(next);
          await this.owned(id, token, next, (tx) =>
            this.saveFunding(tx, run.datasetId, records, next),
          );
        }
        cp = next;
        pages++;
      }
      if (
        cp.streams.every((stream) => stream.cursor_ms === null) &&
        cp.funding.cursor_ms === null
      ) {
        const next = structuredClone(cp);
        next.phase = 'finalize';
        updateRetries(next);
        await this.owned(id, token, next, (tx) =>
          tx.marketDataset.update({
            where: { id: run.datasetId },
            data: { sealed: true },
          }),
        );
        cp = next;
        await this.finalize(id, token, run.datasetId, descriptor, cp);
      } else {
        await this.release(id, token, cp, 'PAUSED', null, null);
      }
    } catch (error) {
      updateRetries(cp);
      const typed = error instanceof BybitDataError ? error : null;
      const lost =
        error instanceof ConflictException &&
        (error.getResponse() as { code?: string }).code ===
          'download_lease_lost';
      if (!lost) {
        const code =
          typed?.code ??
          (error instanceof MarketContractError
            ? error.code
            : 'market_ingestion_failed');
        await this.release(
          id,
          token,
          cp,
          typed?.resumable ||
            (!typed && !(error instanceof MarketContractError))
            ? 'PAUSED'
            : 'FAILED',
          code,
          typed?.blockedUntil ?? null,
        );
      }
      throw error;
    }
    return this.download(id);
  }

  private async release(
    id: string,
    token: string,
    cp: DownloadCheckpoint,
    status: string,
    error: string | null,
    blocked: number | null,
  ) {
    await this.database.client.marketDataDownload.updateMany({
      where: {
        id,
        status: 'RUNNING',
        leaseToken: token,
        leaseExpires: { gt: new Date() },
      },
      data: {
        status,
        checkpoint: json(cp),
        lastError: error,
        blockedUntil: blocked === null ? null : new Date(blocked),
        leaseToken: null,
        leaseExpires: null,
      },
    });
  }

  private candlePage(
    raw: unknown[],
    stream: Stream,
    descriptor: DatasetDescriptor,
    cp: DownloadCheckpoint,
  ): MarketCandle[] {
    const records: MarketCandle[] = [];
    const times: number[] = [];
    let previous = Infinity;
    for (const row of raw) {
      let time: number;
      try {
        time = parseTimestamp(Array.isArray(row) ? row[0] : null);
      } catch {
        cp.metrics.invalid++;
        continue;
      }
      if (time > previous) cp.metrics.out_of_order++;
      previous = time;
      times.push(time);
      try {
        const c = normalizeCandle(row, {
          source: descriptor.source,
          symbol: descriptor.symbol,
          timeframe: stream.timeframe,
          priceType: stream.price_type,
        });
        if (
          c.close_time_ms > cp.cutoff_ms! - 2000 ||
          c.close_time_ms > descriptor.end_ms
        ) {
          cp.metrics.incomplete++;
          continue;
        }
        if (
          c.open_time_ms < stream.start_ms ||
          c.close_time_ms > stream.end_ms
        ) {
          cp.metrics.outside_range++;
          continue;
        }
        records.push(c);
      } catch {
        cp.metrics.invalid++;
      }
    }
    stream.cursor_ms = this.nextCursor(
      raw.length,
      times,
      stream.cursor_ms!,
      stream.start_ms,
    );
    return records;
  }

  private fundingPage(
    raw: unknown[],
    descriptor: DatasetDescriptor,
    cp: DownloadCheckpoint,
  ): FundingRecord[] {
    const records: FundingRecord[] = [];
    const times: number[] = [];
    let previous = Infinity;
    for (const row of raw) {
      try {
        const record = normalizeFunding(row, {
          source: descriptor.source,
          symbol: descriptor.symbol,
        });
        times.push(record.timestamp_ms);
        if (record.timestamp_ms > previous) cp.metrics.out_of_order++;
        previous = record.timestamp_ms;
        if (
          record.timestamp_ms >= cp.funding.start_ms &&
          record.timestamp_ms < cp.funding.end_ms
        )
          records.push(record);
        else cp.metrics.outside_range++;
      } catch {
        cp.metrics.invalid++;
      }
    }
    cp.funding.cursor_ms = this.nextCursor(
      raw.length,
      times,
      cp.funding.cursor_ms!,
      cp.funding.start_ms,
    );
    return records;
  }

  private nextCursor(
    length: number,
    times: number[],
    cursor: number,
    start: number,
  ): number | null {
    if (length === 0) return null;
    const advancing = times.filter((time) => time <= cursor);
    if (!advancing.length)
      throw new BybitDataError('non_progressing_or_invalid_page');
    const oldest = Math.min(...advancing);
    return oldest <= start ? null : oldest - 1;
  }

  private async saveCandles(
    tx: Tx,
    datasetId: string,
    stream: Stream,
    records: MarketCandle[],
    cp: DownloadCheckpoint,
  ) {
    if (!records.length) return;
    const unique = new Map<number, MarketCandle>();
    for (const c of records) {
      const old = unique.get(c.open_time_ms);
      if (old) {
        if (marketContentHash(old) === marketContentHash(c))
          cp.metrics.duplicates++;
        else cp.metrics.conflicts++;
      } else unique.set(c.open_time_ms, c);
    }
    await tx.candleRevision.createMany({
      data: records.map((c) => ({
        source: c.source,
        symbol: c.symbol,
        priceType: c.price_type,
        timeframe: c.timeframe,
        openTime: BigInt(c.open_time_ms),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        turnover: c.turnover,
        payload: json(c),
        contentHash: marketContentHash(c),
      })),
      skipDuplicates: true,
    });
    const times = [...unique.keys()].map(BigInt);
    const revisions = await tx.candleRevision.findMany({
      where: {
        source: records[0]!.source,
        symbol: records[0]!.symbol,
        priceType: stream.price_type,
        timeframe: stream.timeframe,
        openTime: { in: times },
      },
      select: { id: true, openTime: true, contentHash: true },
    });
    const existing = await tx.marketDatasetCandle.findMany({
      where: { datasetId, stream: stream.id, openTime: { in: times } },
      include: { candle: { select: { contentHash: true } } },
    });
    const pinned = new Map(
      existing.map((item) => [Number(item.openTime), item.candle.contentHash]),
    );
    const ids = new Map(
      revisions.map((item) => [
        `${item.openTime}:${item.contentHash}`,
        item.id,
      ]),
    );
    const rows: {
      datasetId: string;
      stream: string;
      openTime: bigint;
      candleId: string;
    }[] = [];
    for (const [time, record] of unique) {
      const hash = marketContentHash(record);
      if (pinned.has(time)) {
        if (pinned.get(time) === hash) cp.metrics.duplicates++;
        else cp.metrics.conflicts++;
        continue;
      }
      const candleId = ids.get(`${time}:${hash}`);
      if (!candleId) throw new Error('Missing candle revision');
      rows.push({
        datasetId,
        stream: stream.id,
        openTime: BigInt(time),
        candleId,
      });
    }
    if (rows.length) await tx.marketDatasetCandle.createMany({ data: rows });
  }

  private async saveFunding(
    tx: Tx,
    datasetId: string,
    records: FundingRecord[],
    cp: DownloadCheckpoint,
  ) {
    if (!records.length) return;
    const unique = new Map<number, FundingRecord>();
    for (const f of records) {
      const old = unique.get(f.timestamp_ms);
      if (old) {
        if (marketContentHash(old) === marketContentHash(f))
          cp.metrics.duplicates++;
        else cp.metrics.conflicts++;
      } else unique.set(f.timestamp_ms, f);
    }
    await tx.fundingRevision.createMany({
      data: records.map((f) => ({
        source: f.source,
        symbol: f.symbol,
        timestamp: BigInt(f.timestamp_ms),
        rate: f.rate,
        payload: json(f),
        contentHash: marketContentHash(f),
      })),
      skipDuplicates: true,
    });
    const times = [...unique.keys()].map(BigInt);
    const revisions = await tx.fundingRevision.findMany({
      where: {
        source: records[0]!.source,
        symbol: records[0]!.symbol,
        timestamp: { in: times },
      },
      select: { id: true, timestamp: true, contentHash: true },
    });
    const existing = await tx.marketDatasetFunding.findMany({
      where: { datasetId, timestamp: { in: times } },
      include: { funding: { select: { contentHash: true } } },
    });
    const pinned = new Map(
      existing.map((item) => [
        Number(item.timestamp),
        item.funding.contentHash,
      ]),
    );
    const ids = new Map(
      revisions.map((item) => [
        `${item.timestamp}:${item.contentHash}`,
        item.id,
      ]),
    );
    const rows: { datasetId: string; timestamp: bigint; fundingId: string }[] =
      [];
    for (const [time, record] of unique) {
      const hash = marketContentHash(record);
      if (pinned.has(time)) {
        if (pinned.get(time) === hash) cp.metrics.duplicates++;
        else cp.metrics.conflicts++;
        continue;
      }
      const fundingId = ids.get(`${time}:${hash}`);
      if (!fundingId) throw new Error('Missing funding revision');
      rows.push({ datasetId, timestamp: BigInt(time), fundingId });
    }
    if (rows.length) await tx.marketDatasetFunding.createMany({ data: rows });
  }

  private async *candleChunks(
    datasetId: string,
    stream: string,
  ): AsyncGenerator<MarketCandle[]> {
    let cursor = -1n;
    while (true) {
      const rows = await this.database.client.marketDatasetCandle.findMany({
        where: { datasetId, stream, openTime: { gt: cursor } },
        orderBy: { openTime: 'asc' },
        take: 1000,
        include: { candle: true },
      });
      if (!rows.length) return;
      const records = rows.map((row) => {
        const parsed = marketCandleSchema.safeParse(row.candle.payload);
        if (
          !parsed.success ||
          parsed.data.open_time_ms !== Number(row.openTime) ||
          `${parsed.data.price_type}:${parsed.data.timeframe}` !== stream ||
          marketContentHash(parsed.data) !== row.candle.contentHash
        )
          throw new ConflictException({ code: 'market_data_integrity_error' });
        return parsed.data;
      });
      yield records;
      cursor = rows[rows.length - 1]!.openTime;
    }
  }

  private async *fundingChunks(
    datasetId: string,
  ): AsyncGenerator<FundingRecord[]> {
    let cursor = -1n;
    while (true) {
      const rows = await this.database.client.marketDatasetFunding.findMany({
        where: { datasetId, timestamp: { gt: cursor } },
        orderBy: { timestamp: 'asc' },
        take: 1000,
        include: { funding: true },
      });
      if (!rows.length) return;
      yield rows.map((row) => {
        const parsed = fundingRecordSchema.safeParse(row.funding.payload);
        if (
          !parsed.success ||
          parsed.data.timestamp_ms !== Number(row.timestamp) ||
          marketContentHash(parsed.data) !== row.funding.contentHash
        )
          throw new ConflictException({ code: 'market_data_integrity_error' });
        return parsed.data;
      });
      cursor = rows[rows.length - 1]!.timestamp;
    }
  }

  private async finalize(
    id: string,
    token: string,
    datasetId: string,
    descriptor: DatasetDescriptor,
    cp: DownloadCheckpoint,
  ) {
    const dataset = await this.database.client.marketDataset.findUniqueOrThrow({
      where: { id: datasetId },
      include: { instrument: true },
    });
    if (!dataset.instrument || !dataset.sealed)
      throw new Error('Dataset not sealed');
    const instrument = instrumentObservationSchema.parse(
      dataset.instrument.payload,
    );
    if (marketContentHash(instrument) !== dataset.instrument.contentHash)
      throw new ConflictException({ code: 'market_data_integrity_error' });
    const streams: MarketManifest['streams'] = [];
    const coverage: Record<string, unknown>[] = [];
    for (const stream of cp.streams) {
      const scan = new CandleCoverage(
        stream.start_ms,
        stream.end_ms,
        INTERVAL_MS[stream.timeframe],
      );
      const hash = createHash('sha256');
      for await (const chunk of this.candleChunks(datasetId, stream.id)) {
        for (const c of chunk) {
          scan.add(c.open_time_ms);
          hash.update(canonicalJson(c) + '\n', 'utf8');
        }
        await this.owned(id, token, cp, async () => {});
      }
      const result = scan.finish();
      coverage.push({
        id: stream.id,
        start_ms: stream.start_ms,
        end_ms: stream.end_ms,
        ...result,
      });
      streams.push({
        id: stream.id,
        start_ms: stream.start_ms,
        end_ms: stream.end_ms,
        count: result.count,
        sha256: hash.digest('hex'),
      });
    }
    const fundingHash = createHash('sha256');
    let fundingCount = 0,
      anomalies = 0,
      previous: number | null = null;
    for await (const chunk of this.fundingChunks(datasetId)) {
      for (const f of chunk) {
        fundingHash.update(canonicalJson(f) + '\n', 'utf8');
        fundingCount++;
        if (
          previous !== null &&
          f.timestamp_ms - previous !==
            instrument.funding_interval_minutes * 60000
        )
          anomalies++;
        previous = f.timestamp_ms;
      }
      await this.owned(id, token, cp, async () => {});
    }
    const usable =
      cp.metrics.invalid === 0 &&
      cp.metrics.conflicts === 0 &&
      coverage.every((s) => s.missing === 0 && Number(s.count) > 0);
    const manifest: MarketManifest = {
      format_version: '1',
      quality_policy: 'strict_closed_v1',
      source: descriptor.source,
      category: 'linear',
      symbol: descriptor.symbol,
      requested_start_ms: descriptor.start_ms,
      requested_end_ms: descriptor.end_ms,
      instrument_hash: dataset.instrument.contentHash,
      streams,
      funding: {
        count: fundingCount,
        sha256: fundingHash.digest('hex'),
        coverage: 'queried_range_historical_cadence_unverified',
      },
    };
    marketManifestSchema.parse(manifest);
    const quality = {
      final: true,
      candles_usable: usable,
      execution_ready: false,
      streams: coverage,
      counters: cp.metrics,
      funding: {
        count: fundingCount,
        queried_start_ms: cp.funding.start_ms,
        queried_end_ms: cp.funding.end_ms,
        cadence_anomalies_vs_current_interval: anomalies,
        coverage: 'historical_cadence_unverified_no_zero_fill',
      },
      metadata: {
        historical_validity: instrument.historical_validity,
        instrument_observed_at: dataset.instrument.observedAt.toISOString(),
        pre_launch_requested: descriptor.start_ms < instrument.launch_time_ms,
      },
      cutoff_ms: cp.cutoff_ms,
      safety_delay_ms: 2000,
      requested_range_clipped: cp.streams.some(
        (s) =>
          s.start_ms !== descriptor.start_ms || s.end_ms !== descriptor.end_ms,
      ),
    };
    marketQualitySchema.parse(quality);
    await this.owned(
      id,
      token,
      cp,
      async (tx) => {
        await tx.marketDataset.update({
          where: { id: datasetId },
          data: {
            status: usable ? 'READY' : 'QUALITY_FAILED',
            quality: json(quality),
            manifest: json(manifest),
            fingerprint: marketContentHash(manifest),
            completedAt: new Date(),
          },
        });
      },
      true,
    );
  }

  async candles(
    id: string,
    stream: string,
    limit: number,
    after: number | null,
  ) {
    const dataset = await this.getDataset(id);
    this.requireFinal(dataset.status);
    const descriptor = descriptorSchema.parse(dataset.request);
    if (!descriptor.streams.some((item) => item.id === stream))
      throw new BadRequestException({ code: 'unknown_dataset_stream' });
    const rows = await this.database.client.marketDatasetCandle.findMany({
      where: {
        datasetId: id,
        stream,
        ...(after === null ? {} : { openTime: { gt: BigInt(after) } }),
      },
      take: limit,
      orderBy: { openTime: 'asc' },
      include: { candle: true },
    });
    return {
      dataset_id: id,
      status: dataset.status,
      stream,
      items: rows.map((row) => row.candle.payload),
      next_after_ms:
        rows.length === limit ? Number(rows[rows.length - 1]!.openTime) : null,
    };
  }

  async funding(id: string, limit: number, after: number | null) {
    const dataset = await this.getDataset(id);
    this.requireFinal(dataset.status);
    const rows = await this.database.client.marketDatasetFunding.findMany({
      where: {
        datasetId: id,
        ...(after === null ? {} : { timestamp: { gt: BigInt(after) } }),
      },
      take: limit,
      orderBy: { timestamp: 'asc' },
      include: { funding: true },
    });
    return {
      dataset_id: id,
      status: dataset.status,
      items: rows.map((row) => row.funding.payload),
      next_after_ms:
        rows.length === limit ? Number(rows[rows.length - 1]!.timestamp) : null,
    };
  }

  private requireFinal(status: string) {
    if (status === 'BUILDING')
      throw new ConflictException({ code: 'dataset_not_finalized' });
  }

  async exportDataset(id: string, baseDirectory: string) {
    const dataset = await this.getDataset(id);
    this.requireFinal(dataset.status);
    const manifest = marketManifestSchema.parse(dataset.manifest);
    const directory = path.resolve(baseDirectory, id);
    if (
      !/^[0-9a-f-]{36}$/i.test(id) ||
      path.dirname(directory) !== path.resolve(baseDirectory)
    )
      throw new BadRequestException({ code: 'invalid_export_path' });
    await fs.mkdir(directory, { recursive: true });
    const files: { file: string; count: number; sha256: string }[] = [];
    for (const stream of manifest.streams) {
      const file = stream.id.replace(':', '-') + '.jsonl';
      const result = await this.writeExport(
        directory,
        file,
        this.candleChunks(id, stream.id),
      );
      if (result.sha256 !== stream.sha256 || result.count !== stream.count)
        throw new Error('Export candle digest mismatch');
      files.push({ file, ...result });
    }
    const funding = await this.writeExport(
      directory,
      'funding.jsonl',
      this.fundingChunks(id),
    );
    if (
      funding.sha256 !== manifest.funding.sha256 ||
      funding.count !== manifest.funding.count
    )
      throw new Error('Export funding digest mismatch');
    files.push({ file: 'funding.jsonl', ...funding });
    const instrument =
      await this.database.client.instrumentObservation.findUniqueOrThrow({
        where: { id: dataset.instrumentId! },
      });
    if (marketContentHash(instrument.payload) !== manifest.instrument_hash)
      throw new Error('Export instrument digest mismatch');
    async function* metadata() {
      yield [instrument.payload];
    }
    const metadataFile = await this.writeExport(
      directory,
      'instrument.json',
      metadata(),
    );
    files.push({ file: 'instrument.json', ...metadataFile });
    const request = descriptorSchema.parse(dataset.request);
    const exported = {
      manifest,
      fingerprint: dataset.fingerprint,
      configuration_snapshot_id: dataset.snapshotId,
      configuration_hash: request.configuration_hash,
      quality: dataset.quality,
      provenance: {
        instrument_observed_at: instrument.observedAt.toISOString(),
        server_cutoff_ms: Number(dataset.serverCutoff),
      },
      files,
    };
    const temporary = path.join(directory, `manifest.${randomUUID()}.tmp`);
    await fs.writeFile(temporary, canonicalJson(exported) + '\n', 'utf8');
    await fs.rename(temporary, path.join(directory, 'manifest.json'));
    return { directory, fingerprint: dataset.fingerprint, files };
  }

  private async writeExport(
    directory: string,
    filename: string,
    chunks: AsyncIterable<unknown[]>,
  ) {
    if (!/^[a-zA-Z0-9-]+\.(jsonl|json)$/.test(filename))
      throw new Error('Unsafe export filename');
    const temporary = path.join(directory, `${filename}.${randomUUID()}.tmp`);
    const handle = await fs.open(temporary, 'wx');
    const hash = createHash('sha256');
    let count = 0;
    try {
      for await (const chunk of chunks) {
        const text = chunk.map((item) => canonicalJson(item) + '\n').join('');
        hash.update(text, 'utf8');
        count += chunk.length;
        await handle.writeFile(text, 'utf8');
      }
    } finally {
      await handle.close();
    }
    const digest = hash.digest('hex');
    const verify = createHash('sha256');
    for await (const chunk of createReadStream(temporary)) verify.update(chunk);
    if (verify.digest('hex') !== digest)
      throw new Error('Export file checksum mismatch');
    await fs.rename(temporary, path.join(directory, filename));
    return { count, sha256: digest };
  }
}
