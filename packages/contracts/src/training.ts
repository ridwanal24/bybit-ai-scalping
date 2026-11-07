import { z } from 'zod';
import { configurationSchema } from './schema.js';
import {
  simulationRequestSchema,
  simulationPolicySchema,
  simulationReportSchema,
} from './simulation.js';
import { baselineMetricsSchema } from './baselines.js';

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const decimal = z
  .string()
  .max(300)
  .regex(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/);
const range = z.tuple([count, count]);
export const trainingSplitSchema = z.strictObject({
  version: z.literal('chronological_70_15_15_v1'),
  train: range,
  validation: range,
  holdout: range,
  interval_ms: count.min(1),
  holdout_evaluated: z.literal(false),
});
export const trainingResourcesSchema = z.strictObject({
  cpu_threads: z.literal(1),
  max_wall_seconds: z.number().int().min(1).max(3600),
  max_memory_mb: z.number().int().min(64).max(8192),
  max_timesteps: z.number().int().min(8).max(1000000),
  max_checkpoints: z.number().int().min(1).max(32),
});
export const trainingRequestSchema = simulationRequestSchema
  .omit({
    actions_file: true,
    normalizer_id: true,
    episode_start_ms: true,
    episode_end_ms: true,
  })
  .extend({
    range_start_ms: count,
    range_end_ms: count,
    ppo_epochs: z.number().int().min(1).max(10),
    checkpoint_every_rollouts: z.number().int().min(1).max(1000),
    resources: trainingResourcesSchema,
  });
export const trainingProgressSchema = z.strictObject({
  version: z.literal('1'),
  phase: z.enum([
    'preparing',
    'training',
    'validation',
    'publishing',
    'finished',
  ]),
  timesteps: count,
  total_timesteps: count.min(1),
  rollouts: count,
  episode_count: count,
  valid_actions: count,
  elapsed_seconds: z.number().min(0),
  rss_mb: z.number().min(0),
  metrics: z.record(z.string(), z.number()),
});
export const trainingJobSchema = z.strictObject({
  version: z.literal('1'),
  job_id: z.uuid(),
  state: z.enum([
    'QUEUED',
    'RUNNING',
    'CANCELLING',
    'SUCCEEDED',
    'CANCELLED',
    'FAILED',
    'RESOURCE_LIMIT',
    'INTERRUPTED',
  ]),
  created_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  supervisor_pid: count.nullable(),
  worker_pid: count.nullable(),
  reason: z.string().max(100).nullable(),
  model_id: hash.nullable(),
  progress: trainingProgressSchema.nullable(),
  usage: z
    .strictObject({
      elapsed_seconds: z.number().min(0),
      sampled_peak_rss_mb: z.number().min(0),
    })
    .nullable(),
});
export const trainingValidationSchema = z.strictObject({
  version: z.literal('1'),
  split: z.literal('validation'),
  start_ms: count,
  end_ms: count,
  steps: count.min(1),
  action_sha256: hash,
  parameter_sha256: hash,
  reward_sum: decimal,
  report: simulationReportSchema,
  simulation_id: hash,
  metrics: baselineMetricsSchema,
});
export const modelMetadataSchema = z.strictObject({
  version: z.literal('1'),
  status: z.literal('candidate_research_only'),
  execution_ready: z.literal(false),
  algorithm: z.literal('MaskablePPO'),
  policy: z.literal('MlpPolicy'),
  configuration: configurationSchema,
  configuration_hash: hash,
  dataset_id: z.uuid(),
  dataset_fingerprint: hash,
  configuration_snapshot_id: z.uuid(),
  source_configuration_hash: hash,
  split: trainingSplitSchema,
  normalizer_id: hash,
  feature_schema_hash: hash,
  action_schema: z.literal('hold-long-short-close_long-close_short-v1'),
  reward_version: z.literal('net_equity_initial_v1'),
  environment_version: z.literal('restricted_gym_v1'),
  bootstrap_policy: z.literal('settled_absorbing_v1'),
  simulation_policy: simulationPolicySchema,
  code_fingerprint: hash,
  git_commit: z.string().nullable(),
  git_dirty: z.boolean(),
  runtime: z.record(z.string(), z.string()),
  hardware: z.record(z.string(), z.string()),
  resources: trainingResourcesSchema,
  ppo_epochs: count.min(1),
  seed: count,
  timesteps: count,
  parameters: count.min(1),
  initial_parameter_sha256: hash,
  parameter_sha256: hash,
  validation_action_sha256: hash,
  job_id: z.uuid(),
  checkpoint_every_rollouts: count.min(1),
});
