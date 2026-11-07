import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { root, node, environment } from './common.mjs';
import { startDatabase, requireFreePort } from './database.mjs';
await requireFreePort(3000);
await requireFreePort(5173);
const db = await startDatabase();
const children = [];
function launch(args, env = {}) {
  const child = spawn(node, args, {
    cwd: root,
    env: environment(env),
    windowsHide: true,
    shell: false,
    stdio: 'inherit',
  });
  children.push(child);
  return child;
}
let stop;
const ended = new Promise((resolve) => {
  stop = resolve;
});
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
try {
  const api = launch([path.join(root, 'apps/api/dist/main.js')], {
    DATABASE_URL: db.url,
    HOST: '127.0.0.1',
    PORT: '3000',
  });
  const web = launch([
    path.join(root, 'node_modules/vite/bin/vite.js'),
    path.join(root, 'apps/web'),
    '--config',
    path.join(root, 'apps/web/vite.config.ts'),
  ]);
  api.once('close', () => stop());
  web.once('close', () => stop());
  console.log('Dashboard: http://127.0.0.1:5173 · API: http://127.0.0.1:3000');
  await ended;
} finally {
  for (const child of children) {
    if (child.exitCode === null) {
      const closed = new Promise((resolve) => child.once('close', resolve));
      child.kill();
      await Promise.race([closed, pause(3000)]);
    }
  }
  console.log(
    'Dashboard servers stopped. Project database remains available; use npm run db:stop when finished.',
  );
}
