import { describe, it, expect, vi } from 'vitest';
import {
  ResearchController,
  researchMutationGuard,
} from '../src/research/research.controller.js';
import type { QuantBridge } from '../src/research/quant-bridge.service.js';
import type { ResearchConfigurationsService } from '../src/research-configurations/configurations.service.js';
import type { MarketDataService } from '../src/market-data/market-data.service.js';
function controller() {
  const call = vi.fn().mockResolvedValue({});
  const value = new ResearchController(
    { call } as unknown as QuantBridge,
    {} as ResearchConfigurationsService,
    {} as MarketDataService,
  );
  return { value, call };
}
describe('research HTTP boundary', () => {
  it('rejects cross-origin mutation while allowing same-origin proxy and CLI access', () => {
    expect(() =>
      researchMutationGuard({
        headers: { host: '127.0.0.1:5173', origin: 'http://evil.example' },
      }),
    ).toThrow();
    expect(() =>
      researchMutationGuard({
        headers: { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' },
      }),
    ).not.toThrow();
    expect(() =>
      researchMutationGuard({ headers: { host: 'localhost:3000' } }),
    ).not.toThrow();
  });
  it('rejects path traversal and unbounded pagination before spawning Python', () => {
    const { value, call } = controller();
    expect(() => value.model('../../secret')).toThrow();
    expect(() =>
      value.simulation('a'.repeat(64), { offset: 0, limit: 1001 }),
    ).toThrow();
    expect(() => value.catalog({ limit: 100, root: '../../' })).toThrow();
    expect(call).not.toHaveBeenCalled();
  });
  it('passes only managed artifact IDs and explicit pagination to the RPC', async () => {
    const { value, call } = controller();
    await value.simulation('a'.repeat(64), {
      kind: 'trades',
      offset: '50',
      limit: '50',
    });
    expect(call).toHaveBeenCalledWith('simulation', {
      id: 'a'.repeat(64),
      kind: 'trades',
      offset: 50,
      limit: 50,
    });
    for (const stream of ['mark:1m', 'index:5m']) {
      await value.dataset('00000000-0000-4000-8000-000000000001', { stream });
      expect(call).toHaveBeenCalledWith('dataset', {
        id: '00000000-0000-4000-8000-000000000001',
        stream,
        offset: 0,
        limit: 100,
      });
    }
  });
  it('never exposes execution activation or accepts a real deployment proposal', () => {
    const { value, call } = controller();
    expect(() => value.activate({ headers: {} })).toThrow();
    expect(() =>
      value.propose(
        {
          model_id: 'a'.repeat(64),
          target: 'real',
          note: 'Do not activate',
          acknowledge_research_only: true,
        },
        { headers: {} },
      ),
    ).toThrow();
    expect(call).not.toHaveBeenCalled();
  });
});
