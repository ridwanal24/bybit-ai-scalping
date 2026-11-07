import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  root,
  tools,
  runtime,
  node,
  uv,
  python,
  quant,
  api,
  toolchain,
  run,
  npm,
  prisma,
  environment,
} from './common.mjs';
import {
  startDatabase,
  stopDatabase,
  databaseStatus,
  requireFreePort,
} from './database.mjs';

const task = process.argv[2];
const envPath = path.join(root, '.env');

async function setup() {
  await npm([
    fs.existsSync(path.join(root, 'package-lock.json')) ? 'ci' : 'install',
  ]);
  await run(uv, ['python', 'install', toolchain.python]);
  if (!fs.existsSync(path.join(quant, 'uv.lock')))
    await run(uv, ['lock'], { cwd: quant });
  await run(uv, ['sync', '--locked'], { cwd: quant });
  await buildContracts();
  const db = await startDatabase();
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(
      envPath,
      `NODE_ENV=development\nHOST=127.0.0.1\nPORT=3000\nDATABASE_URL=${db.url}\nDATABASE_TIMEOUT_MS=2000\nPYTHON_PATH=services/quant/.venv/Scripts/python.exe\n`,
      { mode: 0o600 },
    );
  }
  await prisma(['generate']);
  await prisma(['migrate', 'deploy']);
  console.log('Setup complete. Development database is running on loopback.');
}

async function build() {
  await buildContracts();
  await prisma(['generate']);
  await npm(['run', 'build', '-w', '@bybit/api']);
}

async function tests() {
  fs.mkdirSync(path.join(runtime, 'pytest'), { recursive: true });
  await npm(['run', 'test', '-w', '@bybit/contracts']);
  await npm(['run', 'test', '-w', '@bybit/api']);
  await run(
    python,
    [
      '-m',
      'pytest',
      '-q',
      '--basetemp',
      path.join(runtime, 'pytest', `${Date.now()}_${process.pid}`),
    ],
    { cwd: quant },
  );
}

async function lint() {
  await run(node, [
    path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js'),
    'apps/api',
    'packages/contracts',
    'scripts',
    'eslint.config.mjs',
  ]);
  await run(uv, ['run', '--locked', '--no-sync', 'ruff', 'check', '.'], {
    cwd: quant,
  });
  await run(
    uv,
    ['run', '--locked', '--no-sync', 'ruff', 'format', '--check', '.'],
    { cwd: quant },
  );
}

async function integration() {
  const suffix = Date.now().toString(36) + '_' + process.pid;
  const directory = path.join(runtime, 'integration', suffix);
  let db;
  try {
    db = await startDatabase({
      directory,
      port: 55433,
      database: `bybit_test_${suffix}`,
    });
    const env = {
      DATABASE_URL: db.url,
      FOUNDATION_TEST_DATABASE_URL: db.url,
      NODE_ENV: 'test',
      DATABASE_TIMEOUT_MS: '500',
    };
    await apiSmoke(db.url, 503);
    await prisma(['migrate', 'deploy'], env);
    await prisma(['migrate', 'deploy'], env);
    await upgradeFromM1(directory, suffix);
    await upgradeFromM2(directory, suffix);
    await npm(['run', 'test:integration', '-w', '@bybit/api'], { env });
    await apiSmoke(db.url);
    const invalid = await run(node, [path.join(api, 'dist', 'main.js')], {
      env: { ...env, DATABASE_URL: '' },
      capture: true,
      allowFailure: true,
    });
    if (invalid.code === 0)
      throw new Error('Invalid API environment did not fail startup');
    const result = await run(python, ['-m', 'bybit_quant', 'health'], {
      cwd: root,
      capture: true,
    });
    const health = JSON.parse(result.stdout);
    if (health.status !== 'ok' || !health.python.startsWith('3.12.'))
      throw new Error('Python subprocess smoke failed');
    console.log(
      'Foundation/configuration E2E: fresh + M1 upgrade migrations, ORM/HTTP APIs and Python subprocess passed.',
    );
  } finally {
    if (fs.existsSync(path.join(directory, 'owner.json')))
      await stopDatabase(directory);
  }
}

async function buildContracts() {
  await npm(['run', 'build', '-w', '@bybit/contracts']);
  await npm(['run', 'export:check', '-w', '@bybit/contracts']);
}

