import { describe, expect, it } from 'vitest';
import {
  evaluationGatesSchema,
  evaluationRequestSchema,
  researchSplitSchema,
} from '../src/index.js';
describe('advanced evaluation contracts', () => {
  it('requires preregistered multi-seed/fold budgets', () => {
    expect(
      evaluationRequestSchema.shape.seeds.safeParse([42, 43, 44]).success,
    ).toBe(true);
    expect(evaluationRequestSchema.shape.seeds.safeParse([42]).success).toBe(
      false,
    );
    expect(evaluationRequestSchema.shape.folds.safeParse(1).success).toBe(
      false,
    );
    expect(
      evaluationRequestSchema.shape.suite_memory_mb.safeParse(999999).success,
    ).toBe(false);
  });
  it('does not silently lower research evidence thresholds', () => {
    expect(
      evaluationGatesSchema.shape.min_oos_ms.safeParse(2592000000).success,
    ).toBe(true);
    expect(evaluationGatesSchema.shape.min_oos_ms.safeParse(0).success).toBe(
      false,
    );
    expect(
      evaluationGatesSchema.shape.execution_ready.safeParse(true).success,
    ).toBe(false);
  });
  it('requires a purge and keeps holdout unevaluated in research folds', () => {
    expect(researchSplitSchema.shape.purge_bars.safeParse(0).success).toBe(
      false,
    );
    expect(
      researchSplitSchema.shape.holdout_evaluated.safeParse(true).success,
    ).toBe(false);
  });
});
