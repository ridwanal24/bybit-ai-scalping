import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  configurationSchema,
  researchPreset,
  validateConfiguration,
  configurationHash,
  canonicalJson,
  DECIMAL_FIELD_NAMES,
  marketCandleSchema,
  fundingRecordSchema,
  instrumentObservationSchema,
  marketManifestSchema,
  marketQualitySchema,
  marketDownloadRequestSchema,
  marketContentHash,
  FEATURE_FORMULAS,
  featureSchema,
  observationSchemaFor,
  observationContextSchema,
  normalizerSchema,
  observationResultSchema,
  featureArtifactSchema,
  simulationPolicySchema,
  simulationRequestSchema,
  simulationActionSchema,
  simulationEventSchema,
  simulationTradeSchema,
  simulationEquitySchema,
  simulationReportSchema,
  simulationManifestSchema,
  baselineStrategySchema,
  baselineRequestSchema,
  baselineMetricsSchema,
  baselineComparisonSchema,
  SIMULATION_ACCOUNTING_VECTORS,
  SIMULATION_RISK_VECTORS,
} from '../dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const valid = researchPreset();
const fractional = structuredClone(valid);
fractional.risk.initial_capital = '1000.00';
fractional.exit.rr = '2.000';
const cases = [
  {
    name: 'research-preset',
    configuration: valid,
    structurally_valid: true,
    semantically_valid: true,
  },
  {
    name: 'decimal-equivalence',
    configuration: fractional,
    structurally_valid: true,
    semantically_valid: true,
  },
];
for (const artifact of ['1.00', '1']) {
  const c = structuredClone(valid);
  c.features.normalization.artifact_id = artifact;
  cases.push({
    name: `artifact-identity-${artifact}`,
    configuration: c,
    structurally_valid: true,
    semantically_valid: true,
  });
}
for (const [name, mutate, structural] of [
  [
    'unknown-field',
    (c) => {
      c.unknown = true;
    },
    false,
  ],
  [
    'wrong-integer-type',
    (c) => {
      c.training.batch_size = '64';
    },
    false,
  ],
  [
    'unsupported-version',
    (c) => {
      c.schema_version = '2';
    },
    false,
  ],
  [
    'missing-field',
    (c) => {
      delete c.risk;
    },
    false,
  ],
  [
    'decimal-exponent',
    (c) => {
      c.risk.initial_capital = '1e3';
    },
    false,
  ],
  [
    'negative-zero',
    (c) => {
      c.execution.maker_fee_rate = '-0.00';
    },
    false,
  ],
  [
    'feature-id',
    (c) => {
      c.features.enabled[0].id = 'future_unknown_feature';
    },
    false,
  ],
  [
    'hard-stop-disabled',
    (c) => {
      c.stop_loss.hard_stop_required = false;
    },
    false,
  ],
  [
    'exit-mode-conflict',
    (c) => {
      c.exit.ai_close_enabled = false;
    },
    true,
  ],
  [
    'risk-budget-order',
    (c) => {
      c.risk.risk_per_trade = '0.03';
    },
    true,
  ],
  [
    'higher-timeframe',
    (c) => {
      c.features.enabled[0].timeframe = '4h';
    },
    true,
  ],
]) {
  const c = structuredClone(valid);
  mutate(c);
  cases.push({
    name,
    configuration: c,
    structurally_valid: structural,
    semantically_valid: false,
  });
}
const vectors = cases
  .filter((item) => item.semantically_valid)
  .map((item) => {
    const result = validateConfiguration(item.configuration);
    if (!result.valid)
      throw new Error('Export preset failed semantic validation');
    return {
      name: item.name,
      configuration: item.configuration,
      canonical_json: canonicalJson(result.configuration),
      sha256: configurationHash(result.configuration),
    };
  });
