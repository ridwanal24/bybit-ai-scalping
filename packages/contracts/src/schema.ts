import { z } from 'zod';

export const TIMEFRAMES = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  '1D',
] as const;
export const INTERVAL_MS: Record<(typeof TIMEFRAMES)[number], number> = {
  '1m': 60000,
  '3m': 180000,
  '5m': 300000,
  '15m': 900000,
  '30m': 1800000,
  '1h': 3600000,
  '4h': 14400000,
  '1D': 86400000,
};
export const FEATURE_IDS = [
  'log_return',
  'percentage_return',
  'body_ratio',
  'upper_wick_ratio',
  'lower_wick_ratio',
  'range_fraction',
  'close_location',
  'rolling_return',
  'ema_fast_distance',
  'ema_slow_distance',
  'ema_long_distance',
  'ema_spread',
  'ema_slope',
  'rsi',
  'macd_line',
  'macd_signal',
  'macd_histogram',
  'atr',
  'atr_fraction',
  'volatility',
  'volume_change',
  'relative_volume',
  'volume_ma_ratio',
] as const;
export const POSITION_IDS = [
  'side',
  'unrealized_pnl',
  'duration',
  'distance_to_sl',
  'distance_to_tp',
  'exposure',
  'available_margin',
] as const;
export const RISK_IDS = [
  'drawdown',
  'remaining_daily_budget',
  'trading_allowed',
  'risk_fraction',
] as const;
export const NETWORK_PRESETS = {
  Small: [64, 64],
  Medium: [128, 64],
  Large: [256, 128, 64],
} as const;
export const MAX_CONFIG_BYTES = 65536;
const positiveInt = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const nonnegativeInt = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const decimal = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,17})(\.[0-9]{1,18})?$/);
const signedDecimal = z
  .string()
  .regex(/^(?!-0(?:\.0+)?$)-?(0|[1-9][0-9]{0,17})(\.[0-9]{1,18})?$/);
const timeframe = z.enum(TIMEFRAMES);
const reference = z.enum(['last', 'mark', 'index']);
const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.:/-]+$/);
const layers = z.array(z.number().int().min(1).max(1024)).min(1).max(8);

/** Structural schema only. Semantic rules intentionally live in validation.ts. */
export const configurationSchema = z.strictObject({
  schema_version: z.literal('1'),
  contract_version: z.literal('1'),
  action_schema_version: z.literal('1'),
  market: z.strictObject({
    exchange: z.literal('bybit'),
    category: z.literal('linear'),
    settlement: z.literal('USDT'),
    symbol: z
      .string()
      .min(5)
      .max(30)
      .regex(/^[A-Z0-9]+USDT$/),
    timeframe,
    secondary_timeframes: z.array(timeframe).max(7),
    historical_start_ms: nonnegativeInt,
    historical_end_ms: nonnegativeInt,
    mode: z.enum(['backtest', 'paper', 'demo', 'real']),
  }),
  risk: z.strictObject({
    initial_capital: decimal,
    risk_per_trade: decimal,
    max_leverage: positiveInt,
    max_position_notional: decimal,
    max_margin_fraction: decimal,
    max_concurrent_positions: z.literal(1),
    daily_loss_limit: decimal,
    max_drawdown: decimal,
    cooldown_bars: nonnegativeInt,
    max_holding_bars: positiveInt,
    min_available_margin: decimal,
    semantics_version: z.literal('equity-utc-latched-v1'),
    daily_basis: z.literal('equity_including_unrealized'),
    daily_reset_timezone: z.literal('UTC'),
    drawdown_reference: z.literal('run_deployment_high_water_equity'),
    breach_action: z.literal(
      'block_entries_and_controlled_close_owned_positions',
    ),
    external_cashflow_policy: z.literal('block_and_review_anchor'),
  }),
  stop_loss: z.strictObject({
    hard_stop_required: z.literal(true),
    method: z.literal('atr'),
    atr_period: positiveInt,
    atr_multiplier: decimal,
    min_stop_fraction: decimal,
    max_stop_fraction: decimal,
    trigger_reference: reference,
    fee_allowance_rate: decimal,
    slippage_allowance_bps: decimal,
  }),
  exit: z.strictObject({
    mode: z.enum(['AI_EXIT', 'FIXED_RR', 'HYBRID']),
    fixed_tp_enabled: z.boolean(),
    ai_close_enabled: z.boolean(),
    rr: decimal.nullable(),
  }),
  execution: z.strictObject({
    assumptions_label: z.literal('synthetic_research_assumptions'),
    maker_fee_rate: signedDecimal,
    taker_fee_rate: decimal,
    spread_bps: decimal,
    slippage_bps: decimal,
    funding: z.strictObject({
      mode: z.enum(['historical', 'fixed_rate']),
      rate: signedDecimal.nullable(),
    }),
    order_type: z.enum(['market', 'limit']),
    timeout_ms: z.number().int().min(100).max(30000),
    stop_trigger_reference: reference,
  }),
  features: z.strictObject({
    catalog_version: z.literal('1'),
    enabled: z
      .array(z.strictObject({ id: z.enum(FEATURE_IDS), timeframe }))
      .min(1)
      .max(184),
    periods: z.strictObject({
      ema_fast: positiveInt,
      ema_slow: positiveInt,
      ema_long: positiveInt,
      rsi: positiveInt,
      macd_fast: positiveInt,
      macd_slow: positiveInt,
      macd_signal: positiveInt,
      atr: positiveInt,
      rolling_return: positiveInt,
      volatility: positiveInt,
      volume: positiveInt,
    }),
    position_inputs: z
      .array(z.enum(POSITION_IDS))
      .min(1)
      .max(POSITION_IDS.length),
    risk_inputs: z.array(z.enum(RISK_IDS)).min(1).max(RISK_IDS.length),
    observation_window: z.number().int().min(1).max(4096),
    normalization: z.strictObject({
      method: z.literal('zscore'),
      fit_scope: z.literal('train_only'),
      artifact_id: identifier.nullable(),
    }),
  }),
  network: z.strictObject({
    preset: z.enum(['Small', 'Medium', 'Large', 'Custom']),
    policy_layers: layers,
    value_layers: layers,
    activation: z.enum(['Tanh', 'ReLU']),
    input_dimension: z.number().int().min(1).max(1000000).nullable(),
  }),
  training: z.strictObject({
    algorithm: z.literal('MaskablePPO'),
    policy: z.literal('MlpPolicy'),
    device: z.literal('cpu'),
    n_envs: z.literal(1),
    learning_rate: decimal,
    total_timesteps: positiveInt,
    batch_size: z.number().int().min(2).max(1000000),
    n_steps: z.number().int().min(2).max(1000000),
    gamma: decimal,
    gae_lambda: decimal,
    entropy_coefficient: decimal,
    clip_range: decimal,
    observation_window: z.number().int().min(1).max(4096),
    episode_length_bars: positiveInt,
    seed: z.number().int().min(0).max(4294967295),
    reward_version: z.literal('net-equity-delta/initial-capital-v1'),
  }),
});

export type ResearchConfiguration = z.infer<typeof configurationSchema>;
