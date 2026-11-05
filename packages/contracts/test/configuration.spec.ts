import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  configurationHash,
  configurationPresets,
  configurationSchema,
  researchPreset,
  validateConfiguration,
  compareConfigurations,
  estimateParameters,
  scaledDecimal,
} from '../src/index.js';
import type { ResearchConfiguration } from '../src/index.js';

function invalid(
  mutate: (config: ResearchConfiguration) => void,
  code?: string,
) {
  const c = researchPreset();
  mutate(c);
  const result = validateConfiguration(c);
  expect(result.valid).toBe(false);
  if (!result.valid && code)
    expect(result.issues.some((issue) => issue.code === code)).toBe(true);
}

describe('configuration contract', () => {
  it('validates every preset without claiming execution readiness', () => {
    for (const preset of configurationPresets()) {
      const result = validateConfiguration(preset.configuration);
      expect(result.valid).toBe(true);
      if (result.valid)
        expect(result.execution_checks_pending).toContain(
          'exchange_capabilities',
        );
    }
  });

  it.each([
    [
      'risk order',
      (c: ResearchConfiguration) => {
        c.risk.risk_per_trade = '0.03';
      },
      'risk_budget_order',
    ],
    [
      'daily loss order',
      (c: ResearchConfiguration) => {
        c.risk.daily_loss_limit = '0.2';
      },
      'risk_budget_order',
    ],
    [
      'zero capital',
      (c: ResearchConfiguration) => {
        c.risk.initial_capital = '0';
      },
      'positive_required',
    ],
    [
      'fraction boundary',
      (c: ResearchConfiguration) => {
        c.risk.max_drawdown = '1';
      },
      'fraction_range',
    ],
    [
      'margin',
      (c: ResearchConfiguration) => {
        c.risk.min_available_margin = '1000';
      },
      'margin_vs_capital',
    ],
    [
      'stop bounds',
      (c: ResearchConfiguration) => {
        c.stop_loss.min_stop_fraction = '0.1';
      },
      'stop_distance_order',
    ],
    [
      'zero multiplier',
      (c: ResearchConfiguration) => {
        c.stop_loss.atr_multiplier = '0';
      },
      'positive_required',
    ],
    [
      'exit flags',
      (c: ResearchConfiguration) => {
        c.exit.mode = 'FIXED_RR';
      },
      'exit_mode_conflict',
    ],
    [
      'missing RR',
      (c: ResearchConfiguration) => {
        c.exit.rr = null;
      },
      'rr_required',
    ],
    [
      'fees',
      (c: ResearchConfiguration) => {
        c.execution.taker_fee_rate = '0.01';
      },
      'fee_allowance_insufficient',
    ],
    [
      'slippage',
      (c: ResearchConfiguration) => {
        c.execution.slippage_bps = '6';
      },
      'slippage_allowance_insufficient',
    ],
    [
      'reference',
      (c: ResearchConfiguration) => {
        c.execution.stop_trigger_reference = 'mark';
      },
      'trigger_reference_conflict',
    ],
    [
      'funding',
      (c: ResearchConfiguration) => {
        c.execution.funding.rate = '0';
      },
      'funding_mode_conflict',
    ],
    [
      'fixed funding',
      (c: ResearchConfiguration) => {
        c.execution.funding.mode = 'fixed_rate';
      },
      'funding_mode_conflict',
    ],
    [
      'fee range',
      (c: ResearchConfiguration) => {
        c.execution.maker_fee_rate = '-1';
      },
      'fee_range',
    ],
    [
      'bps range',
      (c: ResearchConfiguration) => {
        c.execution.spread_bps = '10000';
      },
      'bps_range',
    ],
    [
      'funding range',
      (c: ResearchConfiguration) => {
        c.execution.funding = { mode: 'fixed_rate', rate: '1' };
      },
      'funding_range',
    ],
    [
      'range',
      (c: ResearchConfiguration) => {
        c.market.historical_end_ms = c.market.historical_start_ms;
      },
      'historical_range',
    ],
    [
      'boundary',
      (c: ResearchConfiguration) => {
        c.market.historical_start_ms++;
      },
      'candle_boundary',
    ],
    [
      'secondary',
      (c: ResearchConfiguration) => {
        c.market.secondary_timeframes = ['1m'];
      },
      'higher_timeframe_required',
    ],
    [
      'secondary duplicate',
      (c: ResearchConfiguration) => {
        c.market.secondary_timeframes = ['5m', '5m'];
      },
      'duplicate_value',
    ],
    [
      'feature timeframe',
      (c: ResearchConfiguration) => {
        c.features.enabled[0]!.timeframe = '4h';
      },
      'feature_timeframe_missing',
    ],
    [
      'feature duplicate',
      (c: ResearchConfiguration) => {
        c.features.enabled.push(c.features.enabled[0]!);
      },
      'duplicate_value',
    ],
    [
      'position duplicate',
      (c: ResearchConfiguration) => {
        c.features.position_inputs[1] = 'side';
      },
      'duplicate_value',
    ],
    [
      'EMA order',
      (c: ResearchConfiguration) => {
        c.features.periods.ema_fast = 30;
      },
      'ema_period_order',
    ],
    [
      'MACD order',
      (c: ResearchConfiguration) => {
        c.features.periods.macd_fast = 30;
      },
      'macd_period_order',
    ],
    [
      'ATR periods',
      (c: ResearchConfiguration) => {
        c.features.periods.atr = 10;
      },
      'atr_period_conflict',
    ],
    [
      'preset layers',
      (c: ResearchConfiguration) => {
        c.network.policy_layers = [8];
      },
      'network_preset_conflict',
    ],
    [
      'parameter budget',
      (c: ResearchConfiguration) => {
        c.network.input_dimension = 1000000;
      },
      'parameter_budget_exceeded',
    ],
    [
      'batch',
      (c: ResearchConfiguration) => {
        c.training.batch_size = 63;
      },
      'batch_rollout_conflict',
    ],
    [
      'window',
      (c: ResearchConfiguration) => {
        c.training.observation_window = 31;
      },
      'window_conflict',
    ],
    [
      'episode',
      (c: ResearchConfiguration) => {
        c.training.episode_length_bars = 32;
      },
      'episode_too_short',
    ],
  ])('rejects %s', (_name, mutate, code) => invalid(mutate, code));

  it.each([
    (c: ResearchConfiguration) => {
      c.exit = {
        mode: 'AI_EXIT',
        fixed_tp_enabled: false,
        ai_close_enabled: true,
        rr: null,
      };
    },
    (c: ResearchConfiguration) => {
      c.exit = {
        mode: 'FIXED_RR',
        fixed_tp_enabled: true,
        ai_close_enabled: false,
        rr: '2',
      };
    },
    (c: ResearchConfiguration) => {
      c.execution.funding = { mode: 'fixed_rate', rate: '-0.001' };
      c.execution.maker_fee_rate = '-0.001';
    },
    (c: ResearchConfiguration) => {
      c.network = {
        preset: 'Custom',
        policy_layers: [8],
        value_layers: [16],
        activation: 'ReLU',
        input_dimension: 10,
      };
    },
  ])('supports valid exit, cost and custom network cases', (mutate) => {
    const c = researchPreset();
    mutate(c);
    expect(validateConfiguration(c).valid).toBe(true);
  });

  it.each([
    ['unknown key', { ...researchPreset(), credential: 'do_not_echo' }],
    [
      'integer string',
      {
        ...researchPreset(),
        training: { ...researchPreset().training, batch_size: '64' },
      },
    ],
    [
      'boolean integer',
      {
        ...researchPreset(),
        network: { ...researchPreset().network, input_dimension: true },
      },
    ],
    [
      'nonfinite',
      {
        ...researchPreset(),
        training: { ...researchPreset().training, seed: Infinity },
      },
    ],
    [
      'unsafe integer',
      {
        ...researchPreset(),
        training: {
          ...researchPreset().training,
          total_timesteps: Number.MAX_SAFE_INTEGER + 1,
        },
      },
    ],
    [
      'too many layers',
      {
        ...researchPreset(),
        network: {
          ...researchPreset().network,
          policy_layers: Array(9).fill(64),
        },
      },
    ],
    [
      'decimal precision',
      {
        ...researchPreset(),
        risk: {
          ...researchPreset().risk,
          risk_per_trade: '0.0000000000000000001',
        },
      },
    ],
    [
      'hard stop false',
      {
        ...researchPreset(),
        stop_loss: { ...researchPreset().stop_loss, hard_stop_required: false },
      },
    ],
  ])('strictly rejects %s without echoing values', (_name, input) => {
    const result = validateConfiguration(input);
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).not.toContain('do_not_echo');
  });

  it('bounds payload and rejects non-JSON/cyclic objects', () => {
    expect(validateConfiguration({ extra: 'x'.repeat(65537) })).toMatchObject({
      valid: false,
      issues: [{ code: 'payload_too_large' }],
    });
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(validateConfiguration(cyclic)).toMatchObject({
      valid: false,
      issues: [{ code: 'invalid_json' }],
    });
  });

  it('compares risk fractions exactly at precision boundary', () => {
    expect(scaledDecimal('0.020000000000000001')).toBe(20000000000000001n);
    invalid((c) => {
      c.risk.risk_per_trade = '0.020000000000000001';
    }, 'risk_budget_order');
  });

  it('estimates separate actor/critic dense parameters when dimension is known', () => {
    const c = researchPreset();
    expect(estimateParameters(c)).toBeNull();
    c.network = {
      preset: 'Custom',
      input_dimension: 10,
      policy_layers: [8],
      value_layers: [16],
      activation: 'Tanh',
    };
    expect(estimateParameters(c)).toBe(11 * 8 + 9 * 5 + 11 * 16 + 17);
  });

  it('has shared structural and semantic fixtures with explicit separation', () => {
    const cases = JSON.parse(
      fs.readFileSync(
        new URL('../fixtures/configuration-cases.json', import.meta.url),
        'utf8',
      ),
    ) as {
      configuration: unknown;
      structurally_valid: boolean;
      semantically_valid: boolean;
    }[];
    for (const item of cases) {
      expect(configurationSchema.safeParse(item.configuration).success).toBe(
        item.structurally_valid,
      );
      expect(validateConfiguration(item.configuration).valid).toBe(
        item.semantically_valid,
      );
    }
  });
});