async function upgradeFromM1(directory, suffix) {
  const upgrade = await startDatabase({
    directory,
    port: 55433,
    database: `bybit_test_${suffix}_upgrade`,
  });
  const migrations = path.join(directory, 'm1-migrations');
  const migrationName = '202611050001_foundation';
  fs.mkdirSync(path.join(migrations, migrationName), { recursive: true });
  fs.copyFileSync(
    path.join(api, 'prisma', 'migrations', migrationName, 'migration.sql'),
    path.join(migrations, migrationName, 'migration.sql'),
  );
  fs.copyFileSync(
    path.join(api, 'prisma', 'migrations', 'migration_lock.toml'),
    path.join(migrations, 'migration_lock.toml'),
  );
  const config = path.join(directory, 'm1.config.mjs');
  const configImport = pathToFileURL(
    path.join(root, 'node_modules', 'prisma', 'config.js'),
  ).href;
  fs.writeFileSync(
    config,
    `import { defineConfig } from ${JSON.stringify(configImport)};\nexport default defineConfig({ schema: ${JSON.stringify(path.join(api, 'prisma', 'schema.prisma'))}, migrations: { path: ${JSON.stringify(migrations)} }, datasource: { url: process.env.DATABASE_URL } });\n`,
  );
  await prisma(['migrate', 'deploy', '--config', config], {
    DATABASE_URL: upgrade.url,
  });
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: upgrade.url,
    connectionTimeoutMillis: 2000,
  });
  await client.connect();
  try {
    await client.query(
      "INSERT INTO app_metadata(key, value) VALUES ('upgrade_probe', 'preserve-v1')",
    );
    await apiSmoke(upgrade.url, 503);
    await prisma(['migrate', 'deploy'], { DATABASE_URL: upgrade.url });
    const result = await client.query(
      "SELECT key, value FROM app_metadata WHERE key IN ('upgrade_probe', 'foundation_schema_version', 'configuration_schema_version')",
    );
    const markers = Object.fromEntries(
      result.rows.map((row) => [row.key, row.value]),
    );
    if (
      markers.upgrade_probe !== 'preserve-v1' ||
      markers.foundation_schema_version !== '1' ||
      markers.configuration_schema_version !== '1'
    )
      throw new Error('M1 upgrade failed to preserve data/schema markers');
    await apiSmoke(upgrade.url);
  } finally {
    await client.end();
  }
  console.log(
    'M1 -> M2 additive upgrade preserved existing data and schema markers.',
  );
  await prisma(
    [
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    { DATABASE_URL: upgrade.url },
  );
}

async function upgradeFromM2(directory, suffix) {
  const upgrade = await startDatabase({
    directory,
    port: 55433,
    database: `bybit_test_${suffix}_m2upgrade`,
  });
  const migrations = path.join(directory, 'm2-migrations');
  for (const name of [
    '202611050001_foundation',
    '202611050002_configuration',
  ]) {
    fs.mkdirSync(path.join(migrations, name), { recursive: true });
    fs.copyFileSync(
      path.join(api, 'prisma', 'migrations', name, 'migration.sql'),
      path.join(migrations, name, 'migration.sql'),
    );
  }
  fs.copyFileSync(
    path.join(api, 'prisma', 'migrations', 'migration_lock.toml'),
    path.join(migrations, 'migration_lock.toml'),
  );
  const config = path.join(directory, 'm2.config.mjs');
  const configImport = pathToFileURL(
    path.join(root, 'node_modules', 'prisma', 'config.js'),
  ).href;
  fs.writeFileSync(
    config,
    `import { defineConfig } from ${JSON.stringify(configImport)};\nexport default defineConfig({ schema: ${JSON.stringify(path.join(api, 'prisma', 'schema.prisma'))}, migrations: { path: ${JSON.stringify(migrations)} }, datasource: { url: process.env.DATABASE_URL } });\n`,
  );
  await prisma(['migrate', 'deploy', '--config', config], {
    DATABASE_URL: upgrade.url,
  });
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: upgrade.url,
    connectionTimeoutMillis: 2000,
  });
  await client.connect();
  try {
    const draftId = '00000000-0000-4000-8000-000000000003';
    await client.query(
      "INSERT INTO research_configurations(id,name,payload,schema_version,revision,config_hash,provenance) VALUES ($1,'upgrade sentinel','{}','sentinel',1,$2,'{}')",
      [draftId, 'a'.repeat(64)],
    );
    await apiSmoke(upgrade.url, 503);
    await prisma(['migrate', 'deploy'], { DATABASE_URL: upgrade.url });
    const result = await client.query(
      'SELECT name,revision FROM research_configurations WHERE id=$1',
      [draftId],
    );
    if (
      result.rows[0]?.name !== 'upgrade sentinel' ||
      result.rows[0]?.revision !== 1
    )
      throw new Error('M2 upgrade lost existing configuration');
    await apiSmoke(upgrade.url);
    await prisma(
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      { DATABASE_URL: upgrade.url },
    );
  } finally {
    await client.end();
  }
  console.log(
    'M2 -> M3 additive upgrade preserved configuration data without schema drift.',
  );
}

