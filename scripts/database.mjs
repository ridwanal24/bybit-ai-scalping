import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { root, runtime, tools, run } from './common.mjs';

const bin = path.join(tools, 'postgres', 'bin');
const pg = (name) => path.join(bin, `${name}.exe`);

function insideRuntime(directory) {
  const relative = path.relative(runtime, path.resolve(directory));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Invalid runtime directory');
}

export async function requireFreePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () =>
      reject(
        new Error(
          `Loopback port ${port} unavailable; no existing process was stopped`,
        ),
      ),
    );
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

function owned(directory) {
  insideRuntime(directory);
  const markerPath = path.join(directory, 'owner.json');
  if (!fs.existsSync(markerPath))
    throw new Error('Unowned PostgreSQL directory; refusing operation');
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  if (marker.projectRoot !== root || marker.directory !== directory)
    throw new Error('PostgreSQL ownership mismatch');
  return marker;
}

export async function databaseStatus(
  directory = path.join(runtime, 'postgres'),
) {
  if (!fs.existsSync(directory)) return { running: false };
  const marker = owned(directory);
  const data = path.join(directory, 'data');
  const result = await run(pg('pg_ctl'), ['status', '-D', data], {
    capture: true,
    allowFailure: true,
  });
  if (result.code === 0) {
    const pidLines = fs
      .readFileSync(path.join(data, 'postmaster.pid'), 'utf8')
      .split(/\r?\n/);
    const options = fs.readFileSync(path.join(data, 'postmaster.opts'), 'utf8');
    if (
      path.resolve(pidLines[1]) !== path.resolve(data) ||
      Number(pidLines[3]) !== marker.port ||
      !options
        .toLowerCase()
        .includes(pg('postgres').replaceAll('\\', '/').toLowerCase())
    ) {
      throw new Error('PostgreSQL process identity mismatch');
    }
    return { running: true, port: marker.port, directory };
  }
  if (result.code !== 3 && result.code !== 4)
    throw new Error('Unable to determine PostgreSQL state');
  return { running: false, port: marker.port, directory };
}

export async function startDatabase({
  directory = path.join(runtime, 'postgres'),
  port = 55432,
  database = 'bybit_dev',
} = {}) {
  insideRuntime(directory);
  if (!/^[a-z][a-z0-9_]*$/.test(database))
    throw new Error('Invalid project database name');
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('Invalid database port');
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'owner.json'),
      JSON.stringify(
        {
          projectRoot: root,
          directory,
          port,
          password: crypto.randomBytes(24).toString('hex'),
        },
        null,
        2,
      ),
    );
  }
  const marker = owned(directory);
  if (marker.port !== port) throw new Error('Configured cluster port mismatch');
  const data = path.join(directory, 'data');
  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    if (fs.existsSync(data))
      throw new Error(
        'Incomplete/existing data directory; refusing automatic overwrite',
      );
    const passwordFile = path.join(directory, 'init-password');
    fs.writeFileSync(passwordFile, marker.password, { mode: 0o600 });
    try {
      await run(
        pg('initdb'),
        [
          '-D',
          data,
          '-U',
          'bybit',
          '--pwfile',
          passwordFile,
          '--auth-host=scram-sha-256',
          '--auth-local=scram-sha-256',
          '--encoding=UTF8',
          '--locale=C',
        ],
        { capture: true },
      );
    } finally {
      fs.rmSync(passwordFile, { force: true });
    }
    fs.appendFileSync(
      path.join(data, 'postgresql.conf'),
      `\nlisten_addresses = '127.0.0.1'\nport = ${port}\nmax_connections = 20\nshared_buffers = '64MB'\npassword_encryption = 'scram-sha-256'\n`,
    );
  }
  const current = await databaseStatus(directory);
  const started = !current.running;
  if (started) {
    await requireFreePort(port);
    // A server started by pg_ctl can inherit pipe handles on Windows. Use no
    // pipes here; otherwise Node's close event waits for the long-lived server.
    await run(
      pg('pg_ctl'),
      [
        'start',
        '-D',
        data,
        '-l',
        path.join(directory, 'server.log'),
        '-w',
        '-t',
        '30',
      ],
      { quiet: true },
    );
    await databaseStatus(directory);
  }
  const commonArgs = [
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'bybit',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ];
  const env = { PGPASSWORD: marker.password };
  const exists = await run(
    pg('psql'),
    [
      ...commonArgs,
      '-Atc',
      `SELECT 1 FROM pg_database WHERE datname = '${database}'`,
    ],
    { env, capture: true },
  );
  if (exists.stdout.trim() !== '1') {
    await run(
      pg('psql'),
      [...commonArgs, '-c', `CREATE DATABASE "${database}"`],
      { env, capture: true },
    );
  }
  return {
    directory,
    port,
    started,
    url: `postgresql://bybit:${marker.password}@127.0.0.1:${port}/${database}`,
  };
}

export async function stopDatabase(directory = path.join(runtime, 'postgres')) {
  if ((await databaseStatus(directory)).running) {
    await run(
      pg('pg_ctl'),
      [
        'stop',
        '-D',
        path.join(directory, 'data'),
        '-m',
        'fast',
        '-w',
        '-t',
        '30',
      ],
      { capture: true },
    );
  }
}
