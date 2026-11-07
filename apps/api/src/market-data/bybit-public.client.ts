import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  normalizeInstrument,
  parseTimestamp,
  type InstrumentObservation,
  type MarketSource,
  type MarketTimeframe,
  type PriceType,
  MARKET_INTERVALS,
} from '@bybit/contracts';
import { z } from 'zod';

export const BYBIT_CLIENT_OPTIONS = Symbol('BYBIT_CLIENT_OPTIONS');
export type BybitClientOptions = {
  fetcher?: (url: string, init: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  minIntervalMs?: number;
  timeoutMs?: number;
  source?: MarketSource;
};
export class BybitDataError extends Error {
  constructor(
    readonly code: string,
    readonly resumable = false,
    readonly blockedUntil: number | null = null,
  ) {
    super(code);
  }
}
const envelope = z.object({ retCode: z.number().int(), result: z.unknown() });
const candleResult = z.object({
  category: z.literal('linear'),
  symbol: z.string(),
  list: z.array(z.unknown()).max(1000),
});
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

@Injectable()
export class BybitPublicClient {
  readonly source: MarketSource;
  readonly metrics = { retries: 0, requests: 0 };
  private readonly options: Required<BybitClientOptions>;
  private lastStart = -Infinity;
  private queue = Promise.resolve();
  private symbolsCache?: { items: string[]; expires: number };
  private symbolsRequest?: Promise<string[]>;

  constructor(
    @Optional() @Inject(BYBIT_CLIENT_OPTIONS) options?: BybitClientOptions,
  ) {
    this.options = {
      fetcher: (url, init) => fetch(url, init),
      sleep,
      now: Date.now,
      random: Math.random,
      minIntervalMs: 1000,
      timeoutMs: 10000,
      source: 'bybit-mainnet',
      ...options,
    };
    this.source = this.options.source;
  }

  private get(
    endpoint: string,
    params: Record<string, string> = {},
  ): Promise<unknown> {
    const pending = this.queue.then(() => this.request(endpoint, params));
    this.queue = pending.then(
      () => {},
      () => {},
    );
    return pending;
  }

  private async boundedBody(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new BybitDataError('empty_upstream_body');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.byteLength;
        if (size > 2097152) {
          await reader.cancel();
          throw new BybitDataError('upstream_payload_too_large');
        }
        chunks.push(item.value);
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  private async request(
    endpoint: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const allowed = [
      '/v5/market/time',
      '/v5/market/instruments-info',
      '/v5/market/kline',
      '/v5/market/mark-price-kline',
      '/v5/market/index-price-kline',
      '/v5/market/funding/history',
    ];
    if (!allowed.includes(endpoint))
      throw new BybitDataError('endpoint_not_allowed');
    const url = new URL(endpoint, 'https://api.bybit.com');
    url.search = new URLSearchParams(params).toString();
    for (let attempt = 0; attempt < 4; attempt++) {
      const throttle =
        this.options.minIntervalMs - (this.options.now() - this.lastStart);
      if (throttle > 0) await this.options.sleep(throttle);
      this.lastStart = this.options.now();
      this.metrics.requests++;
      let retryAfter = 0;
      try {
        const response = await this.options.fetcher(url.href, {
          method: 'GET',
          redirect: 'manual',
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });
        if (response.status === 403) {
          await response.body?.cancel();
          throw new BybitDataError(
            'public_access_forbidden',
            true,
            this.options.now() + 600000,
          );
        }
        if (response.status === 429 || response.status >= 500) {
          retryAfter = this.retryDelay(response.headers);
          await response.body?.cancel();
          throw new BybitDataError('upstream_rate_or_server_error', true);
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new BybitDataError('upstream_http_error');
        }
        const text = await this.boundedBody(response);
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new BybitDataError('malformed_upstream_json');
        }
        const parsed = envelope.safeParse(data);
        if (!parsed.success)
          throw new BybitDataError('invalid_upstream_envelope');
        if (parsed.data.retCode === 10006) {
          retryAfter = this.retryDelay(response.headers);
          throw new BybitDataError('upstream_rate_limit', true);
        }
        if (parsed.data.retCode !== 0)
          throw new BybitDataError('upstream_rejected_request');
        return parsed.data.result;
      } catch (error) {
        const typed =
          error instanceof BybitDataError
            ? error
            : new BybitDataError('upstream_network_or_timeout', true);
        if (!typed.resumable || typed.blockedUntil !== null) throw typed;
        if (attempt === 3) {
          // The attempt budget ends here, but the upstream cooldown still applies
          // to a later run/worker, including short Retry-After delays.
          if (retryAfter > 0)
            throw new BybitDataError(
              typed.code,
              true,
              this.options.now() + retryAfter,
            );
          throw typed;
        }
        const delay = Math.max(
          retryAfter,
          1000 * 2 ** attempt + Math.floor(this.options.random() * 250),
        );
        if (delay > 30000)
          throw new BybitDataError(
            'upstream_cooldown',
            true,
            this.options.now() + delay,
          );
        this.metrics.retries++;
        await this.options.sleep(delay);
      }
    }
    throw new BybitDataError('upstream_retry_exhausted', true);
  }

  private retryDelay(headers: Headers): number {
    const after = headers.get('retry-after');
    let delay = 0;
    if (after !== null) {
      if (/^\d+$/.test(after)) delay = Number(after) * 1000;
      else if (Number.isFinite(Date.parse(after)))
        delay = Date.parse(after) - this.options.now();
    }
    const reset = Number(headers.get('x-bapi-limit-reset-timestamp'));
    return Math.max(
      0,
      Number.isFinite(delay) ? delay : 0,
      Number.isSafeInteger(reset) ? reset - this.options.now() : 0,
    );
  }

  async serverTime(): Promise<number> {
    const data = z
      .object({ timeSecond: z.string().max(16), timeNano: z.string().max(25) })
      .safeParse(await this.get('/v5/market/time'));
    if (!data.success || !/^\d+$/.test(data.data.timeNano))
      throw new BybitDataError('invalid_server_time');
    const n = Number(BigInt(data.data.timeNano) / 1000000n);
    if (
      !Number.isSafeInteger(n) ||
      n <= 0 ||
      Math.abs(Math.floor(n / 1000) - parseTimestamp(data.data.timeSecond)) > 1
    )
      throw new BybitDataError('invalid_server_time');
    return n;
  }

  async symbols(): Promise<string[]> {
    if (this.symbolsCache && this.symbolsCache.expires > this.options.now())
      return [...this.symbolsCache.items];
    this.symbolsRequest ??= this.loadSymbols();
    try {
      return [...(await this.symbolsRequest)];
    } finally {
      this.symbolsRequest = undefined;
    }
  }

  private async loadSymbols(): Promise<string[]> {
    const symbols = new Set<string>();
    const seen = new Set<string>();
    let cursor = '';
    for (let page = 0; page < 100; page++) {
      const data = z
        .object({
          category: z.literal('linear'),
          list: z
            .array(
              z.object({
                symbol: z.string().min(1).max(100),
                contractType: z.string(),
                status: z.string(),
                quoteCoin: z.string(),
                settleCoin: z.string(),
              }),
            )
            .max(1000),
          nextPageCursor: z.string().optional(),
        })
        .safeParse(
          await this.get('/v5/market/instruments-info', {
            category: 'linear',
            status: 'Trading',
            limit: '1000',
            ...(cursor ? { cursor } : {}),
          }),
        );
      if (!data.success)
        throw new BybitDataError('invalid_instrument_response');
      for (const item of data.data.list) {
        if (
          item.contractType === 'LinearPerpetual' &&
          item.status === 'Trading' &&
          item.quoteCoin === 'USDT' &&
          item.settleCoin === 'USDT' &&
          /^[A-Z0-9]+USDT$/.test(item.symbol)
        )
          symbols.add(item.symbol);
      }
      const next = data.data.nextPageCursor ?? '';
      if (!next) {
        const items = [...symbols].sort();
        if (!items.length) throw new BybitDataError('instrument_not_found');
        this.symbolsCache = { items, expires: this.options.now() + 300000 };
        return items;
      }
      if (seen.has(next))
        throw new BybitDataError('non_progressing_instrument_cursor');
      seen.add(next);
      cursor = next;
    }
    throw new BybitDataError('instrument_page_budget_exceeded');
  }

  async instrument(symbol: string): Promise<InstrumentObservation> {
    let cursor = '';
    const seen = new Set<string>();
    for (let page = 0; page < 100; page++) {
      const params: Record<string, string> = {
        category: 'linear',
        symbol,
        limit: '1000',
      };
      if (cursor) params.cursor = cursor;
      const data = z
        .object({
          category: z.literal('linear'),
          list: z.array(z.unknown()).max(1000),
          nextPageCursor: z.string().optional(),
        })
        .safeParse(await this.get('/v5/market/instruments-info', params));
      if (!data.success)
        throw new BybitDataError('invalid_instrument_response');
      const found = data.data.list.find(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          'symbol' in item &&
          item.symbol === symbol,
      );
      if (found) return normalizeInstrument(found, this.source, symbol);
      const next = data.data.nextPageCursor ?? '';
      if (!next) throw new BybitDataError('instrument_not_found');
      if (seen.has(next))
        throw new BybitDataError('non_progressing_instrument_cursor');
      seen.add(next);
      cursor = next;
    }
    throw new BybitDataError('instrument_page_budget_exceeded');
  }

  async candles(
    symbol: string,
    timeframe: MarketTimeframe,
    priceType: PriceType,
    start: number,
    end: number,
  ): Promise<unknown[]> {
    const endpoint =
      priceType === 'last'
        ? '/v5/market/kline'
        : `/v5/market/${priceType}-price-kline`;
    const parsed = candleResult.safeParse(
      await this.get(endpoint, {
        category: 'linear',
        symbol,
        interval: MARKET_INTERVALS[timeframe],
        start: String(start),
        end: String(end),
        limit: '1000',
      }),
    );
    if (!parsed.success || parsed.data.symbol !== symbol)
      throw new BybitDataError('invalid_candle_identity_or_response');
    return parsed.data.list;
  }

  async funding(
    symbol: string,
    start: number,
    end: number,
  ): Promise<unknown[]> {
    const data = z
      .object({
        category: z.literal('linear'),
        list: z.array(z.unknown()).max(200),
      })
      .safeParse(
        await this.get('/v5/market/funding/history', {
          category: 'linear',
          symbol,
          startTime: String(start),
          endTime: String(end),
          limit: '200',
        }),
      );
    if (!data.success) throw new BybitDataError('invalid_funding_response');
    return data.data.list;
  }
}
