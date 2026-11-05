import { configurationHash, canonicalJson } from './canonical.js';
import {
  validateConfiguration,
  type ConfigurationIssue,
} from './validation.js';
import type { ResearchConfiguration } from './schema.js';

export function compareConfigurations(
  reference: ResearchConfiguration,
  candidate: unknown,
) {
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const c = candidate as Record<string, unknown>;
    const mismatches = (
      ['schema_version', 'contract_version', 'action_schema_version'] as const
    ).filter((key) => typeof c[key] === 'string' && c[key] !== reference[key]);
    if (mismatches.length)
      return {
        status: 'incompatible' as const,
        changed_fields: mismatches,
        behavioral_review_required: true,
        issues: [] as ConfigurationIssue[],
      };
  }
  const result = validateConfiguration(candidate);
  if (!result.valid)
    return {
      status: 'invalid_candidate' as const,
      changed_fields: [],
      behavioral_review_required: true,
      issues: result.issues,
    };
  const c = result.configuration;
  if (configurationHash(reference) === configurationHash(c))
    return {
      status: 'exact_config_match' as const,
      changed_fields: [],
      behavioral_review_required: false,
      issues: [] as ConfigurationIssue[],
    };
  const fields = (
    Object.keys(reference) as (keyof ResearchConfiguration)[]
  ).filter((key) => canonicalJson(reference[key]) !== canonicalJson(c[key]));
  const retrain =
    fields.some((key) =>
      ['features', 'network', 'training', 'stop_loss', 'exit'].includes(key),
    ) ||
    canonicalJson({ ...reference.market, mode: undefined }) !==
      canonicalJson({ ...c.market, mode: undefined });
  return {
    status: retrain
      ? ('retraining_required' as const)
      : ('reevaluation_required' as const),
    changed_fields: fields,
    behavioral_review_required: true,
    issues: [] as ConfigurationIssue[],
  };
}
