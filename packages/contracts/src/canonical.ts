import { createHash } from 'node:crypto';
import type { ResearchConfiguration } from './schema.js';
import { canonicalJson } from './canonical-value.js';
export * from './canonical-value.js';

export function configurationHash(
  configuration: ResearchConfiguration,
): string {
  return createHash('sha256')
    .update(canonicalJson(configuration), 'utf8')
    .digest('hex');
}
