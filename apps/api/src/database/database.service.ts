import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Environment } from '../config/environment.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    const timeout = config.get('DATABASE_TIMEOUT_MS', { infer: true });
    const adapter = new PrismaPg({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: timeout,
      query_timeout: timeout,
      statement_timeout: timeout,
      max: 3,
    });
    this.client = new PrismaClient({ adapter, log: [] });
  }

  async ready(): Promise<boolean> {
    const markers = await this.client.appMetadata.findMany({
      where: {
        key: {
          in: ['foundation_schema_version', 'configuration_schema_version'],
        },
      },
    });
    return (
      markers.length === 2 && markers.every((marker) => marker.value === '1')
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