describe('canonical hash and compatibility', () => {
  it('normalizes decimal spelling and object order, preserves feature array order and artifact identity', () => {
    const a = researchPreset();
    const b = researchPreset();
    b.risk.initial_capital = '1000.000';
    b.exit.rr = '2.00';
    expect(configurationHash(a)).toBe(configurationHash(b));
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    b.features.enabled.reverse();
    expect(configurationHash(a)).not.toBe(configurationHash(b));
    a.features.normalization.artifact_id = '1.00';
    b.features = structuredClone(a.features);
    b.features.normalization.artifact_id = '1';
    expect(configurationHash(a)).not.toBe(configurationHash(b));
  });

  it('matches checked-in golden canonical vectors', () => {
    const vectors = JSON.parse(
      fs.readFileSync(
        new URL('../fixtures/canonical-vectors.json', import.meta.url),
        'utf8',
      ),
    ) as {
      configuration: ResearchConfiguration;
      canonical_json: string;
      sha256: string;
    }[];
    for (const item of vectors) {
      expect(canonicalJson(item.configuration)).toBe(item.canonical_json);
      expect(configurationHash(item.configuration)).toBe(item.sha256);
    }
  });

  it('classifies schema/actions, feature/window/network/exit and cost/risk changes conservatively', () => {
    const reference = researchPreset();
    expect(compareConfigurations(reference, researchPreset()).status).toBe(
      'exact_config_match',
    );
    expect(
      compareConfigurations(reference, { ...reference, schema_version: '2' })
        .status,
    ).toBe('incompatible');
    expect(
      compareConfigurations(reference, {
        ...reference,
        action_schema_version: '2',
      }).status,
    ).toBe('incompatible');
    for (const mutate of [
      (c: ResearchConfiguration) => {
        c.features.enabled.reverse();
      },
      (c: ResearchConfiguration) => {
        c.exit.rr = '3';
      },
      (c: ResearchConfiguration) => {
        c.network.activation = 'ReLU';
      },
      (c: ResearchConfiguration) => {
        c.market.symbol = 'ETHUSDT';
      },
      (c: ResearchConfiguration) => {
        c.training.seed = 43;
      },
    ]) {
      const c = researchPreset();
      mutate(c);
      expect(compareConfigurations(reference, c).status).toBe(
        'retraining_required',
      );
    }
    const c = researchPreset();
    c.risk.initial_capital = '2000';
    expect(compareConfigurations(reference, c).status).toBe(
      'reevaluation_required',
    );
    c.market.mode = 'real';
    expect(compareConfigurations(reference, c).status).toBe(
      'reevaluation_required',
    );
    expect(compareConfigurations(reference, {}).status).toBe(
      'invalid_candidate',
    );
  });
});
