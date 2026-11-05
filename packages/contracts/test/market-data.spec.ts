import { describe, expect, it } from 'vitest';
import {
  CandleCoverage,
  effectiveRange,
  normalizeCandle,
  normalizeFunding,
  normalizeInstrument,
  parseTimestamp,
  marketContentHash,
  marketCandleSchema,
} from '../src/index.js';

const start = 1735689600000;
const context = {
  source: 'fixture' as const,
  symbol: 'BTCUSDT',
  timeframe: '1m' as const,
  priceType: 'last' as const,
};
const raw = [String(start), '100.00', '102', '99', '101', '2.00', '201'];

describe('market normalization and quality contracts', () => {
  it('normalizes exact decimal values without changing timestamp or units', () => {
    const c = normalizeCandle(raw, context);
    expect(c.open).toBe('100');
    expect(c.volume).toBe('2');
    expect(c.close_time_ms).toBe(start + 60000);
    expect(marketContentHash(c)).toBe(
      marketContentHash(
        normalizeCandle(
          [String(start), '100', '102.00', '99', '101', '2', '201'],
          context,
        ),
      ),
    );
  });
  it.each([
    ['shape', raw.slice(0, 6)],
    ['timestamp', ['NaN', ...raw.slice(1)]],
    ['unsafe timestamp', ['9007199254740992', ...raw.slice(1)]],
    ['misaligned', [String(start + 1), ...raw.slice(1)]],
    ['zero price', [String(start), '0', '102', '0', '101', '2', '201']],
    ['invalid OHLC', [String(start), '103', '102', '99', '101', '2', '201']],
    ['negative volume', [...raw.slice(0, 5), '-1', '201']],
    ['missing trade volume', [...raw.slice(0, 5), null, null]],
    ['exponent', [String(start), '1e2', ...raw.slice(2)]],
    [
      'precision overflow',
      [String(start), '100.0000000000000000001', ...raw.slice(2)],
    ],
  ])('rejects %s', (_name, row) => {
    expect(() => normalizeCandle(row, context)).toThrow();
  });
  it.each(['mark', 'index'] as const)(
    'keeps %s OHLC volume null without inventing trade data',
    (priceType) => {
      const c = normalizeCandle(raw.slice(0, 5), { ...context, priceType });
      expect(c.volume).toBeNull();
      expect(c.turnover).toBeNull();
      expect(marketCandleSchema.safeParse({ ...c, volume: '0' }).success).toBe(
        false,
      );
    },
  );
  it('accepts signed funding and rejects identity/timestamp/precision violations', () => {
    expect(
      normalizeFunding(
        {
          symbol: 'BTCUSDT',
          fundingRate: '-0.000100',
          fundingRateTimestamp: String(start),
        },
        context,
      ).rate,
    ).toBe('-0.0001');
    for (const row of [
      {
        symbol: 'ETHUSDT',
        fundingRate: '0',
        fundingRateTimestamp: String(start),
      },
      {
        symbol: 'BTCUSDT',
        fundingRate: '-0.00',
        fundingRateTimestamp: String(start),
      },
      {
        symbol: 'BTCUSDT',
        fundingRate: 'NaN',
        fundingRateTimestamp: String(start),
      },
    ])
      expect(() => normalizeFunding(row, context)).toThrow();
    expect(() => parseTimestamp('1.5')).toThrow();
    expect(() => parseTimestamp('-1')).toThrow();
  });
  it('freezes conservative effective ranges using UTC and a 2-second closure delay', () => {
    expect(effectiveRange(start, start + 120000, start + 120000, '1m')).toEqual(
      { start_ms: start, end_ms: start + 60000 },
    );
    expect(
      effectiveRange(start + 60000, start + 600000, start + 10000000, '5m'),
    ).toEqual({ start_ms: start + 300000, end_ms: start + 600000 });
    expect(effectiveRange(start, start + 60000, start - 1, '1m')).toEqual({
      start_ms: start,
      end_ms: start,
    });
  });
  it('detects leading, internal and trailing gaps without creating candles', () => {
    const scan = new CandleCoverage(start, start + 6 * 60000, 60000);
    scan.add(start + 60000);
    scan.add(start + 3 * 60000);
    expect(scan.finish()).toMatchObject({
      count: 2,
      expected: 6,
      missing: 4,
      gaps: [
        { start_ms: start, end_ms: start + 60000, count: 1 },
        { start_ms: start + 120000, end_ms: start + 180000, count: 1 },
        { start_ms: start + 240000, end_ms: start + 360000, count: 2 },
      ],
    });
    expect(scan.finish().missing).toBe(4);
  });
  it('bounds gap detail memory while keeping an exact total count', () => {
    const scan = new CandleCoverage(0, 1200, 1);
    for (let t = 1; t < 1200; t += 2) scan.add(t);
    expect(scan.finish()).toMatchObject({
      count: 600,
      missing: 600,
      gaps_truncated: true,
    });
    expect(scan.gaps).toHaveLength(100);
    expect(() => scan.add(1)).toThrow();
  });
  it('validates perpetual USDT instrument semantics without claiming historical limits', () => {
    const instrument = {
      symbol: 'BTCUSDT',
      contractType: 'LinearPerpetual',
      status: 'Trading',
      settleCoin: 'USDT',
      launchTime: '0',
      deliveryTime: '0',
      priceFilter: { tickSize: '0.10' },
      lotSizeFilter: {
        qtyStep: '0.001',
        minOrderQty: '0.001',
        minNotionalValue: '5',
        maxOrderQty: '100',
        maxMktOrderQty: '50',
      },
      leverageFilter: {
        minLeverage: '1',
        maxLeverage: '100',
        leverageStep: '0.01',
      },
      fundingInterval: 480,
    };
    expect(normalizeInstrument(instrument, 'fixture', 'BTCUSDT')).toMatchObject(
      {
        tick_size: '0.1',
        historical_validity: 'current_observation_reference_only',
      },
    );
    expect(() =>
      normalizeInstrument(
        { ...instrument, settleCoin: 'USDC' },
        'fixture',
        'BTCUSDT',
      ),
    ).toThrow();
    expect(() =>
      normalizeInstrument(
        { ...instrument, isPreListing: true },
        'fixture',
        'BTCUSDT',
      ),
    ).toThrow();
    expect(() =>
      normalizeInstrument(
        { ...instrument, priceFilter: { tickSize: '0' } },
        'fixture',
        'BTCUSDT',
      ),
    ).toThrow();
  });
});
