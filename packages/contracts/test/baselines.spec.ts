import { describe, expect, it } from 'vitest';
import { baselineStrategySchema, baselineRequestSchema } from '../src/index.js';

describe('baseline contracts', () => {
  it.each(['hold', 'ema_crossover', 'buy_hold'])(
    'accepts %s without hidden parameters',
    (name) => {
      expect(baselineStrategySchema.safeParse({ name }).success).toBe(true);
      expect(baselineStrategySchema.safeParse({ name, seed: 42 }).success).toBe(
        false,
      );
    },
  );
  it.each([0, 42, 4294967295])('accepts explicit random seed %s', (seed) => {
    expect(
      baselineStrategySchema.safeParse({ name: 'random', seed }).success,
    ).toBe(true);
  });
  it.each([undefined, -1, true, '42', 1.5, 4294967296])(
    'rejects invalid seed %s',
    (seed) => {
      expect(
        baselineStrategySchema.safeParse({ name: 'random', seed }).success,
      ).toBe(false);
    },
  );
  it('requires an explicit nonempty bounded strategy list', () => {
    const strategies = baselineRequestSchema.shape.strategies;
    expect(strategies.safeParse([]).success).toBe(false);
    expect(strategies.safeParse([{ name: 'hold' }]).success).toBe(true);
    expect(
      strategies.safeParse(Array.from({ length: 33 }, () => ({ name: 'hold' })))
        .success,
    ).toBe(false);
  });
});
