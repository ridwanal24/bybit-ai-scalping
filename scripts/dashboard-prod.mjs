import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, environment } from './common.mjs';
import { startDatabase, requireFreePort } from './database.mjs';

const apiEntry = path.join(root, 'apps/api/dist/application.js');
const webDirectory = path.join(root, 'apps/web/dist');
if (
  !fs.existsSync(apiEntry) ||
  !fs.existsSync(path.join(webDirectory, 'index.html'))
) {
  throw new Error(
    'Production build is missing. Run npm run build before start:dashboard.',
  );
}
await requireFreePort(3000);
const db = await startDatabase();
Object.assign(
  process.env,
  environment({
    NODE_ENV: 'production',
    DATABASE_URL: db.url,
    HOST: '127.0.0.1',
    PORT: '3000',
  }),
);

const { createApplication } = await import(pathToFileURL(apiEntry).href);
const app = await createApplication();
app.setGlobalPrefix('api');
app.useStaticAssets(webDirectory);
await app.listen(3000, '127.0.0.1');
console.log('Production dashboard: http://127.0.0.1:3000');
console.log('Readiness: http://127.0.0.1:3000/api/health/ready');
console.log(
  'Built UI and API share this server. Project DB remains running after shutdown; use npm run db:stop when finished.',
);
