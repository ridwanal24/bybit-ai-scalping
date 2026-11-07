import { z } from 'zod';
import { configurationSchema } from './schema.js';
import {
  simulationPolicySchema,
  simulationReportSchema,
} from './simulation.js';
import { baselineMetricsSchema } from './baselines.js';
import { trainingResourcesSchema, researchSplitSchema } from './training.js';

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const ablation = configurationSchema.shape.features.shape.enabled.element;
export const evaluationRequestSchema = z.strictObject({
  version: z.literal('1'),
  dataset_id: z.uuid(),
  configuration_file: z.string().min(1).max(4096),
  source_snapshot_file: z.string().min(1).max(4096).nullable(),
  policy: simulationPolicySchema,
  range_start_ms: count,
  range_end_ms: count,
  seeds: z.array(count.max(4294967295)).min(3).max(5),
  folds: count.min(2).max(4),
  purge_bars: count.min(1).max(60),
  ablation,
  train_timesteps: count.min(8).max(1000000),
  n_steps: count.min(8).max(2048),
  batch_size: count.min(2),
  ppo_epochs: count.min(1).max(10),
  resources: trainingResourcesSchema,
  max_new_trainings: count.min(1).max(40),
  max_total_train_steps: count.min(8).max(1000000),
  suite_wall_seconds: count.min(30).max(3600),
  suite_memory_mb: count.min(64).max(8192),
  legacy_model_id: hash.nullable(),
});
export const evaluationGatesSchema = z.strictObject({
  version: z.literal('research_screen_v1'),
  min_seeds: z.literal(3),
  min_folds: z.literal(2),
  min_oos_ms: z.literal(2592000000),
  min_trades_per_seed: z.literal(30),
  min_profit_factor: z.literal('1.1'),
  require_positive_all_seeds: z.literal(true),
  require_stress_positive: z.literal(true),
  require_beat_hold_ema: z.literal(true),
  require_no_risk_breach: z.literal(true),
  holdout_min_trades: z.literal(30),
  execution_ready: z.literal(false),
});
export const evaluationProtocolSchema = z.strictObject({
  version: z.literal('advanced_evaluation_v1'),
  request: evaluationRequestSchema.omit({
    configuration_file: true,
    source_snapshot_file: true,
  }),
  configuration: configurationSchema,
  source_snapshot: z.strictObject({
    id: z.uuid(),
    config_hash: hash,
    configuration: configurationSchema,
  }),
  dataset_fingerprint: hash,
  code_fingerprint: hash,
  folds: z.array(researchSplitSchema).min(2).max(4),
  gates: evaluationGatesSchema,
  planned_training_runs: count,
  planned_train_steps: count,
});
export const evaluationRowSchema = z.strictObject({
  group: z.enum(['primary', 'counterfactual', 'exploratory']),
  name: z.string().min(1).max(100),
  fold: count,
  seed: count,
  model_id: hash,
  configuration: configurationSchema,
  normalizer_id: hash,
  parameter_sha256: hash,
  action_sha256: hash,
  simulation_id: hash,
  report: simulationReportSchema,
  metrics: baselineMetricsSchema,
  risk_breaches: z.array(z.string()),
  deployment_compatible: z.boolean(),
});
export const evaluationScreenSchema = z.strictObject({
  eligible_for_frozen_holdout: z.boolean(),
  status: z.enum([
    'insufficient_evidence',
    'not_eligible',
    'research_screen_pass',
  ]),
  reasons: z.array(z.string()),
  gates: evaluationGatesSchema,
  execution_ready: z.literal(false),
  unique_oos_ms: count,
  per_seed: z.array(
    z.strictObject({
      seed: count,
      folds: count,
      trades: count,
      mean_return: z.string(),
      profit_factor: z.string().nullable(),
      worst_drawdown: z.string(),
    }),
  ),
  dispersion: z.strictObject({
    mean: z.string().nullable(),
    median: z.string().nullable(),
    sample_std: z.string().nullable(),
  }),
});
export const evaluationReportSchema = z.strictObject({
  version: z.literal('advanced_evaluation_v1'),
  protocol_id: hash,
  code_fingerprint: hash,
  rows: z.array(evaluationRowSchema),
  baselines: z.array(
    z.strictObject({ fold: count, seed: count, comparison_id: hash }),
  ),
  failures: z.array(
    z.strictObject({
      fold: count,
      seed: count,
      name: z.string(),
      error_type: z.string(),
    }),
  ),
  screen: evaluationScreenSchema,
  semantic_sha256: hash,
  legacy_review_id: hash.nullable(),
  status: z.enum(['completed_research', 'contains_failures']),
  execution_ready: z.literal(false),
});
