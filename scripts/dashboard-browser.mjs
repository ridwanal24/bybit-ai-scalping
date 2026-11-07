import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { configurationHash } from '@bybit/contracts';
import { root, node, python, environment, run } from './common.mjs';

const target = new URL(process.env.DATABASE_URL ?? '');
if (
  target.hostname !== '127.0.0.1' ||
  target.port !== '55435' ||
  !/^\/bybit_dashboard_[a-z0-9_]+$/.test(target.pathname)
)
  throw new Error('Dedicated dashboard test database required');
const fixtureRoot = path.resolve(process.env.DASHBOARD_ROOT ?? '');
if (!fixtureRoot.startsWith(path.join(root, '.runtime') + path.sep))
  throw new Error('Dedicated dashboard test artifacts required');
const fixture = JSON.parse(
  await fs.readFile(path.join(fixtureRoot, 'fixture.json'), 'utf8'),
);
const protocol = fixture.protocol;
const c = protocol.configuration;
const source = protocol.source_snapshot;
const datasetId = protocol.request.dataset_id;
const exported = JSON.parse(
  await fs.readFile(
    path.join(fixtureRoot, 'artifacts/datasets', datasetId, 'manifest.json'),
    'utf8',
  ),
);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const sourceDraft = randomUUID();
  await pool.query(
    'INSERT INTO research_configurations(id,name,payload,schema_version,config_hash,provenance) VALUES($1,$2,$3,$4,$5,$6)',
    [
      sourceDraft,
      'Dashboard source fixture',
      source.configuration,
      '1',
      source.config_hash,
      { source: 'synthetic_dashboard_test' },
    ],
  );
  await pool.query(
    'INSERT INTO configuration_snapshots(id,source_configuration_id,source_revision,payload,schema_version,config_hash,provenance) VALUES($1,$2,1,$3,$4,$5,$6)',
    [
      source.id,
      sourceDraft,
      source.configuration,
      '1',
      source.config_hash,
      { source: 'synthetic_dashboard_test' },
    ],
  );
  const draftId = randomUUID();
  await pool.query(
    'INSERT INTO research_configurations(id,name,payload,schema_version,config_hash,provenance) VALUES($1,$2,$3,$4,$5,$6)',
    [
      draftId,
      'Dashboard fixture',
      c,
      '1',
      configurationHash(c),
      { source: 'synthetic_dashboard_test' },
    ],
  );
  const m = exported.manifest;
  const descriptor = {
    source: m.source,
    symbol: m.symbol,
    category: 'linear',
    configuration_hash: source.config_hash,
    start_ms: m.requested_start_ms,
    end_ms: m.requested_end_ms,
    streams: m.streams.map((s) => ({
      id: s.id,
      price_type: s.id.split(':')[0],
      timeframe: s.id.split(':')[1],
    })),
  };
  await pool.query(
    'INSERT INTO market_datasets(id,snapshot_id,request,status,sealed,quality,manifest,fingerprint,completed_at) VALUES($1,$2,$3,$4,true,$5,$6,$7,CURRENT_TIMESTAMP)',
    [
      datasetId,
      source.id,
      descriptor,
      'READY',
      exported.quality,
      m,
      exported.fingerprint,
    ],
  );
} finally {
  await pool.end();
}
const children = [];
function launch(args, env = {}) {
  const child = spawn(node, args, {
    cwd: root,
    env: environment(env),
    windowsHide: true,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  return child;
}
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* startup */
    }
    await pause(200);
  }
  throw new Error('Dashboard test server failed to start');
}
try {
  launch([path.join(root, 'apps/api/dist/main.js')], {
    HOST: '127.0.0.1',
    PORT: '3001',
  });
  launch(
    [
      path.join(root, 'node_modules/vite/bin/vite.js'),
      path.join(root, 'apps/web'),
      '--config',
      path.join(root, 'apps/web/vite.config.ts'),
      '--host',
      '127.0.0.1',
      '--port',
      '5174',
      '--strictPort',
    ],
    { DASHBOARD_API_URL: 'http://127.0.0.1:3001' },
  );
  await ready('http://127.0.0.1:3001/health/ready');
  await ready('http://127.0.0.1:5174');
  await run(
    node,
    [
      path.join(root, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config',
      path.join(root, 'apps/web/playwright.config.ts'),
    ],
    {
      env: {
        DASHBOARD_TEST_URL: 'http://127.0.0.1:5174',
        DASHBOARD_TEST_API: 'http://127.0.0.1:3001',
        DASHBOARD_TEST_REPORT: fixture.report_id,
        DASHBOARD_TEST_DATASET: datasetId,
        DASHBOARD_TEST_ROOT: fixtureRoot,
      },
    },
  );
  console.log(
    'Dashboard browser/HTTP integration passed against isolated PostgreSQL and verified synthetic artifacts.',
  );
} finally {
  const active = path.join(fixtureRoot, 'artifacts/training-jobs/active.json');
  try {
    const value = JSON.parse(await fs.readFile(active, 'utf8'));
    await run(
      python,
      [
        '-m',
        'bybit_quant',
        'training-cancel',
        '--root',
        fixtureRoot,
        '--job',
        value.job_id,
      ],
      { capture: true, allowFailure: true },
    );
  } catch (error) {
    if (error.code !== 'ENOENT')
      console.log(
        'Inspect managed test job cleanup before reusing the fixture.',
      );
  }
  for (const child of children) {
    if (child.exitCode === null) {
      const ended = new Promise((resolve) => child.once('close', resolve));
      child.kill();
      await Promise.race([ended, pause(3000)]);
    }
  }
}
