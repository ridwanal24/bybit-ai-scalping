import { createHash } from 'node:crypto';
import type { ResearchConfiguration } from './schema.js';

const DECIMAL_PATTERN = /^-?(0|[1-9][0-9]{0,17})(\.[0-9]{1,18})?$/;
export const DECIMAL_FIELD_NAMES = [
  'initial_capital',
  'risk_per_trade',
  'max_position_notional',
  'max_margin_fraction',
  'daily_loss_limit',
  'max_drawdown',
  'min_available_margin',
  'atr_multiplier',
  'min_stop_fraction',
  'max_stop_fraction',
  'fee_allowance_rate',
  'slippage_allowance_bps',
  'rr',
  'maker_fee_rate',
  'taker_fee_rate',
  'spread_bps',
  'slippage_bps',
  'rate',
  'learning_rate',
  'gamma',
  'gae_lambda',
  'entropy_coefficient',
  'clip_range',
] as const;
const DECIMAL_FIELDS: ReadonlySet<string> = new Set(DECIMAL_FIELD_NAMES);

export function normalizeDecimal(value: string): string {
  const normalized = value.includes('.')
    ? value.replace(/0+$/, '').replace(/\.$/, '')
    : value;
  return normalized === '-0' ? '0' : normalized;
}

/** No floating point comparisons: all config decimals have at most 18 fractional digits. */
export function scaledDecimal(value: string): bigint {
  const negative = value.startsWith('-');
  const [whole = '0', fraction = ''] = value.replace(/^-/, '').split('.');
  const result = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
  return negative ? -result : result;
}

export function canonicalValue(value: unknown, field = ''): unknown {
  if (typeof value === 'string')
    return DECIMAL_FIELDS.has(field) && DECIMAL_PATTERN.test(value)
      ? normalizeDecimal(value)
      : value;
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonicalValue(item, key)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function configurationHash(
  configuration: ResearchConfiguration,
): string {
  return createHash('sha256')
    .update(canonicalJson(configuration), 'utf8')
    .digest('hex');
}
