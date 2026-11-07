import { describe, it, expect } from 'vitest';
import {
  dashboardProposalSchema,
  dashboardStartSchema,
} from '../src/dashboard.js';
import {
  canonicalJson as browserCanonical,
  validateConfiguration as browserValidate,
} from '../src/browser.js';
import { canonicalJson, researchPreset } from '../src/index.js';
describe('dashboard boundary contracts', () => {
  it('keeps browser canonicalization and configuration validation identical', () => {
    const c = researchPreset();
    expect(browserCanonical(c)).toBe(canonicalJson(c));
    expect(browserValidate(c).valid).toBe(true);
    c.risk.risk_per_trade = '1';
    expect(browserValidate(c).valid).toBe(false);
  });
  it('cannot encode a Paper/Demo/Real activation as a research proposal', () => {
    const v = {
      model_id: 'a'.repeat(64),
      target: 'backtest',
      note: 'Manual review required',
      acknowledge_research_only: true,
    };
    expect(dashboardProposalSchema.safeParse(v).success).toBe(true);
    for (const target of ['paper', 'demo', 'real'])
      expect(dashboardProposalSchema.safeParse({ ...v, target }).success).toBe(
        false,
      );
    expect(
      dashboardProposalSchema.safeParse({ ...v, activate: true }).success,
    ).toBe(false);
  });
  it('requires server-owned snapshots and bounded training resources, never client paths', () => {
    expect(
      dashboardStartSchema.shape.snapshot_id.safeParse('../../secret').success,
    ).toBe(false);
    expect(
      dashboardStartSchema.shape.resources.safeParse({ cpu_threads: 100 })
        .success,
    ).toBe(false);
  });
});
