import 'reflect-metadata';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { researchPreset } from '@bybit/contracts';
import { AppModule } from '../app.module.js';
import { MarketDataService, marketPublicValue } from './market-data.service.js';
import { ResearchConfigurationsService } from '../research-configurations/configurations.service.js';
import { BybitDataError, BybitPublicClient } from './bybit-public.client.js';
import { HttpException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const parsed = z
  .enum(['download', 'export', 'smoke'])
  .safeParse(process.argv[2]);
async function main() {
  if (!parsed.success) throw new Error('invalid_market_command');
  const args = new Map<string, string>();
  for (let i = 3; i < process.argv.length; i += 2) {
    const key = process.argv[i],
      value = process.argv[i + 1];
    if (
      !key ||
      !value ||
      !['--id', '--dataset', '--max-pages', '--max-seconds'].includes(key) ||
      args.has(key)
    )
      throw new Error('invalid_market_arguments');
    args.set(key, value);
  }
  const command = parsed.data;
  if (command === 'smoke' && args.size)
    throw new Error('smoke_does_not_accept_overrides');
  if (
    command === 'download' &&
    [...args.keys()].some(
      (key) => !['--id', '--max-pages', '--max-seconds'].includes(key),
    )
  )
    throw new Error('invalid_market_arguments');
  if (
    command === 'export' &&
    [...args.keys()].some((key) => key !== '--dataset')
  )
    throw new Error('invalid_market_arguments');
  const id =
    command === 'smoke'
      ? null
      : z.uuid().parse(args.get(command === 'export' ? '--dataset' : '--id'));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    const service = app.get(MarketDataService);
    const exportRoot = path.join(root, 'artifacts', 'datasets');
    if (command === 'download') {
      const maxPages = args.has('--max-pages')
        ? Number(args.get('--max-pages'))
        : undefined;
      const maxSeconds = args.has('--max-seconds')
        ? Number(args.get('--max-seconds'))
        : undefined;
      console.log(
        JSON.stringify(
          marketPublicValue(await service.run(id!, { maxPages, maxSeconds })),
        ),
      );
    } else if (command === 'export') {
      console.log(JSON.stringify(await service.exportDataset(id!, exportRoot)));
    } else {
      // Smoke is explicitly bounded, public-only and uses only the approved local DB.
      const db = new URL(process.env.DATABASE_URL ?? '');
      if (
        db.hostname !== '127.0.0.1' ||
        db.port !== '55432' ||
        db.pathname !== '/bybit_dev'
      )
        throw new Error('smoke_requires_project_development_database');
      const api = app.get(BybitPublicClient);
      if (api.source !== 'bybit-mainnet')
        throw new Error('smoke_requires_public_source');
      const config = app.get(ResearchConfigurationsService);
      const draft = await config.create(
        'M3 public historical smoke',
        researchPreset(),
      );
      const snapshot = await config.snapshot(draft.id, draft.revision);
      const start = researchPreset().market.historical_start_ms;
      const created = await service.create({
        configurationSnapshotId: snapshot.id,
        startMs: start,
        endMs: start + 86400000,
      });
      await fs.mkdir(path.join(root, '.runtime'), { recursive: true });
      const evidencePath = path.join(root, '.runtime', 'bybit-smoke.json');
      await fs.writeFile(
        evidencePath,
        JSON.stringify({ ...created, status: 'started' }, null, 2) + '\n',
      );
      await service.run(created.download_id, { maxPages: 25, maxSeconds: 120 });
      const dataset = await service.getDataset(created.dataset_id);
      if (dataset.status !== 'READY')
        throw new Error('public_smoke_dataset_not_ready');
      const exported = await service.exportDataset(dataset.id, exportRoot);
      const counts = await app
        .get(DatabaseService)
        .client.marketDatasetCandle.groupBy({
          by: ['stream'],
          where: { datasetId: dataset.id },
          _count: true,
        });
      const evidence = marketPublicValue({
        status: 'passed',
        source: api.source,
        dataset_id: dataset.id,
        download_id: created.download_id,
        requested_start_ms: start,
        requested_end_ms: start + 86400000,
        fingerprint: dataset.fingerprint,
        counts,
        quality: dataset.quality,
        files: exported.files,
        finished_at: new Date().toISOString(),
      });
      await fs.writeFile(
        evidencePath,
        JSON.stringify(evidence, null, 2) + '\n',
      );
      console.log(JSON.stringify(evidence, null, 2));
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const response = error instanceof HttpException ? error.getResponse() : null;
  const code =
    error instanceof BybitDataError
      ? error.code
      : response && typeof response === 'object' && 'code' in response
        ? response.code
        : 'market_command_failed';
  console.error(JSON.stringify({ status: 'failed', code }));
  process.exitCode = 1;
});
