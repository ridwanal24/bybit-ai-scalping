import { ConfigService } from '@nestjs/config';
import { createApplication } from './application.js';
import type { Environment } from './config/environment.js';

try {
  const app = await createApplication();
  const config = app.get(ConfigService<Environment, true>);
  await app.listen(
    config.get('PORT', { infer: true }),
    config.get('HOST', { infer: true }),
  );
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'api_started',
      timestamp_utc: new Date().toISOString(),
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'api_startup_failed',
      timestamp_utc: new Date().toISOString(),
    }),
  );
  process.exitCode = 1;
}
