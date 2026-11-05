import {
  INTERVAL_MS,
  MARKET_INTERVALS,
  researchPreset,
  type MarketTimeframe,
} from '@bybit/contracts';
import { BybitPublicClient } from '../src/market-data/bybit-public.client.js';

export const MARKET_START = 1735689600000;
export const instrumentFixture = {
  symbol: 'BTCUSDT',
  contractType: 'LinearPerpetual',
  status: 'Trading',
  settleCoin: 'USDT',
  launchTime: '1577836800000',
  deliveryTime: '0',
  isPreListing: false,
  priceFilter: { tickSize: '0.1' },
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
export function marketTestConfiguration() {
  const c = researchPreset();
  c.market.secondary_timeframes = [];
  c.features.enabled = c.features.enabled.filter((f) => f.timeframe === '1m');
  return c;
}

export function fixtureTransport() {
  const controls = {
    pageRows: 2,
    fundingIntervalMs: 28800000,
    priceShift: 0,
    omit: new Set<number>(),
    duplicates: false,
    conflict: false,
    ascending: false,
    incomplete: false,
    invalid: false,
    nonProgress: false,
    serverMs: Date.UTC(2026, 0, 10),
    failures: 0,
    forbidden: false,
    hold: null as null | (() => Promise<void>),
    holdOnce: false,
  };
  const success = (result: unknown) =>
    new Response(JSON.stringify({ retCode: 0, result }));
  const client = new BybitPublicClient({
    source: 'fixture',
    minIntervalMs: 0,
    sleep: async () => {},
    random: () => 0,
    fetcher: async (input) => {
      const url = new URL(input);
      const q = url.searchParams;
      if (controls.forbidden) return new Response('', { status: 403 });
      if (url.pathname === '/v5/market/time')
        return success({
          timeSecond: String(Math.floor(controls.serverMs / 1000)),
          timeNano: String(BigInt(controls.serverMs) * 1000000n),
        });
      if (url.pathname === '/v5/market/instruments-info')
        return success({
          category: 'linear',
          list: [instrumentFixture],
          nextPageCursor: '',
        });
      if (controls.failures > 0) {
        controls.failures--;
        throw new Error('fixture disconnected');
      }
      if (controls.hold && !controls.holdOnce) {
        controls.holdOnce = true;
        await controls.hold();
      }
      if (url.pathname === '/v5/market/funding/history') {
        const start = Number(q.get('startTime')),
          end = Number(q.get('endTime'));
        const list: unknown[] = [];
        for (
          let t =
            Math.floor(end / controls.fundingIntervalMs) *
            controls.fundingIntervalMs;
          t >= start && list.length < controls.pageRows;
          t -= controls.fundingIntervalMs
        )
          list.push({
            symbol: 'BTCUSDT',
            fundingRate: '-0.000100',
            fundingRateTimestamp: String(t),
          });
        return success({ category: 'linear', list });
      }
      const timeframe = (
        Object.keys(MARKET_INTERVALS) as MarketTimeframe[]
      ).find((tf) => MARKET_INTERVALS[tf] === q.get('interval'))!;
      const interval = INTERVAL_MS[timeframe];
      const start = Number(q.get('start')),
        end = Number(q.get('end'));
      const list: unknown[][] = [];
      const shift = controls.priceShift;
      const row = (t: number, extra = 0) => {
        const prices = [
          String(t),
          String(100 + shift + extra),
          String(102 + shift + extra),
          String(99 + shift + extra),
          String(101 + shift + extra),
        ];
        return url.pathname === '/v5/market/kline'
          ? [...prices, '2.00', '201']
          : prices;
      };
      for (
        let t = Math.floor(end / interval) * interval;
        t >= start && list.length < controls.pageRows;
        t -= interval
      )
        if (!controls.omit.has(t)) list.push(row(t));
      if (controls.nonProgress)
        return success({
          category: 'linear',
          symbol: 'BTCUSDT',
          list: [row(end + interval)],
        });
      if (controls.duplicates && list.length) list.push([...list[0]!]);
      if (controls.conflict && list.length)
        list.push(row(Number(list[0]![0]), 1));
      if (controls.invalid && list.length) list[0]![1] = 'NaN';
      if (controls.incomplete)
        list.unshift(row(Math.floor(controls.serverMs / interval) * interval));
      if (controls.ascending) list.reverse();
      return success({ category: 'linear', symbol: 'BTCUSDT', list });
    },
  });
  return { client, controls };
}
