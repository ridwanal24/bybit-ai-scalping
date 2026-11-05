import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, normalizeDecimal, scaledDecimal } from './canonical.js';
import { INTERVAL_MS, TIMEFRAMES } from './schema.js';

export const MARKET_FORMAT_VERSION = '1';
export const MARKET_INTERVALS = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1D': 'D',
} as const;
export type MarketTimeframe = (typeof TIMEFRAMES)[number];
export type PriceType = 'last' | 'mark' | 'index';
export type MarketSource = 'bybit-mainnet' | 'fixture';
const source = z.enum(['bybit-mainnet', 'fixture']);
const symbol = z
  .string()
  .min(5)
  .max(30)
  .regex(/^[A-Z0-9]+USDT$/);
const timestamp = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const numberString = z.string().regex(/^(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$/);
const signedRate = z
  .string()
  .regex(/^(?!-0(?:\.0+)?$)-?(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$/);

const marketCandleBase = z.strictObject({
  schema_version: z.literal('1'),
  source,
  category: z.literal('linear'),
  symbol,
  price_type: z.enum(['last', 'mark', 'index']),
  timeframe: z.enum(TIMEFRAMES),
  open_time_ms: timestamp,
  close_time_ms: timestamp,
  open: numberString,
  high: numberString,
  low: numberString,
  close: numberString,
  volume: numberString.nullable(),
  turnover: numberString.nullable(),
  availability_policy: z.literal('closed_candle_assumption_v1'),
});
export const marketCandleSchema = z.discriminatedUnion('price_type', [
  marketCandleBase.extend({
    price_type: z.literal('last'),
    volume: numberString,
    turnover: numberString,
  }),
  marketCandleBase.extend({
    price_type: z.literal('mark'),
    volume: z.null(),
    turnover: z.null(),
  }),
  marketCandleBase.extend({
    price_type: z.literal('index'),
    volume: z.null(),
    turnover: z.null(),
  }),
]);
export type MarketCandle = z.infer<typeof marketCandleSchema>;
export const fundingRecordSchema = z.strictObject({
  schema_version: z.literal('1'),
  source,
  category: z.literal('linear'),
  symbol,
  timestamp_ms: timestamp,
  rate: signedRate,
});
export type FundingRecord = z.infer<typeof fundingRecordSchema>;
export const instrumentObservationSchema = z.strictObject({
  schema_version: z.literal('1'),
  source,
  category: z.literal('linear'),
  symbol,
  contract_type: z.literal('LinearPerpetual'),
  settlement: z.literal('USDT'),
  status: z.literal('Trading'),
  launch_time_ms: timestamp,
  delivery_time_ms: timestamp,
  tick_size: numberString,
  quantity_step: numberString,
  min_quantity: numberString,
  min_notional: numberString,
  max_limit_quantity: numberString,
  max_market_quantity: numberString,
  min_leverage: numberString,
  max_leverage: numberString,
  leverage_step: numberString,
  funding_interval_minutes: z.number().int().min(1).max(10080),
  historical_validity: z.literal('current_observation_reference_only'),
});
export type InstrumentObservation = z.infer<typeof instrumentObservationSchema>;
export const marketDownloadRequestSchema = z.strictObject({
  configurationSnapshotId: z.uuid(),
  startMs: timestamp.optional(),
  endMs: timestamp.optional(),
  references: z
    .array(z.enum(['mark', 'index']))
    .max(2)
    .default([]),
});
export const marketManifestSchema = z.strictObject({
  format_version: z.literal('1'),
  quality_policy: z.literal('strict_closed_v1'),
  source,
  symbol,
  category: z.literal('linear'),
  requested_start_ms: timestamp,
  requested_end_ms: timestamp,
  instrument_hash: z.string().regex(/^[0-9a-f]{64}$/),
  streams: z.array(
    z.strictObject({
      id: z.string(),
      start_ms: timestamp,
      end_ms: timestamp,
      count: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
  funding: z.strictObject({
    count: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    coverage: z.literal('queried_range_historical_cadence_unverified'),
  }),
});
export type MarketManifest = z.infer<typeof marketManifestSchema>;

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const marketQualitySchema = z.strictObject({
  final: z.literal(true),
  candles_usable: z.boolean(),
  execution_ready: z.literal(false),
  streams: z.array(
    z.strictObject({
      id: z.string(),
      start_ms: timestamp,
      end_ms: timestamp,
      count,
      expected: count,
      missing: count,
      gaps: z
        .array(
          z.strictObject({ start_ms: timestamp, end_ms: timestamp, count }),
        )
        .max(100),
      gaps_truncated: z.boolean(),
    }),
  ),
  counters: z.strictObject({
    pages: count,
    invalid: count,
    duplicates: count,
    conflicts: count,
    out_of_order: count,
    outside_range: count,
    incomplete: count,
    retries: count,
    resumes: count,
  }),
  funding: z.strictObject({
    count,
    queried_start_ms: timestamp,
    queried_end_ms: timestamp,
    cadence_anomalies_vs_current_interval: count,
    coverage: z.literal('historical_cadence_unverified_no_zero_fill'),
  }),
  metadata: z.strictObject({
    historical_validity: z.literal('current_observation_reference_only'),
    instrument_observed_at: z.string(),
    pre_launch_requested: z.boolean(),
  }),
  cutoff_ms: timestamp,
  safety_delay_ms: z.literal(2000),
  requested_range_clipped: z.boolean(),
});

export class MarketContractError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function marketContentHash(value: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(value), 'utf8')
    .digest('hex');
}

export function parseTimestamp(value: unknown): number {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value))
    throw new MarketContractError('invalid_timestamp');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new MarketContractError('invalid_timestamp');
  return n;
}

export function normalizeCandle(
  raw: unknown,
  context: {
    source: MarketSource;
    symbol: string;
    timeframe: MarketTimeframe;
    priceType: PriceType;
  },
): MarketCandle {
  const count = context.priceType === 'last' ? 7 : 5;
  if (!Array.isArray(raw) || raw.length !== count)
    throw new MarketContractError('invalid_candle_shape');
  const openTime = parseTimestamp(raw[0]);
  const parsed = marketCandleSchema.safeParse({
    schema_version: '1',
    source: context.source,
    category: 'linear',
    symbol: context.symbol,
    price_type: context.priceType,
    timeframe: context.timeframe,
    open_time_ms: openTime,
    close_time_ms: openTime + INTERVAL_MS[context.timeframe],
    open: raw[1],
    high: raw[2],
    low: raw[3],
    close: raw[4],
    volume: count === 7 ? raw[5] : null,
    turnover: count === 7 ? raw[6] : null,
    availability_policy: 'closed_candle_assumption_v1',
  });
  if (!parsed.success) throw new MarketContractError('invalid_candle_fields');
  const c = parsed.data;
  if (openTime % INTERVAL_MS[c.timeframe] !== 0)
    throw new MarketContractError('misaligned_candle');
  const [o, h, l, close] = [c.open, c.high, c.low, c.close].map(
    scaledDecimal,
  ) as [bigint, bigint, bigint, bigint];
  if (l <= 0n || o < l || close < l || o > h || close > h || h < l)
    throw new MarketContractError('invalid_ohlc');
  const prices = {
    open: normalizeDecimal(c.open),
    high: normalizeDecimal(c.high),
    low: normalizeDecimal(c.low),
    close: normalizeDecimal(c.close),
  };
  if (c.price_type === 'last')
    return {
      ...c,
      ...prices,
      volume: normalizeDecimal(c.volume),
      turnover: normalizeDecimal(c.turnover),
    };
  return { ...c, ...prices };
}

export function normalizeFunding(
  raw: unknown,
  context: { source: MarketSource; symbol: string },
): FundingRecord {
  const row = z
    .object({
      symbol: z.string(),
      fundingRate: signedRate,
      fundingRateTimestamp: z.string(),
    })
    .safeParse(raw);
  if (!row.success || row.data.symbol !== context.symbol)
    throw new MarketContractError('invalid_funding');
  return fundingRecordSchema.parse({
    schema_version: '1',
    source: context.source,
    category: 'linear',
    symbol: context.symbol,
    timestamp_ms: parseTimestamp(row.data.fundingRateTimestamp),
    rate: normalizeDecimal(row.data.fundingRate),
  });
}

export function normalizeInstrument(
  raw: unknown,
  marketSource: MarketSource,
  expectedSymbol: string,
): InstrumentObservation {
  const row = z
    .object({
      symbol: z.string(),
      contractType: z.string(),
      status: z.string(),
      settleCoin: z.string(),
      launchTime: z.string(),
      deliveryTime: z.string(),
      isPreListing: z.boolean().optional(),
      priceFilter: z.object({ tickSize: numberString }),
      lotSizeFilter: z.object({
        qtyStep: numberString,
        minOrderQty: numberString,
        minNotionalValue: numberString,
        maxOrderQty: numberString,
        maxMktOrderQty: numberString,
      }),
      leverageFilter: z.object({
        minLeverage: numberString,
        maxLeverage: numberString,
        leverageStep: numberString,
      }),
      fundingInterval: z.number().int(),
    })
    .safeParse(raw);
  if (
    !row.success ||
    row.data.symbol !== expectedSymbol ||
    row.data.isPreListing
  )
    throw new MarketContractError('unsupported_instrument');
  const r = row.data;
  const result = instrumentObservationSchema.safeParse({
    schema_version: '1',
    source: marketSource,
    category: 'linear',
    symbol: r.symbol,
    contract_type: r.contractType,
    settlement: r.settleCoin,
    status: r.status,
    launch_time_ms: parseTimestamp(r.launchTime),
    delivery_time_ms: parseTimestamp(r.deliveryTime),
    tick_size: normalizeDecimal(r.priceFilter.tickSize),
    quantity_step: normalizeDecimal(r.lotSizeFilter.qtyStep),
    min_quantity: normalizeDecimal(r.lotSizeFilter.minOrderQty),
    min_notional: normalizeDecimal(r.lotSizeFilter.minNotionalValue),
    max_limit_quantity: normalizeDecimal(r.lotSizeFilter.maxOrderQty),
    max_market_quantity: normalizeDecimal(r.lotSizeFilter.maxMktOrderQty),
    min_leverage: normalizeDecimal(r.leverageFilter.minLeverage),
    max_leverage: normalizeDecimal(r.leverageFilter.maxLeverage),
    leverage_step: normalizeDecimal(r.leverageFilter.leverageStep),
    funding_interval_minutes: r.fundingInterval,
    historical_validity: 'current_observation_reference_only',
  });
  if (!result.success) throw new MarketContractError('unsupported_instrument');
  for (const field of [
    'tick_size',
    'quantity_step',
    'min_quantity',
    'max_limit_quantity',
    'max_market_quantity',
    'min_leverage',
    'max_leverage',
    'leverage_step',
  ] as const)
    if (scaledDecimal(result.data[field]) <= 0n)
      throw new MarketContractError('invalid_instrument_limits');
  if (
    scaledDecimal(result.data.min_leverage) >
    scaledDecimal(result.data.max_leverage)
  )
    throw new MarketContractError('invalid_instrument_limits');
  return result.data;
}

export function effectiveRange(
  start: number,
  end: number,
  cutoff: number,
  timeframe: MarketTimeframe,
) {
  const interval = INTERVAL_MS[timeframe];
  const effectiveStart = Math.ceil(start / interval) * interval;
  const effectiveEnd = Math.max(
    effectiveStart,
    Math.floor(Math.min(end, cutoff - 2000) / interval) * interval,
  );
  return { start_ms: effectiveStart, end_ms: effectiveEnd };
}

/** Compact coverage accumulator: O(number of gap segments), no per-missing-bar array. */
export class CandleCoverage {
  private next: number;
  count = 0;
  missing = 0;
  readonly gaps: { start_ms: number; end_ms: number; count: number }[] = [];
  private truncated = false;
  constructor(
    readonly start: number,
    readonly end: number,
    readonly interval: number,
  ) {
    this.next = start;
  }
  add(openTime: number): void {
    if (openTime < this.next || openTime >= this.end)
      throw new MarketContractError('coverage_order_or_range');
    this.gap(openTime);
    this.next = openTime + this.interval;
    this.count++;
  }
  private gap(until: number) {
    if (until > this.next) {
      const n = (until - this.next) / this.interval;
      this.missing += n;
      if (this.gaps.length < 100)
        this.gaps.push({ start_ms: this.next, end_ms: until, count: n });
      else this.truncated = true;
    }
  }
  finish() {
    this.gap(this.end);
    this.next = this.end;
    return {
      count: this.count,
      expected: (this.end - this.start) / this.interval,
      missing: this.missing,
      gaps: this.gaps,
      gaps_truncated: this.truncated,
    };
  }
}
