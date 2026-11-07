import type { z } from 'zod';
import type {
  modelMetadataSchema,
  trainingValidationSchema,
  trainingJobSchema,
  evaluationReportSchema,
  baselineMetricsSchema,
  marketCandleSchema,
  simulationEquitySchema,
  simulationTradeSchema,
} from '@bybit/contracts';
export type Metadata = z.infer<typeof modelMetadataSchema>;
export type Validation = z.infer<typeof trainingValidationSchema>;
export type Job = z.infer<typeof trainingJobSchema> & {
  events?: Record<string, unknown>[];
  checkpoints?: string[];
};
export type Evaluation = z.infer<typeof evaluationReportSchema> & {
  id: string;
  integrity: string;
};
export type Metrics = z.infer<typeof baselineMetricsSchema>;
export type Candle = z.infer<typeof marketCandleSchema>;
export type Equity = z.infer<typeof simulationEquitySchema>;
export type Trade = z.infer<typeof simulationTradeSchema>;
export type Dataset = {
  id: string;
  fingerprint: string;
  configuration_snapshot_id: string;
  manifest: {
    symbol: string;
    source: string;
    requested_start_ms: number;
    requested_end_ms: number;
    streams: { id: string; count: number; start_ms: number; end_ms: number }[];
  };
  quality: {
    candles_usable: boolean;
    final: boolean;
    counters: Record<string, number>;
    metadata: { historical_validity: string };
    funding: { coverage: string };
  };
};
export type Model = {
  id: string;
  metadata: Metadata;
  validation: Validation;
  integrity: string;
  compatibility?: {
    current_code: boolean;
    blockers: string[];
    execution_ready: false;
  };
};
export type ReportSummary = {
  id: string;
  protocol_id: string;
  status: string;
  screen: Evaluation['screen'];
  rows: number;
};
export type Catalog = {
  datasets: Dataset[];
  models: Model[];
  evaluations: ReportSummary[];
  jobs: Job[];
  totals: Record<string, number>;
  errors: { kind: string; id: string; code: string }[];
};
export type Proposal = {
  id: string;
  model_id: string;
  created_at: string;
  target: string;
  note: string;
  status: string;
  blockers: string[];
  execution_ready: false;
};
const messages: Record<string, string> = {
  market_worker_busy:
    'Another download is active. Wait for it to finish or pause before starting another.',
  download_cooldown:
    'Bybit is temporarily limiting requests. Resume after the cooldown shown in the download history.',
  download_range_outside_snapshot_or_budget:
    'Choose a historical range of at most 366 days within the saved configuration.',
  download_record_budget_exceeded:
    'This range and its timeframes exceed the download limit. Shorten the range or select fewer timeframes.',
  stale_revision:
    'This configuration changed. Refresh configurations and select the saved revision again.',
  invalid_or_unavailable_research_artifact:
    'The artifact or research settings could not be verified. Check the dataset, snapshot and limits.',
  training_worker_busy:
    'Another training job is active. Review it before starting another.',
  quant_request_timeout:
    'Verification took too long. Retry when the worker is available.',
  cross_origin_mutation_forbidden:
    'This change must be made from the local research dashboard.',
  sealed_dataset_required: 'Training requires a ready, sealed dataset.',
  research_artifact_not_found: 'This artifact is no longer available.',
  execution_not_available_in_research_dashboard:
    'Execution is unavailable in the research dashboard.',
};
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly issues: { field?: string; message?: string; code?: string }[] = [],
  ) {
    super(messages[code] ?? code.replaceAll('_', ' '));
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response
    .json()
    .catch(() => ({ code: 'invalid_backend_response' }));
  if (!response.ok)
    throw new ApiError(
      response.status,
      body.code ?? 'backend_unavailable',
      body.issues ?? [],
    );
  return body as T;
}
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export function short(id: string) {
  return id.slice(0, 10);
}
export function amount(value: unknown, digits = 2) {
  if (value === null || value === undefined) return 'Unavailable';
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : 'Unavailable';
}
export function percent(value: unknown) {
  return value === null || value === undefined
    ? 'Undefined'
    : `${amount(Number(value) * 100)}%`;
}
export function utc(time: number | string) {
  const d = new Date(time);
  return Number.isFinite(d.getTime())
    ? d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : 'Unavailable';
}
