import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResearchConfiguration } from '@bybit/contracts/browser';
import { api, post, utc, short } from './api';
import { Badge, ErrorBox, Loading } from './components';
import type { Snapshot } from './Configuration';

type Draft = {
  id: string;
  name: string;
  revision: number;
  payload: ResearchConfiguration;
};
type Download = {
  id: string;
  snapshot_id: string;
  dataset_id: string;
  status: string;
  dataset_status: string;
  exported: boolean;
  preparing: boolean;
  symbol: string;
  start_ms: number;
  end_ms: number;
  streams: string[];
  blocked_until: string | null;
  lease_expires: string | null;
  last_error: string | null;
  checkpoint: {
    initialized: boolean;
    phase: string;
    metrics: { pages: number; retries: number };
    streams: { id: string; cursor_ms: number | null }[];
  };
};

export function MarketDownloads({
  onRefresh,
  onTrain,
}: {
  onRefresh: () => void;
  onTrain: (datasetId: string, snapshot: Snapshot) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState('');
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [error, setError] = useState<Error>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState('');
  const exported = useRef<Set<string> | null>(null);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const result = await api<{ items: Download[] }>(
        `/market-data/downloads?limit=20&offset=${offset}`,
        { signal },
      );
      if (signal?.aborted) return;
      const ready = new Set(
        result.items.filter((d) => d.exported).map((d) => d.dataset_id),
      );
      if (
        exported.current &&
        [...ready].some((id) => !exported.current!.has(id))
      )
        onRefresh();
      exported.current = ready;
      setDownloads(result.items);
    },
    [offset, onRefresh],
  );
  const loadDrafts = useCallback(async (signal?: AbortSignal) => {
    const result = await api<{ items: Draft[] }>('/configurations?limit=100', {
      signal,
    });
    if (!signal?.aborted) setDrafts(result.items);
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await refresh(ctrl.signal);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e as Error);
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
          timer = setTimeout(() => void poll(), 2500);
        }
      }
    };
    void loadDrafts(ctrl.signal).catch((e: Error) => {
      if (!ctrl.signal.aborted) setError(e);
    });
    void poll();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [refresh, loadDrafts]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Request failed'));
    } finally {
      await refresh().catch((e: Error) => setError(e));
      setBusy(false);
    }
  }
  const draft = drafts.find((d) => d.id === selected);
  const active = downloads.some(
    (d) =>
      d.preparing ||
      (d.status === 'RUNNING' &&
        Date.parse(d.lease_expires ?? '') > Date.now()),
  );
  return (
    <section className="panel" aria-label="Historical data downloads">
      <div className="section-heading">
        <h2>Download historical prices</h2>
        <button
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await loadDrafts();
            })
          }
        >
          Refresh downloads & configurations
        </button>
      </div>
      <p>
        Select a saved configuration. Its symbol, timeframes and UTC date range
        will be used. A snapshot is frozen automatically before downloading.
      </p>
      <label>
        Download configuration
        <select
          aria-label="Download configuration"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select configuration</option>
          {drafts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · revision {d.revision} · {d.payload.market.symbol}
            </option>
          ))}
        </select>
      </label>
      {draft ? (
        <div className="notice">
          <strong>{draft.payload.market.symbol}</strong> ·{' '}
          {[
            draft.payload.market.timeframe,
            ...draft.payload.market.secondary_timeframes,
          ].join(', ')}
          <p>
            {utc(draft.payload.market.historical_start_ms)} →{' '}
            {utc(draft.payload.market.historical_end_ms)}
          </p>
        </div>
      ) : (
        <p>
          Set your symbol and dates in{' '}
          <a href="#configuration">Configuration</a>, then save a draft.
        </p>
      )}
      <div className="action-bar">
        <button
          className="primary"
          disabled={!draft || busy || active}
          onClick={() =>
            void action(async () => {
              if (!draft) return;
              const snapshot = await post<{ id: string }>(
                `/configurations/${draft.id}/snapshots`,
                { expectedRevision: draft.revision },
              );
              const created = await post<{ download_id: string }>(
                '/market-data/downloads',
                { configurationSnapshotId: snapshot.id },
              );
              await post(
                `/market-data/downloads/${created.download_id}/start`,
                {},
              );
              setMessage(
                'Download started. You can leave this page; the backend continues downloading.',
              );
              setOffset(0);
            })
          }
        >
          {busy ? 'Working…' : 'Download historical data'}
        </button>
        <span role="status">{message}</span>
      </div>
      {error && (
        <ErrorBox
          error={error}
          retry={() =>
            void action(async () => {
              await loadDrafts();
            })
          }
        />
      )}
      {loading && <Loading label="Loading download history…" />}
      {!loading && !downloads.length && <p>No downloads yet.</p>}
      {downloads.map((d) => {
        const running =
          d.preparing ||
          (d.status === 'RUNNING' &&
            Date.parse(d.lease_expires ?? '') > Date.now());
        const cooldown =
          d.blocked_until && Date.parse(d.blocked_until) > Date.now();
        const ready = d.exported && !d.preparing;
        const canResume =
          !running &&
          !ready &&
          d.status !== 'FAILED' &&
          d.dataset_status !== 'QUALITY_FAILED';
        return (
          <article
            className="advanced"
            key={d.id}
            aria-label={`Download ${d.symbol} ${short(d.id)}`}
          >
            <div className="section-heading">
              <h3>{d.symbol}</h3>
              <Badge tone={ready ? 'good' : undefined}>
                {ready
                  ? 'Ready for training'
                  : running && d.status === 'COMPLETED'
                    ? 'Preparing dataset'
                    : d.status === 'RUNNING' && !running
                      ? 'Interrupted'
                      : d.status}
              </Badge>
            </div>
            <p>
              {utc(d.start_ms)} → {utc(d.end_ms)}
            </p>
            <p>
              {d.streams.join(', ')} · {d.checkpoint.metrics.pages} pages
              downloaded · {d.checkpoint.metrics.retries} retries
            </p>
            {d.checkpoint.initialized && (
              <p>
                {
                  d.checkpoint.streams.filter((s) => s.cursor_ms === null)
                    .length
                }
                /{d.checkpoint.streams.length} candle streams complete
              </p>
            )}
            {d.last_error && (
              <p role="status">
                {d.last_error.replaceAll('_', ' ')}.{' '}
                {d.status === 'FAILED'
                  ? 'Create a new download after correcting the configuration.'
                  : 'You can retry when the service is available.'}
              </p>
            )}
            {cooldown && <p>Bybit cooldown until {utc(d.blocked_until!)}.</p>}
            {d.dataset_status === 'QUALITY_FAILED' && (
              <p role="alert">
                Data quality checks failed. This dataset cannot be used for
                training.
              </p>
            )}
            {canResume && (
              <button
                disabled={busy || active || Boolean(cooldown)}
                onClick={() =>
                  void action(async () => {
                    await post(`/market-data/downloads/${d.id}/start`, {});
                    setMessage(
                      'Download resumed. Existing progress is preserved.',
                    );
                  })
                }
              >
                {d.status === 'COMPLETED'
                  ? 'Retry dataset preparation'
                  : d.status === 'PENDING'
                    ? 'Start download'
                    : 'Resume download'}
              </button>
            )}
            {ready && (
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const snapshot = await api<Snapshot>(
                      `/configuration-snapshots/${d.snapshot_id}`,
                    );
                    onTrain(d.dataset_id, snapshot);
                  })
                }
              >
                Open Training
              </button>
            )}
          </article>
        );
      })}
      <div className="pager">
        <button
          disabled={offset === 0}
          onClick={() => setOffset((n) => Math.max(0, n - 20))}
        >
          Previous downloads
        </button>
        <span>
          Downloads {offset + 1}–{offset + downloads.length}
        </span>
        <button
          disabled={downloads.length < 20}
          onClick={() => setOffset((n) => n + 20)}
        >
          Next downloads
        </button>
      </div>
    </section>
  );
}
