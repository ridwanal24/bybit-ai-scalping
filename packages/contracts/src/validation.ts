import {
  configurationSchema,
  INTERVAL_MS,
  MAX_CONFIG_BYTES,
  NETWORK_PRESETS,
  type ResearchConfiguration,
} from './schema.js';
import { canonicalValue, scaledDecimal } from './canonical-value.js';

export type ConfigurationIssue = {
  field: string;
  code: string;
  message: string;
};
export const EXECUTION_CHECKS_PENDING = [
  'exchange_capabilities',
  'instrument_constraints',
  'dataset_quality_and_funding',
  'observation_shape_and_normalization_artifact',
  'margin_and_liquidation',
  'model_evaluation_and_approval',
  'operational_readiness',
] as const;
export type ValidationResult =
  | {
      valid: true;
      configuration: ResearchConfiguration;
      execution_checks_pending: typeof EXECUTION_CHECKS_PENDING;
    }
  | { valid: false; issues: ConfigurationIssue[] };
const ONE = 10n ** 18n;

export function estimateParameters(
  configuration: ResearchConfiguration,
): number | null {
  const {
    input_dimension: input,
    policy_layers: policy,
    value_layers: value,
  } = configuration.network;
  if (input === null) return null;
  const count = (hidden: number[], output: number) => {
    let previous = input;
    let total = 0;
    for (const size of [...hidden, output]) {
      total += (previous + 1) * size;
      previous = size;
    }
    return total;
  };
  return count(policy, 5) + count(value, 1);
}

