import { z } from 'zod';
import { simulationRequestSchema } from './simulation.js';

const hash = z.string().regex(/^[0-9a-f]{64}$/);
export const baselineStrategySchema = z.discriminatedUnion('name', [
  z.strictObject({ name: z.literal('hold') }),
  z.strictObject({
    name: z.literal('random'),
    seed: z.number().int().min(0).max(4294967295),
  }),
  z.strictObject({ name: z.literal('ema_crossover') }),
  z.strictObject({ name: z.literal('buy_hold') }),
]);
export const baselineRequestSchema = simulationRequestSchema
  .omit({ actions_file: true })
  .extend({
    strategies: z.array(baselineStrategySchema).min(1).max(32),
  });
const metric = z.union([
  z.strictObject({
    value: z
      .string()
      .max(300)
      .regex(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/),
    reason: z.null(),
  }),
  z.strictObject({ value: z.null(), reason: z.string().min(1).max(100) }),
]);
export const baselineMetricsSchema = z.strictObject({
  net_profit: metric,
  net_return: metric,
  max_drawdown: metric,
  profit_factor: metric,
  win_rate: metric,
  average_win: metric,
  average_loss: metric,
  expectancy: metric,
  average_holding_ms: metric,
  sampled_exposure: metric,
  fees: metric,
  funding: metric,
  slippage_cost: metric,
  sharpe: metric,
});
export const baselineComparisonSchema = z.strictObject({
  version: z.literal('1'),
  evaluator_version: z.literal('baseline_v1'),
  execution_ready: z.literal(false),
  status: z.enum(['completed_restricted', 'contains_invalid']),
  reference_policy: z.literal(
    'single_attempt_long_same_risk_stops_costs_no_reentry',
  ),
  exposure_policy: z.literal('fraction_of_open_samples_with_position'),
  ema_policy: z.literal(
    'm4_main_fast_slow_cross_close_then_enter_no_stop_reentry',
  ),
  results: z
    .array(
      z.strictObject({
        strategy: baselineStrategySchema,
        actions_sha256: hash,
        simulation_id: hash,
        status: z.enum([
          'completed_restricted',
          'terminated_restricted',
          'invalid',
        ]),
        total_trades: z.number().int().min(0),
        metrics: baselineMetricsSchema,
      }),
    )
    .min(1)
    .max(32),
});