const outputs = {
  'schemas/simulation-policy-v1.schema.json': z.toJSONSchema(
    simulationPolicySchema,
  ),
  'schemas/simulation-request-v1.schema.json': z.toJSONSchema(
    simulationRequestSchema,
  ),
  'schemas/simulation-action-v1.schema.json': z.toJSONSchema(
    simulationActionSchema,
  ),
  'schemas/simulation-event-v1.schema.json': z.toJSONSchema(
    simulationEventSchema,
  ),
  'schemas/simulation-trade-v1.schema.json': z.toJSONSchema(
    simulationTradeSchema,
  ),
  'schemas/simulation-equity-v1.schema.json': z.toJSONSchema(
    simulationEquitySchema,
  ),
  'schemas/simulation-report-v1.schema.json': z.toJSONSchema(
    simulationReportSchema,
  ),
  'schemas/simulation-manifest-v1.schema.json': z.toJSONSchema(
    simulationManifestSchema,
  ),
  'fixtures/simulation-accounting.json': SIMULATION_ACCOUNTING_VECTORS,
  'schemas/baseline-strategy-v1.schema.json': z.toJSONSchema(
    baselineStrategySchema,
  ),
  'schemas/baseline-request-v1.schema.json': z.toJSONSchema(
    baselineRequestSchema,
  ),
  'schemas/baseline-metrics-v1.schema.json': z.toJSONSchema(
    baselineMetricsSchema,
  ),
  'schemas/baseline-comparison-v1.schema.json': z.toJSONSchema(
    baselineComparisonSchema,
  ),
  'fixtures/simulation-risk.json': SIMULATION_RISK_VECTORS,
  'schemas/feature-v1.schema.json': z.toJSONSchema(featureSchema),
  'schemas/observation-context-v1.schema.json': z.toJSONSchema(
    observationContextSchema,
  ),
  'schemas/normalizer-v1.schema.json': z.toJSONSchema(normalizerSchema),
  'schemas/observation-result-v1.schema.json': z.toJSONSchema(
    observationResultSchema,
  ),
  'schemas/feature-artifact-v1.schema.json': z.toJSONSchema(
    featureArtifactSchema,
  ),
  'fixtures/feature-catalog.json': { version: '1', formulas: FEATURE_FORMULAS },
  'fixtures/observation-vector.json': observationSchemaFor(valid),
  'schemas/market-quality-v1.schema.json': z.toJSONSchema(marketQualitySchema),
  'fixtures/market-vectors.json': [
    {
      schema: 'market-candle-v1.schema.json',
      payload: {
        schema_version: '1',
        source: 'fixture',
        category: 'linear',
        symbol: 'BTCUSDT',
        price_type: 'last',
        timeframe: '1m',
        open_time_ms: 1735689600000,
        close_time_ms: 1735689660000,
        open: '100',
        high: '102',
        low: '99',
        close: '101',
        volume: '2',
        turnover: '201',
        availability_policy: 'closed_candle_assumption_v1',
      },
    },
    {
      schema: 'market-candle-v1.schema.json',
      payload: {
        schema_version: '1',
        source: 'fixture',
        category: 'linear',
        symbol: 'BTCUSDT',
        price_type: 'mark',
        timeframe: '1m',
        open_time_ms: 1735689600000,
        close_time_ms: 1735689660000,
        open: '100',
        high: '102',
        low: '99',
        close: '101',
        volume: null,
        turnover: null,
        availability_policy: 'closed_candle_assumption_v1',
      },
    },
    {
      schema: 'funding-v1.schema.json',
      payload: {
        schema_version: '1',
        source: 'fixture',
        category: 'linear',
        symbol: 'BTCUSDT',
        timestamp_ms: 1735689600000,
        rate: '-0.0001',
      },
    },
  ].map(({ schema, payload }) => ({
    schema,
    payload,
    canonical_json: canonicalJson(payload),
    sha256: marketContentHash(payload),
  })),
  'schemas/market-candle-v1.schema.json': z.toJSONSchema(marketCandleSchema),
  'schemas/funding-v1.schema.json': z.toJSONSchema(fundingRecordSchema),
  'schemas/instrument-v1.schema.json': z.toJSONSchema(
    instrumentObservationSchema,
  ),
  'schemas/dataset-manifest-v1.schema.json':
    z.toJSONSchema(marketManifestSchema),
  'schemas/market-download-request-v1.schema.json': z.toJSONSchema(
    marketDownloadRequestSchema,
  ),
  'schemas/configuration-v1.schema.json': {
    ...z.toJSONSchema(configurationSchema, { target: 'draft-2020-12' }),
    $id: 'urn:bybit:configuration:1',
  },
  'fixtures/configuration-cases.json': cases,
  'fixtures/canonical-vectors.json': vectors,
  'fixtures/canonical-rules.json': {
    decimal_fields: DECIMAL_FIELD_NAMES,
    version: '1',
  },
  'presets/research-small-hybrid-v1.json': valid,
};
const semanticCases = [...cases];
for (const [field, value] of [
  ['risk.initial_capital', '0'],
  ['risk.max_position_notional', '0'],
  ['risk.risk_per_trade', '0'],
  ['risk.daily_loss_limit', '1'],
  ['risk.max_drawdown', '0'],
  ['risk.max_margin_fraction', '1.1'],
  ['risk.daily_loss_limit', '0.2'],
  ['risk.min_available_margin', '1000'],
  ['market.historical_end_ms', 1735689600000],
  ['market.historical_start_ms', 1735689600001],
  ['market.secondary_timeframes', ['1m']],
  ['market.secondary_timeframes', ['5m', '5m']],
  ['stop_loss.atr_multiplier', '0'],
  ['stop_loss.min_stop_fraction', '0'],
  ['stop_loss.max_stop_fraction', '1'],
  ['stop_loss.min_stop_fraction', '0.06'],
  ['exit.rr', '0'],
  ['exit.rr', null],
  ['execution.taker_fee_rate', '1'],
  ['execution.maker_fee_rate', '-1'],
  ['execution.spread_bps', '10000'],
  ['execution.slippage_bps', '10000'],
  ['execution.funding.rate', '0.01'],
  ['execution.funding.mode', 'fixed'],
  ['execution.funding.rate', '1'],
  ['stop_loss.fee_allowance_rate', '0'],
  ['stop_loss.slippage_allowance_bps', '0'],
  ['execution.stop_trigger_reference', 'mark'],
  ['features.enabled', [valid.features.enabled[0], valid.features.enabled[0]]],
  ['features.position_inputs', ['side', 'side']],
  ['features.risk_inputs', ['drawdown', 'drawdown']],
  ['features.periods.ema_fast', 21],
  ['features.periods.ema_long', 21],
  ['features.periods.macd_fast', 26],
  ['features.periods.atr', 15],
  ['network.policy_layers', [32]],
  ['network.input_dimension', 1000000],
  ['training.learning_rate', '0'],
  ['training.gamma', '0'],
  ['training.gae_lambda', '1.1'],
  ['training.clip_range', '1'],
  ['training.entropy_coefficient', '1'],
  ['training.batch_size', 65],
  ['training.batch_size', 256],
  ['training.observation_window', 31],
  ['training.episode_length_bars', 32],
  ['training.n_steps', true],
  ['market.historical_end_ms', 9007199254740992],
]) {
  const c = structuredClone(valid);
  const keys = field.split('.');
  let target = c;
  for (const key of keys.slice(0, -1)) target = target[key];
  target[keys.at(-1)] = value;
  semanticCases.push({
    name: `${field}=${JSON.stringify(value)}`,
    configuration: c,
  });
}
outputs['fixtures/semantic-conformance.json'] = semanticCases.map((item) => {
  const structural = configurationSchema.safeParse(item.configuration).success;
  const result = validateConfiguration(item.configuration);
  return {
    name: item.name,
    configuration: item.configuration,
    structurally_valid: structural,
    semantically_valid: result.valid,
    issues:
      !result.valid && structural
        ? result.issues.map(({ field, code }) => ({ field, code }))
        : [],
  };
});
for (const [relative, data] of Object.entries(outputs)) {
  const target = path.join(root, relative);
  const text = JSON.stringify(data, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text)
      throw new Error(`Contract artifact drift: ${relative}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
}
console.log(
  process.argv.includes('--check')
    ? 'Contract exports match source.'
    : 'Contract schema, fixtures and preset exported.',
);