export function validateConfiguration(input: unknown): ValidationResult {
  try {
    if (
      Buffer.byteLength(JSON.stringify(input) ?? '', 'utf8') > MAX_CONFIG_BYTES
    ) {
      return {
        valid: false,
        issues: [
          {
            field: '',
            code: 'payload_too_large',
            message: 'Configuration exceeds 64 KiB',
          },
        ],
      };
    }
  } catch {
    return {
      valid: false,
      issues: [
        { field: '', code: 'invalid_json', message: 'JSON document required' },
      ],
    };
  }
  const parsed = configurationSchema.safeParse(input);
  if (!parsed.success)
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        code: issue.code,
        message: 'Invalid configuration field',
      })),
    };
  const c = parsed.data;
  const issues: ConfigurationIssue[] = [];
  const check = (
    condition: boolean,
    field: string,
    code: string,
    message: string,
  ) => {
    if (!condition) issues.push({ field, code, message });
  };
  const fraction = (
    value: string,
    field: string,
    zero = false,
    includeOne = false,
  ) => {
    const n = scaledDecimal(value);
    check(
      (zero ? n >= 0n : n > 0n) && (includeOne ? n <= ONE : n < ONE),
      field,
      'fraction_range',
      'Fraction outside supported range',
    );
  };
  const positive = (value: string, field: string) =>
    check(
      scaledDecimal(value) > 0n,
      field,
      'positive_required',
      'Positive decimal required',
    );
  const unique = (values: string[], field: string) =>
    check(
      new Set(values).size === values.length,
      field,
      'duplicate_value',
      'Duplicate values are not allowed',
    );
  positive(c.risk.initial_capital, 'risk.initial_capital');
  positive(c.risk.max_position_notional, 'risk.max_position_notional');
  for (const key of [
    'risk_per_trade',
    'daily_loss_limit',
    'max_drawdown',
  ] as const)
    fraction(c.risk[key], `risk.${key}`);
  fraction(c.risk.max_margin_fraction, 'risk.max_margin_fraction', false, true);
  check(
    scaledDecimal(c.risk.risk_per_trade) <=
      scaledDecimal(c.risk.daily_loss_limit),
    'risk.risk_per_trade',
    'risk_budget_order',
    'Risk per trade exceeds daily loss limit',
  );
  check(
    scaledDecimal(c.risk.daily_loss_limit) <=
      scaledDecimal(c.risk.max_drawdown),
    'risk.daily_loss_limit',
    'risk_budget_order',
    'Daily loss limit exceeds maximum drawdown',
  );
  check(
    scaledDecimal(c.risk.min_available_margin) <
      scaledDecimal(c.risk.initial_capital),
    'risk.min_available_margin',
    'margin_vs_capital',
    'Minimum available margin must be below capital',
  );
  check(
    c.market.historical_start_ms < c.market.historical_end_ms,
    'market.historical_end_ms',
    'historical_range',
    'Historical end must follow start',
  );
  check(
    c.market.historical_start_ms % INTERVAL_MS[c.market.timeframe] === 0 &&
      c.market.historical_end_ms % INTERVAL_MS[c.market.timeframe] === 0,
    'market',
    'candle_boundary',
    'Historical boundaries must align to UTC main timeframe',
  );
  unique(c.market.secondary_timeframes, 'market.secondary_timeframes');
  check(
    c.market.secondary_timeframes.every(
      (tf) => INTERVAL_MS[tf] > INTERVAL_MS[c.market.timeframe],
    ),
    'market.secondary_timeframes',
    'higher_timeframe_required',
    'Secondary timeframes must be higher than main',
  );
  positive(c.stop_loss.atr_multiplier, 'stop_loss.atr_multiplier');
  fraction(c.stop_loss.min_stop_fraction, 'stop_loss.min_stop_fraction');
  fraction(c.stop_loss.max_stop_fraction, 'stop_loss.max_stop_fraction');
  check(
    scaledDecimal(c.stop_loss.min_stop_fraction) <=
      scaledDecimal(c.stop_loss.max_stop_fraction),
    'stop_loss.min_stop_fraction',
    'stop_distance_order',
    'Minimum stop exceeds maximum stop',
  );
  if (c.exit.rr !== null) positive(c.exit.rr, 'exit.rr');
  const tp = c.exit.mode !== 'AI_EXIT';
  check(
    c.exit.fixed_tp_enabled === tp &&
      c.exit.ai_close_enabled === (c.exit.mode !== 'FIXED_RR'),
    'exit',
    'exit_mode_conflict',
    'SL/TP and AI close flags conflict with exit mode',
  );
  check(
    !tp || c.exit.rr !== null,
    'exit.rr',
    'rr_required',
    'Fixed TP requires positive RR',
  );
  fraction(c.execution.taker_fee_rate, 'execution.taker_fee_rate', true);
  const maker = scaledDecimal(c.execution.maker_fee_rate);
  check(
    maker > -ONE && maker < ONE,
    'execution.maker_fee_rate',
    'fee_range',
    'Maker fee/rebate must be between -1 and 1',
  );
  for (const key of ['spread_bps', 'slippage_bps'] as const)
    check(
      scaledDecimal(c.execution[key]) < 10000n * ONE,
      `execution.${key}`,
      'bps_range',
      'Cost assumption must be below 10000 bps',
    );
  const funding = c.execution.funding;
  check(
    funding.mode === 'historical'
      ? funding.rate === null
      : funding.rate !== null,
    'execution.funding.rate',
    'funding_mode_conflict',
    'Historical funding needs null rate; fixed funding needs explicit rate',
  );
  if (funding.rate !== null)
    check(
      scaledDecimal(funding.rate) > -ONE && scaledDecimal(funding.rate) < ONE,
      'execution.funding.rate',
      'funding_range',
      'Funding rate must be between -1 and 1',
    );
  const maxFee =
    maker > scaledDecimal(c.execution.taker_fee_rate)
      ? maker
      : scaledDecimal(c.execution.taker_fee_rate);
  check(
    scaledDecimal(c.stop_loss.fee_allowance_rate) >= 2n * maxFee,
    'stop_loss.fee_allowance_rate',
    'fee_allowance_insufficient',
    'Allowance must cover estimated round-trip fees',
  );
  check(
    scaledDecimal(c.stop_loss.slippage_allowance_bps) >=
      scaledDecimal(c.execution.slippage_bps) +
        scaledDecimal(c.execution.spread_bps),
    'stop_loss.slippage_allowance_bps',
    'slippage_allowance_insufficient',
    'Allowance must cover slippage plus spread assumptions',
  );
  check(
    c.stop_loss.trigger_reference === c.execution.stop_trigger_reference,
    'execution.stop_trigger_reference',
    'trigger_reference_conflict',
    'Stop trigger references must match',
  );
  unique(
    c.features.enabled.map((feature) => `${feature.id}:${feature.timeframe}`),
    'features.enabled',
  );
  check(
    c.features.enabled.every(
      (feature) =>
        feature.timeframe === c.market.timeframe ||
        c.market.secondary_timeframes.includes(feature.timeframe),
    ),
    'features.enabled',
    'feature_timeframe_missing',
    'Feature timeframe is not configured',
  );
  unique(c.features.position_inputs, 'features.position_inputs');
  unique(c.features.risk_inputs, 'features.risk_inputs');
  check(
    c.features.periods.ema_fast < c.features.periods.ema_slow &&
      c.features.periods.ema_slow < c.features.periods.ema_long,
    'features.periods',
    'ema_period_order',
    'EMA periods must be fast < slow < long',
  );
  check(
    c.features.periods.macd_fast < c.features.periods.macd_slow,
    'features.periods',
    'macd_period_order',
    'MACD fast period must be below slow period',
  );
  check(
    c.stop_loss.atr_period === c.features.periods.atr,
    'features.periods.atr',
    'atr_period_conflict',
    'Risk and feature ATR periods must match',
  );
  if (c.network.preset !== 'Custom') {
    const expected = JSON.stringify(NETWORK_PRESETS[c.network.preset]);
    check(
      JSON.stringify(c.network.policy_layers) === expected &&
        JSON.stringify(c.network.value_layers) === expected,
      'network',
      'network_preset_conflict',
      'Network layers do not match preset',
    );
  }
  const parameters = estimateParameters(c);
  check(
    parameters === null || parameters <= 2000000,
    'network.input_dimension',
    'parameter_budget_exceeded',
    'Estimated parameter count exceeds 2 million research guard',
  );
  positive(c.training.learning_rate, 'training.learning_rate');
  fraction(c.training.gamma, 'training.gamma', false, true);
  fraction(c.training.gae_lambda, 'training.gae_lambda', true, true);
  fraction(c.training.clip_range, 'training.clip_range');
  fraction(
    c.training.entropy_coefficient,
    'training.entropy_coefficient',
    true,
  );
  check(
    c.training.batch_size <= c.training.n_steps &&
      c.training.n_steps % c.training.batch_size === 0,
    'training.batch_size',
    'batch_rollout_conflict',
    'Batch must divide single-env rollout',
  );
  check(
    c.training.observation_window === c.features.observation_window,
    'training.observation_window',
    'window_conflict',
    'Training and feature windows must match',
  );
  check(
    c.training.episode_length_bars > c.training.observation_window,
    'training.episode_length_bars',
    'episode_too_short',
    'Episode must exceed observation window',
  );
  if (issues.length) return { valid: false, issues };
  return {
    valid: true,
    configuration: canonicalValue(c) as ResearchConfiguration,
    execution_checks_pending: EXECUTION_CHECKS_PENDING,
  };
}
