import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../src/config/environment.js';

const valid = {
  DATABASE_URL: 'postgresql://bot:secret@127.0.0.1:55432/foundation',
};

describe('environment configuration', () => {
  it('uses loopback defaults and coerces valid numeric strings', () => {
    expect(parseEnvironment({ ...valid, PORT: '3100' })).toMatchObject({
      HOST: '127.0.0.1',
      PORT: 3100,
      DATABASE_TIMEOUT_MS: 2000,
    });
  });

  it.each([
    { DATABASE_URL: undefined },
    { DATABASE_URL: 'https://bot:supersecret@example.com/foundation' },
    { DATABASE_URL: 'postgresql://localhost' },
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: '3000.5' },
    { PORT: 'abc' },
    { DATABASE_TIMEOUT_MS: '99' },
    { NODE_ENV: 'demo' },
    { HOST: '0.0.0.0' },
    { PYTHON_PATH: '' },
  ])(
    'rejects invalid config without reflecting secret values: %o',
    (invalid) => {
      expect(() => parseEnvironment({ ...valid, ...invalid })).toThrow(
        'Invalid environment fields:',
      );
      try {
        parseEnvironment({ ...valid, ...invalid });
      } catch (error) {
        expect((error as Error).message).not.toMatch(
          /secret|postgresql:\/\/|example.com/,
        );
      }
    },
  );
});
