import { z } from 'zod';
import { trainingResourcesSchema } from './training.js';
import { simulationPolicySchema } from './simulation.js';

export const dashboardStartSchema = z.strictObject({
  dataset_id: z.uuid(),
  snapshot_id: z.uuid(),
  range_start_ms: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  range_end_ms: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  ppo_epochs: z.number().int().min(1).max(10),
  resources: trainingResourcesSchema,
  policy: simulationPolicySchema,
});
export const dashboardProposalSchema = z.strictObject({
  model_id: z.string().regex(/^[0-9a-f]{64}$/),
  target: z.literal('backtest'),
  note: z.string().trim().min(8).max(500),
  acknowledge_research_only: z.literal(true),
});
export type DashboardStart = z.infer<typeof dashboardStartSchema>;
