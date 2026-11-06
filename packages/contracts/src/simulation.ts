import { z } from 'zod';

const timestamp = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const count = timestamp;
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const decimal = z
  .string()
  .max(300)
  .regex(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/);
const nonnegative = z
  .string()
  .max(300)
  .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/);
const side = z.enum(['FLAT', 'LONG', 'SHORT']);
export const simulationPolicySchema = z.strictObject({
  simulation_policy_version: z.literal('restricted_bar_v1'),
  acknowledge_research_only: z.literal(true),
  acknowledge_current_metadata: z.literal(true),
  acknowledge_declared_funding_schedule: z.literal(true),
  require_exchange_liquidation: z.literal(false),
  funding_price_proxy: z.literal('boundary_last_open'),
  execution_latency_ms: timestamp.max(600000),
  safety_reserve: nonnegative,
  funding_schedule: z
    .array(
      z.strictObject({
        start_ms: timestamp,
        end_ms: timestamp,
        interval_ms: timestamp.min(1),
        anchor_ms: timestamp,
      }),
    )
    .min(1)
    .max(1000),
});
export const simulationRequestSchema = z.strictObject({
  version: z.literal('1'),
  dataset_id: z.uuid(),
  configuration_file: z.string().min(1).max(4096),
  source_snapshot_file: z.string().min(1).max(4096).nullable(),
  normalizer_id: hash,
  actions_file: z.string().min(1).max(4096),
  episode_start_ms: timestamp,
  episode_end_ms: timestamp,
  policy: simulationPolicySchema,
});
export const simulationActionSchema = z.strictObject({
  decision_ms: timestamp,
  action: z.number().int().min(0).max(4),
});
export const simulationEventSchema = z.strictObject({
  seq: count.min(1),
  time_ms: timestamp,
  phase: z.enum(['decision', 'open', 'intrabar', 'close', 'terminal']),
  kind: z.enum([
    'intent',
    'rejected',
    'cancelled',
    'entry',
    'fee',
    'realized',
    'funding',
    'exit',
    'risk',
    'mark',
    'terminal',
  ]),
  reason: z.string().min(1).max(100),
  position_id: z.string().nullable(),
  intent_id: z.string().nullable(),
  side,
  quantity: nonnegative,
  price: nonnegative.nullable(),
  amount: decimal,
  wallet: decimal,
});
export const simulationTradeSchema = z.strictObject({
  position_id: z.string(),
  side: z.enum(['LONG', 'SHORT']),
  quantity: nonnegative,
  entry: nonnegative,
  exit: nonnegative,
  stop: nonnegative,
  take_profit: nonnegative.nullable(),
  opened_ms: timestamp,
  closed_ms: timestamp,
  reason: z.string(),
  gross_pnl: decimal,
  entry_fee: nonnegative,
  exit_fee: nonnegative,
  funding: decimal,
  net_pnl: decimal,
  target_rr: nonnegative.nullable(),
  gross_realized_rr: decimal,
  net_realized_rr: decimal,
  initial_risk_estimate: nonnegative,
});
export const simulationEquitySchema = z.strictObject({
  time_ms: timestamp,
  phase: z.enum(['open', 'intrabar', 'close', 'terminal']),
  wallet: decimal,
  equity: decimal,
  unrealized: decimal,
  initial_margin: nonnegative,
  available_margin: decimal,
  realized: decimal,
  fees: nonnegative,
  funding: decimal,
  side,
  quantity: nonnegative,
  reference_price: nonnegative,
  peak_equity: nonnegative,
  drawdown: nonnegative,
  day_start_equity: nonnegative,
  daily_latched: z.boolean(),
  drawdown_latched: z.boolean(),
});
export const simulationReportSchema = z.strictObject({
  version: z.literal('1'),
  status: z.enum(['completed_restricted', 'terminated_restricted', 'invalid']),
  reason: z.string(),
  termination: z.enum(['truncated', 'terminated', 'invalid']),
  simulation_policy_version: z.literal('restricted_bar_v1'),
  numeric_policy: z.literal('decimal128_currency18_adverse_v1'),
  initial_capital: nonnegative,
  final_wallet: decimal,
  final_equity: decimal,
  realized: decimal,
  fees: nonnegative,
  funding: decimal,
  net_equity_change: decimal,
  final_position: side,
  events: count,
  trades: count,
  equity_points: count,
  observations_valid: count,
  observations_unavailable: z.record(z.string(), count),
  rejections: z.record(z.string(), count),
  policy: simulationPolicySchema,
  execution_ready: z.literal(false),
  liquidation_model: z.literal('not_modeled_collateral_envelope_only'),
  historical_metadata: z.literal('current_observation_reference_only'),
  funding_schedule_validity: z.literal(
    'researcher_declared_not_exchange_verified',
  ),
});
export const simulationManifestSchema = z.strictObject({
  version: z.literal('1'),
  configuration_hash: hash,
  dataset_fingerprint: hash,
  configuration_snapshot_id: z.uuid(),
  source_configuration_hash: hash,
  normalizer_id: hash,
  feature_schema_hash: hash,
  code_fingerprint: hash,
  actions_sha256: hash,
  episode_start_ms: timestamp,
  episode_end_ms: timestamp,
  policy: simulationPolicySchema,
  files: z
    .array(
      z.strictObject({
        file: z.enum([
          'events.jsonl',
          'trades.jsonl',
          'equity.jsonl',
          'report.json',
          'descriptor.json',
        ]),
        sha256: hash,
        count,
      }),
    )
    .length(5),
});
export const SIMULATION_ACCOUNTING_VECTORS = [
  {
    name: 'long_profit',
    side: 1,
    quantity: '1',
    entry: '100',
    exit: '105',
    fee_rate: '0.001',
    entry_fee: '0.1',
    exit_fee: '0.105',
    gross_pnl: '5',
    final_wallet: '1004.795',
  },
  {
    name: 'short_profit',
    side: -1,
    quantity: '1',
    entry: '100',
    exit: '95',
    fee_rate: '0.001',
    entry_fee: '0.1',
    exit_fee: '0.095',
    gross_pnl: '5',
    final_wallet: '1004.805',
  },
  {
    name: 'long_loss',
    side: 1,
    quantity: '1',
    entry: '100',
    exit: '95',
    fee_rate: '0.001',
    entry_fee: '0.1',
    exit_fee: '0.095',
    gross_pnl: '-5',
    final_wallet: '994.805',
  },
  {
    name: 'short_loss',
    side: -1,
    quantity: '1',
    entry: '100',
    exit: '105',
    fee_rate: '0.001',
    entry_fee: '0.1',
    exit_fee: '0.105',
    gross_pnl: '-5',
    final_wallet: '994.795',
  },
];
export const SIMULATION_RISK_VECTORS = [
  {
    name: 'utc_daily_and_drawdown_latches',
    initial_capital: '1000',
    daily_loss_limit: '0.02',
    max_drawdown: '0.1',
    steps: [
      {
        time_ms: 1735689600000,
        equity: '1000',
        day_start_equity: '1000',
        daily_latched: false,
        drawdown_latched: false,
        remaining: '20',
      },
      {
        time_ms: 1735689660000,
        equity: '970',
        day_start_equity: '1000',
        daily_latched: true,
        drawdown_latched: false,
        remaining: '0',
      },
      {
        time_ms: 1735689720000,
        equity: '1000',
        day_start_equity: '1000',
        daily_latched: true,
        drawdown_latched: false,
        remaining: '20',
      },
      {
        time_ms: 1735776000000,
        equity: '1000',
        day_start_equity: '1000',
        daily_latched: false,
        drawdown_latched: false,
        remaining: '20',
      },
      {
        time_ms: 1735776060000,
        equity: '890',
        day_start_equity: '1000',
        daily_latched: true,
        drawdown_latched: true,
        remaining: '0',
      },
      {
        time_ms: 1735862400000,
        equity: '890',
        day_start_equity: '890',
        daily_latched: false,
        drawdown_latched: true,
        remaining: '17.8',
      },
    ],
  },
];
