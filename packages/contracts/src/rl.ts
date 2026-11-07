import { z } from 'zod';
import {
  simulationRequestSchema,
  simulationReportSchema,
} from './simulation.js';

const hash = z.string().regex(/^[0-9a-f]{64}$/);
const decimal = z
  .string()
  .max(300)
  .regex(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const rlRequestSchema = simulationRequestSchema
  .omit({ actions_file: true })
  .extend({
    seed: z.number().int().min(0).max(4294967295),
    agent: z.enum(['hold', 'masked_random']),
  });
export const rlInfoSchema = z.strictObject({
  version: z.literal('1'),
  environment_version: z.literal('restricted_gym_v1'),
  reward_version: z.literal('net_equity_initial_v1'),
  time_ms: count,
  steps: count,
  schema_hash: hash,
  normalizer_id: hash,
  observation_valid: z.boolean(),
  observation_reason: z.string().min(1).max(100).nullable(),
  action_mask: z.tuple([
    z.literal(true),
    z.boolean(),
    z.boolean(),
    z.boolean(),
    z.boolean(),
  ]),
  action_accepted: z.boolean().nullable(),
  equity: decimal,
  reward_decimal: decimal,
  cumulative_reward: decimal,
  status: z.enum([
    'running',
    'completed_restricted',
    'terminated_restricted',
    'invalid',
  ]),
  reason: z.string().min(1).max(100).nullable(),
  bootstrap_discount: z.union([z.literal(0), z.literal(1)]),
  learning_terminal: z.boolean(),
  raw_terminated: z.boolean(),
  raw_truncated: z.boolean(),
  report: simulationReportSchema.nullable(),
});
export const rlEpisodeSchema = z.strictObject({
  version: z.literal('1'),
  environment_version: z.literal('restricted_gym_v1'),
  reward_version: z.literal('net_equity_initial_v1'),
  runtime: z.strictObject({
    python: z.string().min(1).max(100),
    gymnasium: z.string().min(1).max(100),
    numpy: z.string().min(1).max(100),
  }),
  seed: z.number().int().min(0).max(4294967295),
  agent: z.enum(['hold', 'masked_random']),
  code_fingerprint: hash,
  dataset_fingerprint: hash,
  configuration_hash: hash,
  normalizer_id: hash,
  schema_hash: hash,
  simulation_id: hash,
  steps: count,
  total_reward: decimal,
  reward_float_sum: z.number(),
  terminated: z.boolean(),
  truncated: z.boolean(),
  bootstrap_discount: z.literal(0),
  report: simulationReportSchema,
});
export const rlTransitionSchema = z.strictObject({
  step: count.min(1),
  decision_ms: count,
  action: z.number().int().min(0).max(4),
  mask: z.tuple([
    z.literal(true),
    z.boolean(),
    z.boolean(),
    z.boolean(),
    z.boolean(),
  ]),
  accepted: z.boolean(),
  next_time_ms: count,
  observation_sha256: hash,
  next_observation_sha256: hash,
  previous_equity: decimal,
  equity: decimal,
  reward_decimal: decimal,
  terminated: z.boolean(),
  truncated: z.boolean(),
});
