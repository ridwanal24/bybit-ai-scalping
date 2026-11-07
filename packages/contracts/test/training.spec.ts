import { describe, expect, it } from 'vitest';
import {
  trainingResourcesSchema,
  trainingJobSchema,
  trainingSplitSchema,
} from '../src/index.js';

const resources = {
  cpu_threads: 1,
  max_wall_seconds: 180,
  max_memory_mb: 3072,
  max_timesteps: 1024,
  max_checkpoints: 8,
};
describe('training contracts', () => {
  it('requires explicit bounded CPU-only resources', () => {
    expect(trainingResourcesSchema.safeParse(resources).success).toBe(true);
    for (const change of [
      { cpu_threads: 2 },
      { max_memory_mb: 0 },
      { max_wall_seconds: 0 },
      { max_timesteps: 1000001 },
      { max_checkpoints: 100 },
    ])
      expect(
        trainingResourcesSchema.safeParse({ ...resources, ...change }).success,
      ).toBe(false);
  });
  it('keeps final holdout unevaluated', () => {
    const split = {
      version: 'chronological_70_15_15_v1',
      train: [0, 70],
      validation: [70, 85],
      holdout: [85, 100],
      interval_ms: 1,
      holdout_evaluated: false,
    };
    expect(trainingSplitSchema.safeParse(split).success).toBe(true);
    expect(
      trainingSplitSchema.safeParse({ ...split, holdout_evaluated: true })
        .success,
    ).toBe(false);
  });
  it.each([
    'QUEUED',
    'RUNNING',
    'CANCELLING',
    'SUCCEEDED',
    'CANCELLED',
    'FAILED',
    'RESOURCE_LIMIT',
    'INTERRUPTED',
  ])('exposes persistent state %s', (state) => {
    expect(trainingJobSchema.shape.state.safeParse(state).success).toBe(true);
  });
});