async function apiSmoke(url, expectedStatus = 200) {
  const port = 53001;
  await requireFreePort(port);
  const logDir = path.join(runtime, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const fd = fs.openSync(path.join(logDir, 'api-smoke.log'), 'a');
  const child = spawn(node, [path.join(api, 'dist', 'main.js')], {
    cwd: root,
    windowsHide: true,
    shell: false,
    env: environment({
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_URL: url,
      DATABASE_TIMEOUT_MS: '500',
    }),
    stdio: ['ignore', fd, fd],
  });
  const exited = new Promise((resolve) => {
    child.once('error', resolve);
    child.once('close', resolve);
  });
  try {
    let ready = false;
    const startupDeadline = Date.now() + 30000;
    while (Date.now() < startupDeadline) {
      if (child.exitCode !== null)
        throw new Error('Built API exited before health check');
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health/ready`, {
          signal: AbortSignal.timeout(1000),
        });
        if (
          response.status === expectedStatus &&
          (await response.json()).status ===
            (expectedStatus === 200 ? 'ok' : 'unavailable')
        ) {
          ready = true;
          break;
        }
      } catch {
        /* wait for startup */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('Built API readiness smoke failed');
    const live = await fetch(`http://127.0.0.1:${port}/health/live`, {
      signal: AbortSignal.timeout(1000),
    });
    if (live.status !== 200) throw new Error('Built API liveness smoke failed');
  } finally {
    if (child.exitCode === null) child.kill();
    await exited;
    fs.closeSync(fd);
  }
}

async function main() {
  if (!task) throw new Error('Task required');
  if (
    task === 'setup' &&
    ['node/node.exe', 'uv/uv.exe', 'postgres/bin/postgres.exe'].some(
      (file) => !fs.existsSync(path.join(tools, file)),
    )
  ) {
    await run('python', [path.join(root, 'scripts', 'bootstrap.py')]);
  }
  if (!fs.existsSync(node))
    throw new Error('Run python scripts/bootstrap.py first');
  if (
    path.resolve(process.execPath).toLowerCase() !==
    path.resolve(node).toLowerCase()
  ) {
    await run(node, [
      path.join(root, 'scripts', 'tasks.mjs'),
      task,
      ...process.argv.slice(3),
    ]);
    return;
  }
  switch (task) {
    case 'setup':
      return setup();
    case 'db:start':
      await startDatabase();
      console.log('Project database running on 127.0.0.1:55432');
      return;
    case 'db:stop':
      await stopDatabase();
      console.log('Project database stopped');
      return;
    case 'db:status':
      console.log(JSON.stringify(await databaseStatus()));
      return;
    case 'db:migrate':
      await prisma(['migrate', 'deploy']);
      return;
    case 'build':
      return build();
    case 'typecheck':
      await buildContracts();
      await prisma(['generate']);
      await npm(['run', 'typecheck', '-w', '@bybit/api']);
      await npm(['run', 'typecheck', '-w', '@bybit/contracts']);
      return;
    case 'lint':
      return lint();
    case 'test':
      return tests();
    case 'integration':
      await build();
      return integration();
    case 'dev:api':
      await build();
      await run(node, ['--watch', path.join(api, 'dist', 'main.js')]);
      return;
    case 'contracts:export':
      await npm(['run', 'build', '-w', '@bybit/contracts']);
      await npm(['run', 'export', '-w', '@bybit/contracts']);
      return;
    case 'verify:configuration':
    case 'verify:simulation':
    case 'verify:baselines':
    case 'verify:features':
    case 'verify:market-data':
    case 'verify': {
      const startedAt = new Date().toISOString();
      const report = {
        started_at: startedAt,
        node: process.version,
        status: 'failed',
      };
      fs.mkdirSync(runtime, { recursive: true });
      try {
        await build();
        await npm(['run', 'typecheck', '-w', '@bybit/api']);
        await npm(['run', 'typecheck', '-w', '@bybit/contracts']);
        await lint();
        await npm(['run', 'format:check']);
        await tests();
        await integration();
        report.status = 'passed';
      } finally {
        report.finished_at = new Date().toISOString();
        fs.writeFileSync(
          path.join(
            runtime,
            task === 'verify:baselines'
              ? 'baselines-report.json'
              : task === 'verify:simulation'
                ? 'simulation-report.json'
                : task === 'verify:features'
                  ? 'features-report.json'
                  : task === 'verify:market-data'
                    ? 'market-data-report.json'
                    : task === 'verify:configuration'
                      ? 'configuration-report.json'
                      : 'foundation-report.json',
          ),
          JSON.stringify(report, null, 2) + '\n',
        );
      }
      console.log('Foundation/configuration verification PASSED');
      return;
    }
    case 'data:download':
    case 'data:export':
    case 'smoke:bybit-data':
      await build();
      await run(node, [
        path.join(api, 'dist', 'market-data', 'cli.js'),
        task === 'data:download'
          ? 'download'
          : task === 'data:export'
            ? 'export'
            : 'smoke',
        ...process.argv.slice(3),
      ]);
      return;
    case 'features:fit':
    case 'features:build':
    case 'simulation:run':
    case 'baseline:run':
      await buildContracts();
      await run(python, [
        '-m',
        'bybit_quant',
        task.replace(':', '-'),
        ...process.argv.slice(3),
      ]);
      return;
    default:
      throw new Error('Unknown task');
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Foundation command failed',
  );
  process.exitCode = 1;
});
