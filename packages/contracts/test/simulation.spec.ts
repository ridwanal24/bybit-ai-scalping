import { describe, expect, it } from 'vitest';
import {
  simulationPolicySchema,
  simulationActionSchema,
  simulationRequestSchema,
  SIMULATION_ACCOUNTING_VECTORS,
} from '../src/index.js';

const policy = {
  simulation_policy_version: 'restricted_bar_v1',
  acknowledge_research_only: true,
  acknowledge_current_metadata: true,
  acknowledge_declared_funding_schedule: true,
  require_exchange_liquidation: false,
  funding_price_proxy: 'boundary_last_open',
  execution_latency_ms: 0,
  safety_reserve: '0',
  funding_schedule: [
    {
      start_ms: 1735689600000,
      end_ms: 1735776000000,
      interval_ms: 28800000,
      anchor_ms: 0,
    },
  ],
};
describe('simulation contracts', () => {
  it('requires all explicit restricted-research acknowledgements', () => {
    expect(simulationPolicySchema.safeParse(policy).success).toBe(true);
    for (const key of [
      'acknowledge_research_only',
      'acknowledge_current_metadata',
      'acknowledge_declared_funding_schedule',
    ] as const)
      expect(
        simulationPolicySchema.safeParse({ ...policy, [key]: false }).success,
      ).toBe(false);
    expect(
      simulationPolicySchema.safeParse({
        ...policy,
        require_exchange_liquidation: true,
      }).success,
    ).toBe(false);
    expect(
      simulationPolicySchema.safeParse({
        ...policy,
        funding_price_proxy: 'mark',
      }).success,
    ).toBe(false);
  });
  it.each([true, -1, 5, '1'])('rejects invalid action %s', (action) => {
    expect(
      simulationActionSchema.safeParse({ decision_ms: 0, action }).success,
    ).toBe(false);
  });
  it('bounds latency, identifiers and unknown request fields', () => {
    const request = {
      version: '1',
      dataset_id: '00000000-0000-4000-8000-000000000001',
      configuration_file: 'config.json',
      source_snapshot_file: null,
      normalizer_id: '0'.repeat(64),
      actions_file: 'actions.jsonl',
      episode_start_ms: 1735689600000,
      episode_end_ms: 1735776000000,
      policy,
    };
    expect(simulationRequestSchema.safeParse(request).success).toBe(true);
    expect(
      simulationRequestSchema.safeParse({ ...request, api_key: 'forbidden' })
        .success,
    ).toBe(false);
    expect(
      simulationPolicySchema.safeParse({
        ...policy,
        execution_latency_ms: 600001,
      }).success,
    ).toBe(false);
  });
  it('publishes independent long/short profit and loss examples', () => {
    expect(SIMULATION_ACCOUNTING_VECTORS.map((v) => v.final_wallet)).toEqual([
      '1004.795',
      '1004.805',
      '994.805',
      '994.795',
    ]);
  });
});
