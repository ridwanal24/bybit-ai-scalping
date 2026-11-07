import { describe, expect, it } from 'vitest';
import {
  rlRequestSchema,
  rlInfoSchema,
  rlTransitionSchema,
} from '../src/index.js';

describe('RL environment contracts', () => {
  it.each([0, 42, 4294967295])('accepts explicit seed %s', (seed) => {
    expect(rlRequestSchema.shape.seed.safeParse(seed).success).toBe(true);
  });
  it.each([true, -1, 4294967296, '42', 1.5])(
    'rejects invalid seed %s',
    (seed) => {
      expect(rlRequestSchema.shape.seed.safeParse(seed).success).toBe(false);
    },
  );
  it('requires HOLD availability and five ordered boolean masks', () => {
    const mask = rlInfoSchema.shape.action_mask;
    expect(mask.safeParse([true, false, false, false, false]).success).toBe(
      true,
    );
    expect(mask.safeParse([false, true, true, false, false]).success).toBe(
      false,
    );
    expect(mask.safeParse([1, 0, 0, 0, 0]).success).toBe(false);
    expect(mask.safeParse([true, false]).success).toBe(false);
  });
  it('uses discrete action IDs and versioned net-equity reward', () => {
    expect(
      rlInfoSchema.shape.reward_version.safeParse('net_equity_initial_v1')
        .success,
    ).toBe(true);
    expect(
      rlInfoSchema.shape.reward_version.safeParse('log_equity').success,
    ).toBe(false);
    expect(rlTransitionSchema.shape.action.safeParse(4).success).toBe(true);
    expect(rlTransitionSchema.shape.action.safeParse(5).success).toBe(false);
    expect(rlRequestSchema.shape.agent.safeParse('masked_random').success).toBe(
      true,
    );
    expect(rlRequestSchema.shape.agent.safeParse('train').success).toBe(false);
  });
});
