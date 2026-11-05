import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service.js';
import type { Environment } from '../config/environment.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ConfigService)
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async ready(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.database.ready(),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(
            () => resolve(false),
            this.config.get('DATABASE_TIMEOUT_MS', { infer: true }),
          );
        }),
      ]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
