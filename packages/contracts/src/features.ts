import { z } from 'zod';
import { FEATURE_IDS, POSITION_IDS, RISK_IDS, TIMEFRAMES } from './schema.js';
import type { ResearchConfiguration } from './schema.js';
import { validateConfiguration } from './validation.js';
import { marketContentHash } from './market-data.js';

const hash = z.string().regex(/^[0-9a-f]{64}$/);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const statistic = z
  .string()
  .max(400)
  .regex(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/);
export const FEATURE_FORMULAS = {
  log_return: 'ln(C/Cprev)',
  percentage_return: 'C/Cprev-1',
  body_ratio: '(C-O)/(H-L);zero_range=0',
  upper_wick_ratio: '(H-max(O,C))/(H-L);zero_range=0',
  lower_wick_ratio: '(min(O,C)-L)/(H-L);zero_range=0',
  range_fraction: '(H-L)/C',
  close_location: '(C-L)/(H-L);zero_range=0.5',
  rolling_return: 'C/C_lag_period-1',
  ema_fast_distance: 'C/EMAfast-1',
  ema_slow_distance: 'C/EMAslow-1',
  ema_long_distance: 'C/EMAlong-1',
  ema_spread: '(EMAfast-EMAslow)/C',
  ema_slope: 'EMAfast/EMAfast_prev-1',
  rsi: 'Wilder_gain_loss;flat=50;gain_only=100;loss_only=0',
  macd_line: 'EMAfast-EMAslow',
  macd_signal: 'EMA(raw_macd_line)',
  macd_histogram: 'raw_macd_line-raw_signal',
  atr: 'Wilder_true_range;previous_close_required',
  atr_fraction: 'ATR/C',
  volatility: 'population_std(log_returns);not_annualized',
  volume_change: 'V/Vprev-1',
  relative_volume: 'V/mean(previous_period_volumes)',
  volume_ma_ratio: 'V/mean(current_inclusive_period_volumes)',
} satisfies Record<(typeof FEATURE_IDS)[number], string>;

export const featureSchema = z.strictObject({
  version: z.literal('1'),
  formula_version: z.literal('1'),
  market: z
    .array(
      z.strictObject({
        id: z.enum(FEATURE_IDS),
        timeframe: z.enum(TIMEFRAMES),
      }),
    )
    .min(1)
    .max(184),
  periods: z.record(
    z.string(),
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  ),
  position: z.array(z.enum(POSITION_IDS)).min(1).max(7),
  risk: z.array(z.enum(RISK_IDS)).min(1).max(4),
  window: z.number().int().min(1).max(4096),
  dimension: z.number().int().positive().max(1000000),
  main_timeframe: z.enum(TIMEFRAMES),
  layout: z.literal('market_row_major_then_current_position_then_current_risk'),
  dtype: z.literal('float32-le'),
  normalization: z.literal('market_zscore_context_scaled_v1'),
  availability: z.literal('closed_asof_no_gap_fill_v1'),
  context_scale: z.strictObject({
    initial_capital: z.string(),
    max_holding_bars: count,
    risk_per_trade: z.string(),
    exit_mode: z.enum(['FIXED_RR', 'AI_EXIT', 'HYBRID']),
  }),
});

export function observationSchemaFor(c: ResearchConfiguration) {
  const result = validateConfiguration(c);
  if (!result.valid) throw new Error('invalid_configuration');
  c = result.configuration;
  const f = c.features;
  const dimension =
    f.observation_window * f.enabled.length +
    f.position_inputs.length +
    f.risk_inputs.length;
  if (
    c.network.input_dimension !== null &&
    c.network.input_dimension !== dimension
  )
    throw new Error('input_dimension_mismatch');
  const parameters = (layers: number[], output: number) => {
    let previous = dimension,
      total = 0;
    for (const size of [...layers, output]) {
      total += (previous + 1) * size;
      previous = size;
    }
    return total;
  };
  if (
    parameters(c.network.policy_layers, 5) +
      parameters(c.network.value_layers, 1) >
    2000000
  )
    throw new Error('parameter_budget_exceeded');
  const schema = featureSchema.parse({
    version: '1',
    formula_version: '1',
    market: f.enabled,
    periods: f.periods,
    position: f.position_inputs,
    risk: f.risk_inputs,
    window: f.observation_window,
    dimension,
    main_timeframe: c.market.timeframe,
    layout: 'market_row_major_then_current_position_then_current_risk',
    dtype: 'float32-le',
    normalization: 'market_zscore_context_scaled_v1',
    availability: 'closed_asof_no_gap_fill_v1',
    context_scale: {
      initial_capital: c.risk.initial_capital,
      max_holding_bars: c.risk.max_holding_bars,
      risk_per_trade: c.risk.risk_per_trade,
      exit_mode: c.exit.mode,
    },
  });
  return { schema, sha256: marketContentHash(schema) };
}

export const observationContextSchema = z.strictObject({
  as_of_ms: count,
  side: z.enum(['FLAT', 'LONG', 'SHORT']),
  mark: z.number().positive(),
  entry: z.number().nonnegative(),
  quantity: z.number().nonnegative(),
  stop: z.number().nonnegative(),
  take_profit: z.number().positive().nullable(),
  duration_bars: count,
  equity: z.number().positive(),
  high_water_equity: z.number().positive(),
  daily_start_equity: z.number().positive(),
  available_margin: z.number().nonnegative(),
  remaining_daily_budget: z.number().nonnegative(),
  trading_allowed: z.boolean(),
});
export const normalizerSchema = z.strictObject({
  version: z.literal('1'),
  algorithm: z.literal('welford_population_zscore_v1'),
  numeric: z.literal('python_float64_decimal_strings_v1'),
  feature_schema_hash: hash,
  configuration_hash: hash,
  dataset_fingerprint: hash,
  source: z.enum(['fixture', 'bybit-mainnet']),
  symbol: z.string().regex(/^[A-Z0-9]+USDT$/),
  train_start_ms: count,
  train_end_ms: count,
  count: count.min(1),
  means: z.array(statistic).min(1).max(184),
  scales: z.array(statistic).min(1).max(184),
  constant: z.array(z.boolean()).min(1).max(184),
});
export const observationResultSchema = z.discriminatedUnion('valid', [
  z.strictObject({
    valid: z.literal(true),
    decision_ms: count,
    schema_hash: hash,
    normalizer_id: hash,
    values: z.array(z.number()).min(1).max(1000000),
  }),
  z.strictObject({
    valid: z.literal(false),
    decision_ms: count,
    reason: z.enum([
      'warm_up',
      'gap',
      'stale',
      'missing_context',
      'missing_artifact',
      'incompatible',
      'invalid_value',
    ]),
  }),
]);
export const featureArtifactSchema = z.strictObject({
  version: z.literal('1'),
  feature_schema_hash: hash,
  normalizer_id: hash,
  configuration_hash: hash,
  dataset_fingerprint: hash,
  configuration_snapshot_id: z.uuid(),
  source_configuration_hash: hash,
  source: z.enum(['fixture', 'bybit-mainnet']),
  symbol: z.string(),
  start_ms: count,
  end_ms: count,
  rows: count,
  dimension: count.min(1),
  unavailable: z.record(z.string(), count),
  context_label: z.string().min(1).max(128),
  context_sha256: hash,
  files: z
    .array(
      z.strictObject({
        file: z.enum(['observations.f32', 'decisions.jsonl']),
        sha256: hash,
      }),
    )
    .length(2),
});
