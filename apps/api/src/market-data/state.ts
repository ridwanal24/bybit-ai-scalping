import { z } from 'zod';
import { TIMEFRAMES } from '@bybit/contracts';

const ms = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const descriptorSchema = z.strictObject({
  source: z.enum(['bybit-mainnet', 'fixture']),
  symbol: z.string(),
  category: z.literal('linear'),
  configuration_hash: z.string(),
  start_ms: ms,
  end_ms: ms,
  streams: z.array(
    z.strictObject({
      id: z.string(),
      price_type: z.enum(['last', 'mark', 'index']),
      timeframe: z.enum(TIMEFRAMES),
    }),
  ),
});
export type DatasetDescriptor = z.infer<typeof descriptorSchema>;
export const checkpointSchema = z.strictObject({
  version: z.literal(1),
  cutoff_ms: ms.nullable(),
  initialized: z.boolean(),
  phase: z.enum(['collect', 'finalize']),
  streams: z.array(
    z.strictObject({
      id: z.string(),
      price_type: z.enum(['last', 'mark', 'index']),
      timeframe: z.enum(TIMEFRAMES),
      start_ms: ms,
      end_ms: ms,
      cursor_ms: ms.nullable(),
    }),
  ),
  funding: z.strictObject({
    start_ms: ms,
    end_ms: ms,
    cursor_ms: ms.nullable(),
  }),
  metrics: z.strictObject({
    pages: ms,
    invalid: ms,
    duplicates: ms,
    conflicts: ms,
    out_of_order: ms,
    outside_range: ms,
    incomplete: ms,
    retries: ms,
    resumes: ms,
  }),
});
export type DownloadCheckpoint = z.infer<typeof checkpointSchema>;
export function newCheckpoint(): DownloadCheckpoint {
  return {
    version: 1,
    cutoff_ms: null,
    initialized: false,
    phase: 'collect',
    streams: [],
    funding: { start_ms: 0, end_ms: 0, cursor_ms: null },
    metrics: {
      pages: 0,
      invalid: 0,
      duplicates: 0,
      conflicts: 0,
      out_of_order: 0,
      outside_range: 0,
      incomplete: 0,
      retries: 0,
      resumes: 0,
    },
  };
}
