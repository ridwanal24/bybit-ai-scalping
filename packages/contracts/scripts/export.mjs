import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  configurationSchema,
  researchPreset,
  validateConfiguration,
  configurationHash,
  canonicalJson,
  DECIMAL_FIELD_NAMES,
} from '../dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const valid = researchPreset();
const fractional = structuredClone(valid);
fractional.risk.initial_capital = '1000.00';
fractional.exit.rr = '2.000';
const cases = [
  {
    name: 'research-preset',
    configuration: valid,
    structurally_valid: true,
    semantically_valid: true,
  },
  {
    name: 'decimal-equivalence',
    configuration: fractional,
    structurally_valid: true,
    semantically_valid: true,
  },
];
for (const artifact of ['1.00', '1']) {
  const c = structuredClone(valid);
  c.features.normalization.artifact_id = artifact;
  cases.push({
    name: `artifact-identity-${artifact}`,
    configuration: c,
    structurally_valid: true,
    semantically_valid: true,
  });
}
for (const [name, mutate, structural] of [
  [
    'unknown-field',
    (c) => {
      c.unknown = true;
    },
    false,
  ],
  [
    'wrong-integer-type',
    (c) => {
      c.training.batch_size = '64';
    },
    false,
  ],
  [
    'unsupported-version',
    (c) => {
      c.schema_version = '2';
    },
    false,
  ],
  [
    'missing-field',
    (c) => {
      delete c.risk;
    },
    false,
  ],
  [
    'decimal-exponent',
    (c) => {
      c.risk.initial_capital = '1e3';
    },
    false,
  ],
  [
    'negative-zero',
    (c) => {
      c.execution.maker_fee_rate = '-0.00';
    },
    false,
  ],
  [
    'feature-id',
    (c) => {
      c.features.enabled[0].id = 'future_unknown_feature';
    },
    false,
  ],
  [
    'hard-stop-disabled',
    (c) => {
      c.stop_loss.hard_stop_required = false;
    },
    false,
  ],
  [
    'exit-mode-conflict',
    (c) => {
      c.exit.ai_close_enabled = false;
    },
    true,
  ],
  [
    'risk-budget-order',
    (c) => {
      c.risk.risk_per_trade = '0.03';
    },
    true,
  ],
  [
    'higher-timeframe',
    (c) => {
      c.features.enabled[0].timeframe = '4h';
    },
    true,
  ],
]) {
  const c = structuredClone(valid);
  mutate(c);
  cases.push({
    name,
    configuration: c,
    structurally_valid: structural,
    semantically_valid: false,
  });
}
const vectors = cases
  .filter((item) => item.semantically_valid)
  .map((item) => {
    const result = validateConfiguration(item.configuration);
    if (!result.valid)
      throw new Error('Export preset failed semantic validation');
    return {
      name: item.name,
      configuration: item.configuration,
      canonical_json: canonicalJson(result.configuration),
      sha256: configurationHash(result.configuration),
    };
  });
const outputs = {
  'schemas/configuration-v1.schema.json': {
    ...z.toJSONSchema(configurationSchema, { target: 'draft-2020-12' }),
    $id: 'urn:bybit:configuration:1',
  },
  'fixtures/configuration-cases.json': cases,
  'fixtures/canonical-vectors.json': vectors,
  'fixtures/canonical-rules.json': {
    decimal_fields: DECIMAL_FIELD_NAMES,
    version: '1',
  },
  'presets/research-small-hybrid-v1.json': valid,
};
for (const [relative, data] of Object.entries(outputs)) {
  const target = path.join(root, relative);
  const text = JSON.stringify(data, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text)
      throw new Error(`Contract artifact drift: ${relative}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
}
console.log(
  process.argv.includes('--check')
    ? 'Contract exports match source.'
    : 'Contract schema, fixtures and preset exported.',
);
