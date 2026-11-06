import { describe, expect, it } from 'vitest';
import {
  BybitPublicClient,
  BybitDataError,
} from '../src/market-data/bybit-public.client.js';

const response = (result: unknown, retCode = 0) =>
  new Response(JSON.stringify({ retCode, result }));
describe('public Bybit transport', () => {
  it('uses fixed public GET endpoint without credentials and rejects redirects', async () => {
    const client = new BybitPublicClient({
      minIntervalMs: 0,
      fetcher: async (url, init) => {
        expect(new URL(url).origin).toBe('https://api.bybit.com');
        expect(init.method).toBe('GET');
        expect(init.redirect).toBe('manual');
        expect(init.headers).toEqual({ accept: 'application/json' });
        return response({
          timeSecond: '1735689600',
          timeNano: '1735689600000000000',
        });
      },
    });
    expect(await client.serverTime()).toBe(1735689600000);
    const redirected = new BybitPublicClient({
      fetcher: async () =>
        new Response('', {
          status: 302,
          headers: { location: 'https://other.example' },
        }),
    });
    await expect(redirected.serverTime()).rejects.toMatchObject({
      code: 'upstream_http_error',
    });
  });
  it.each([429, 500, '10006', 'network'] as const)(
    'retries %s within the bounded attempt budget',
    async (failure) => {
      const waits: number[] = [];
      let calls = 0;
      const client = new BybitPublicClient({
        minIntervalMs: 0,
        random: () => 0,
        sleep: async (ms) => {
          waits.push(ms);
        },
        fetcher: async () => {
          calls++;
          if (calls === 1) {
            if (failure === 'network')
              throw new Error('untrusted raw network secret');
            if (failure === '10006') return response({}, 10006);
            return new Response('', { status: failure });
          }
          return response({
            timeSecond: '1735689600',
            timeNano: '1735689600000000000',
          });
        },
      });
      await client.serverTime();
      expect(calls).toBe(2);
      expect(waits).toEqual([1000]);
      expect(client.metrics.retries).toBe(1);
    },
  );
  it('exhausts retries without reflecting raw network error details', async () => {
    const client = new BybitPublicClient({
      minIntervalMs: 0,
      sleep: async () => {},
      fetcher: async () => {
        throw new Error('do_not_leak');
      },
    });
    await expect(client.serverTime()).rejects.toEqual(
      new BybitDataError('upstream_network_or_timeout', true),
    );
    expect(client.metrics.requests).toBe(4);
  });
  it('pauses on forbidden access and long rate reset instead of sleeping indefinitely', async () => {
    for (const status of [403, 429]) {
      const client = new BybitPublicClient({
        now: () => 1000,
        fetcher: async () =>
          new Response('', { status, headers: { 'retry-after': '600' } }),
        sleep: async () => {
          throw new Error('must not wait');
        },
      });
      await expect(client.serverTime()).rejects.toMatchObject({
        blockedUntil: 601000,
        resumable: true,
      });
      expect(client.metrics.requests).toBe(1);
    }
  });
  it.each([429, 503, '10006'] as const)(
    'preserves cooldown headers on the final %s attempt',
    async (failure) => {
      for (const header of ['short', 'long', 'date', 'reset'] as const) {
        let now = 1000000,
          calls = 0;
        const waits: number[] = [];
        const delay = header === 'short' ? 5000 : 600000;
        const client = new BybitPublicClient({
          minIntervalMs: 0,
          now: () => now,
          random: () => 0,
          sleep: async (ms) => {
            waits.push(ms);
            now += ms;
          },
          fetcher: async () => {
            calls++;
            const headers = new Headers();
            if (calls === 4) {
              if (header === 'reset')
                headers.set(
                  'x-bapi-limit-reset-timestamp',
                  String(now + delay),
                );
              else
                headers.set(
                  'retry-after',
                  header === 'date'
                    ? new Date(now + delay).toUTCString()
                    : String(delay / 1000),
                );
            }
            return failure === '10006'
              ? new Response(JSON.stringify({ retCode: 10006, result: {} }), {
                  headers,
                })
              : new Response('', { status: failure, headers });
          },
        });
        await expect(client.serverTime()).rejects.toMatchObject({
          code:
            failure === '10006'
              ? 'upstream_rate_limit'
              : 'upstream_rate_or_server_error',
          resumable: true,
          blockedUntil: 1007000 + delay,
        });
        expect(calls).toBe(4);
        expect(waits).toEqual([1000, 2000, 4000]);
        expect(client.metrics.retries).toBe(3);
      }
    },
  );
  it.each([
    new Response('not json'),
    response({}, 10001),
    new Response('{}'),
    response({ timeSecond: 'abc', timeNano: 'not-a-time' }),
    new Response('x'.repeat(2097153)),
  ])(
    'rejects invalid envelope/JSON/time/oversized body without blind retry',
    async (result) => {
      const client = new BybitPublicClient({
        fetcher: async () => result,
        minIntervalMs: 0,
      });
      await expect(client.serverTime()).rejects.toThrow();
      expect(client.metrics.requests).toBe(1);
    },
  );
  it('handles instrument cursor progress and explicitly fails repeated cursors', async () => {
    const client = new BybitPublicClient({
      minIntervalMs: 0,
      fetcher: async () =>
        response({ category: 'linear', list: [], nextPageCursor: 'same' }),
    });
    await expect(client.instrument('BTCUSDT')).rejects.toMatchObject({
      code: 'non_progressing_instrument_cursor',
    });
    expect(client.metrics.requests).toBe(2);
  });
  it('rejects mismatched candle and funding response identities', async () => {
    const wrong = new BybitPublicClient({
      minIntervalMs: 0,
      fetcher: async () =>
        response({ category: 'linear', symbol: 'ETHUSDT', list: [] }),
    });
    await expect(
      wrong.candles('BTCUSDT', '1m', 'last', 0, 60000),
    ).rejects.toMatchObject({ code: 'invalid_candle_identity_or_response' });
    const malformed = new BybitPublicClient({
      minIntervalMs: 0,
      fetcher: async () => response({ category: 'spot', list: [] }),
    });
    await expect(malformed.funding('BTCUSDT', 0, 60000)).rejects.toMatchObject({
      code: 'invalid_funding_response',
    });
  });
});
