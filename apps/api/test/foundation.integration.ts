import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { parseEnvironment } from '../src/config/environment.js';
import type { Environment } from '../src/config/environment.js';

const testUrl = process.env.FOUNDATION_TEST_DATABASE_URL;
if (!testUrl || testUrl !== process.env.DATABASE_URL)
  throw new Error('Dedicated integration database required');
const target = new URL(testUrl);
if (
  target.hostname !== '127.0.0.1' ||
  target.port !== '55433' ||
  !/^\/bybit_test_[a-z0-9_]+$/.test(target.pathname)
) {
  throw new Error('Refusing integration against a non-test database');
}

describe('foundation PostgreSQL and HTTP integration', () => {
  let app: INestApplication;
  let database: DatabaseService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    database = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves real HTTP liveness and migrated readiness through Nest DI', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200, { status: 'ok', service: 'api' });
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200, { status: 'ok', checks: { database: 'ok' } });
    expect(
      await database.client.appMetadata.count({
        where: { key: 'foundation_schema_version' },
      }),
    ).toBe(1);
  });

  it('writes and rolls back an ORM transaction without leaving metadata', async () => {
    const key = 'integration_rollback_probe';
    await expect(
      database.client.$transaction(async (tx) => {
        await tx.appMetadata.create({ data: { key, value: 'temporary' } });
        expect(
          (await tx.appMetadata.findUnique({ where: { key } }))?.value,
        ).toBe('temporary');
        throw new Error('rollback-probe');
      }),
    ).rejects.toThrow('rollback-probe');
    expect(
      await database.client.appMetadata.findUnique({ where: { key } }),
    ).toBeNull();
  });

  it('returns 503 when migrated metadata is not a compatible version', async () => {
    await database.client.appMetadata.update({
      where: { key: 'foundation_schema_version' },
      data: { value: 'unsupported' },
    });
    try {
      await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503, {
          status: 'unavailable',
          checks: { database: 'unavailable' },
        });
    } finally {
      await database.client.appMetadata.update({
        where: { key: 'foundation_schema_version' },
        data: { value: '1' },
      });
    }
  });

  it('returns bounded sanitized 503 for an unreachable database while liveness remains 200', async () => {
    const invalidUrl = 'postgresql://bot:do_not_leak@127.0.0.1:1/unreachable';
    const config = new ConfigService<Environment, true>(
      parseEnvironment({ DATABASE_URL: invalidUrl, DATABASE_TIMEOUT_MS: 100 }),
    );
    const failedDatabase = new DatabaseService(config);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue(failedDatabase)
      .compile();
    const failedApp = module.createNestApplication({ logger: false });
    await failedApp.init();
    try {
      const start = Date.now();
      const response = await request(failedApp.getHttpServer())
        .get('/health/ready')
        .expect(503);
      expect(Date.now() - start).toBeLessThan(2000);
      expect(JSON.stringify(response.body)).not.toContain('do_not_leak');
      expect(response.body).toEqual({
        status: 'unavailable',
        checks: { database: 'unavailable' },
      });
      await request(failedApp.getHttpServer()).get('/health/live').expect(200);
    } finally {
      await failedApp.close();
    }
  });
});
