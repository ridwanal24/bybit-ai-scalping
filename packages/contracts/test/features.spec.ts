import { describe, expect, it } from 'vitest';
import {
  FEATURE_IDS,
  FEATURE_FORMULAS,
  observationSchemaFor,
  researchPreset,
  normalizerSchema,
  observationContextSchema,
  observationResultSchema,
} from '../src/index.js';

describe('feature contracts', () => {
  it('covers the entire M2 catalog and declares the actual default dimension', () => {
    expect(Object.keys(FEATURE_FORMULAS)).toEqual([...FEATURE_IDS]);
    const vector = observationSchemaFor(researchPreset());
    expect(vector.schema.dimension).toBe(299);
    expect(vector.schema.market).toEqual(researchPreset().features.enabled);
    expect(vector.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each(['enabled', 'position_inputs', 'risk_inputs'] as const)(
    'pins %s ordering',
    (key) => {
      const c = researchPreset();
      c.features[key].reverse();
      expect(observationSchemaFor(c).sha256).not.toBe(
        observationSchemaFor(researchPreset()).sha256,
      );
    },
  );
  it('rejects declared shape mismatch and actual parameter overflow', () => {
    const c = researchPreset();
    c.network.input_dimension = 298;
    expect(() => observationSchemaFor(c)).toThrow('input_dimension_mismatch');
    c.network.input_dimension = null;
    c.features.observation_window = c.training.observation_window = 4096;
    c.training.episode_length_bars = 5000;
    expect(() => observationSchemaFor(c)).toThrow('parameter_budget_exceeded');
  });
  it('rejects nonfinite observations and unknown context fields', () => {
    expect(
      observationResultSchema.safeParse({
        valid: true,
        decision_ms: 0,
        schema_hash: '0'.repeat(64),
        normalizer_id: '0'.repeat(64),
        values: [Infinity],
      }).success,
    ).toBe(false);
    expect(
      observationContextSchema.safeParse({
        as_of_ms: 0,
        side: 'FLAT',
        arbitrary: true,
      }).success,
    ).toBe(false);
  });
  it('rejects noncanonical statistics shape and unknown normalizer version', () => {
    expect(
      normalizerSchema.safeParse({ version: '2', means: ['NaN'] }).success,
    ).toBe(false);
  });
});
