import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../src/config/environment.js';
import type { Environment } from '../src/config/environment.js';
import { HealthService } from '../src/health/health.service.js';
import { HealthController } from '../src/health/health.controller.js';
import { DatabaseService } from '../src/database/database.service.js';

const config = new ConfigService<Environment, true>(
  parseEnvironment({
    DATABASE_URL: 'postgresql://test:test@localhost/foundation',
    DATABASE_TIMEOUT_MS: 100,
  }),
);

function health(ready: () => Promise<boolean>) {
  return new HealthService({ ready } as DatabaseService, config);
}

afterEach(() => vi.useRealTimers());

describe('health behavior', () => {
  it('liveness does not invoke the database and ready responds on a valid marker', async () => {
    const ready = vi.fn().mockResolvedValue(true);
    const controller = new HealthController(health(ready));
    expect(controller.live()).toEqual({ status: 'ok', service: 'api' });
    expect(ready).not.toHaveBeenCalled();
    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      checks: { database: 'ok' },
    });
  });

  it.each([
    false,
    new Error('postgresql://bot:supersecret@private.example/database'),
  ])('sanitizes missing schema and dependency exceptions', async (failure) => {
    const service = health(async () => {
      if (failure instanceof Error) throw failure;
      return failure;
    });
    const controller = new HealthController(service);
    try {
      await controller.ready();
      throw new Error('Expected unavailable');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const exception = error as ServiceUnavailableException;
      expect(exception.getStatus()).toBe(503);
      expect(exception.getResponse()).toEqual({
        status: 'unavailable',
        checks: { database: 'unavailable' },
      });
    }
  });

  it('bounds readiness for a dependency that never resolves', async () => {
    vi.useFakeTimers();
    const promise = health(() => new Promise(() => {})).ready();
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
