import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
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
  await prisma(['generate']);
  await npm(['run', 'build', '-w', '@bybit/api']);
}

async function tests() {
  await npm(['run', 'test', '-w', '@bybit/api']);
  await run(python, ['-m', 'pytest', '-q'], { cwd: quant });
}

async function lint() {
  await run(node, [
    path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js'),
    'apps/api',
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
      'Foundation E2E: migration/reapply + ORM + HTTP API + Python subprocess passed.',
    );
  } finally {
    if (fs.existsSync(path.join(directory, 'owner.json')))
      await stopDatabase(directory);
  }
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
    for (let attempt = 0; attempt < 50; attempt++) {
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
    await run(node, [path.join(root, 'scripts', 'tasks.mjs'), task]);
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
      await prisma(['generate']);
      await npm(['run', 'typecheck', '-w', '@bybit/api']);
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
        await lint();
        await npm(['run', 'format:check']);
        await tests();
        await integration();
        report.status = 'passed';
      } finally {
        report.finished_at = new Date().toISOString();
        fs.writeFileSync(
          path.join(runtime, 'foundation-report.json'),
          JSON.stringify(report, null, 2) + '\n',
        );
      }
      console.log('Foundation verification PASSED');
      return;
    }
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
