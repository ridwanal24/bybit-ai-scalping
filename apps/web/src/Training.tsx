import { useEffect, useState } from 'react';
import { post, api, short, utc, amount, type Catalog, type Job } from './api';
import { Badge, Empty, ErrorBox, Loading } from './components';
import type { Snapshot } from './Configuration';

export function Training({
  catalog,
  snapshot,
  onRefresh,
}: {
  catalog: Catalog;
  snapshot: Snapshot | null;
  onRefresh: () => void;
}) {
  const [dataset, setDataset] = useState(catalog.datasets[0]?.id ?? '');
  const [jobId, setJobId] = useState<string>();
  const [detail, setDetail] = useState<Job>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [ack, setAck] = useState(false);
  const [wall, setWall] = useState(120);
  const [memory, setMemory] = useState(3072);
  const [epochs, setEpochs] = useState(2);
  const [startTime, setStart] = useState('');
  const [endTime, setEnd] = useState('');
  const [retry, setRetry] = useState(0);
  const selected = catalog.datasets.find((x) => x.id === dataset);
  useEffect(() => {
    if (selected) {
      setStart(String(selected.manifest.requested_start_ms));
      setEnd(String(selected.manifest.requested_end_ms));
    }
  }, [selected]);
  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    async function poll() {
      try {
        const value = await api<Job>('/research/jobs/' + jobId, {
          signal: controller.signal,
        });
        if (disposed) return;
        setDetail(value);
        setError(undefined);
        if (['QUEUED', 'RUNNING', 'CANCELLING'].includes(value.state))
          timer = setTimeout(poll, 2000);
        else onRefresh();
      } catch (e) {
        if (!disposed)
          setError(e instanceof Error ? e : new Error('Job unavailable'));
      }
    }
    poll();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId, retry, onRefresh]);
  async function start() {
    if (!snapshot || !selected) return;
    setBusy(true);
    setError(undefined);
    try {
      const began = Number(startTime),
        ended = Number(endTime);
      const value = await post<Job>('/research/jobs', {
        dataset_id: dataset,
        snapshot_id: snapshot.id,
        range_start_ms: began,
        range_end_ms: ended,
        ppo_epochs: epochs,
        resources: {
          cpu_threads: 1,
          max_wall_seconds: wall,
          max_memory_mb: memory,
          max_timesteps: snapshot.payload.training.total_timesteps,
          max_checkpoints: 2,
        },
        policy: {
          simulation_policy_version: 'restricted_bar_v1',
          acknowledge_research_only: ack,
          acknowledge_current_metadata: ack,
          acknowledge_declared_funding_schedule: ack,
          require_exchange_liquidation: false,
          funding_price_proxy: 'boundary_last_open',
          execution_latency_ms: 0,
          safety_reserve: '0',
          funding_schedule: [
            {
              start_ms: began,
              end_ms: ended,
              interval_ms: 28800000,
              anchor_ms: 0,
            },
          ],
        },
      });
      setDetail(value);
      setJobId(value.job_id);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Training admission failed'));
    } finally {
      setBusy(false);
    }
  }
  const progress = detail?.progress;
  const active =
    detail && ['QUEUED', 'RUNNING', 'CANCELLING'].includes(detail.state);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">BOUNDED CPU RESEARCH</p>
          <h1>Training</h1>
          <p>
            Frozen configuration. Train-only preprocessing. Persistent jobs.
          </p>
        </div>
        <Badge>1 worker · CPU</Badge>
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="section-heading">
            <h2>Start a training run</h2>
            <span>MaskablePPO</span>
          </div>
          {snapshot ? (
            <div className="snapshot">
              <Badge tone="good">Frozen snapshot</Badge>
              <strong>{short(snapshot.id)}</strong>
              <p>
                {snapshot.payload.market.symbol} /{' '}
                {snapshot.payload.market.timeframe} ·{' '}
                {snapshot.payload.network.preset} ·{' '}
                {snapshot.payload.training.total_timesteps.toLocaleString()}{' '}
                steps · seed {snapshot.payload.training.seed}
              </p>
            </div>
          ) : (
            <div className="notice">
              <strong>A snapshot is required.</strong>
              <p>
                Save and freeze a configuration first.{' '}
                <a href="#configuration">Open Configuration →</a>
              </p>
            </div>
          )}
          <div className="form-grid">
            <label className="full-width">
              Dataset
              <select
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
              >
                <option value="">Choose a dataset</option>
                {catalog.datasets.map((d) => (
                  <option value={d.id} key={d.id}>
                    {d.manifest.symbol} · {short(d.id)} ·{' '}
                    {utc(d.manifest.requested_start_ms).slice(0, 10)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Range start (UTC ms)
              <input
                type="number"
                value={startTime}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Range end (UTC ms)
              <input
                type="number"
                value={endTime}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <label>
              Wall limit (seconds)
              <input
                type="number"
                value={wall}
                onChange={(e) => setWall(Number(e.target.value))}
              />
            </label>
            <label>
              Memory limit (MiB)
              <input
                type="number"
                value={memory}
                onChange={(e) => setMemory(Number(e.target.value))}
              />
            </label>
            <label>
              PPO epochs
              <input
                type="number"
                value={epochs}
                min="1"
                max="10"
                onChange={(e) => setEpochs(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="check assumption">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            I accept research-only execution, current metadata, an explicitly
            declared 8-hour funding schedule, and the last-open funding price
            proxy.
          </label>
          <button
            className="primary"
            disabled={!snapshot || !dataset || !ack || busy || Boolean(active)}
            onClick={start}
          >
            {busy ? 'Admitting job…' : 'Start training'}
          </button>
          <p className="muted">
            Data is not downloaded here. Only verified, sealed exports are
            admitted. Requested steps and rollout size must match.
          </p>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Run progress</h2>
            {detail && (
              <Badge
                tone={
                  detail.state === 'SUCCEEDED'
                    ? 'good'
                    : detail.state === 'FAILED' ||
                        detail.state === 'RESOURCE_LIMIT'
                      ? 'bad'
                      : 'neutral'
                }
              >
                {detail.state}
              </Badge>
            )}
          </div>
          {!jobId ? (
            <Empty title="Select or start a run">
              Progress, optimization events and checkpoints appear here.
            </Empty>
          ) : !detail ? (
            <Loading label="Reading persistent job status…" />
          ) : (
            <>
              <p className="mono">{detail.job_id}</p>
              <label className="progress-label">
                Timesteps{' '}
                <span>
                  {progress?.timesteps ?? 0} /{' '}
                  {progress?.total_timesteps ?? '—'}
                </span>
                <progress
                  max={progress?.total_timesteps || 1}
                  value={progress?.timesteps ?? 0}
                />
              </label>
              <div className="stat-pairs">
                <span>
                  Phase<strong>{progress?.phase ?? detail.state}</strong>
                </span>
                <span>
                  Worker RSS
                  <strong>
                    {amount(
                      progress?.rss_mb ?? detail.usage?.sampled_peak_rss_mb,
                    )}{' '}
                    MiB
                  </strong>
                </span>
                <span>
                  Started
                  <strong>
                    {detail.started_at ? utc(detail.started_at) : 'Queued'}
                  </strong>
                </span>
                <span>
                  Reason<strong>{detail.reason ?? '—'}</strong>
                </span>
              </div>
              {active && (
                <button
                  className="danger-button"
                  disabled={busy || detail.state === 'CANCELLING'}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      setDetail(
                        await post<Job>(
                          '/research/jobs/' + jobId + '/cancel',
                          {},
                        ),
                      );
                      setRetry((x) => x + 1);
                    } catch (e) {
                      setError(e as Error);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Cancel training
                </button>
              )}
              <h3>Checkpoints</h3>
              <p>
                {detail.checkpoints?.length
                  ? detail.checkpoints.join(' · ')
                  : 'No completed checkpoints yet.'}
              </p>
              <h3>Recent events</h3>
              <div className="event-log">
                {detail.events?.slice(-12).map((e, i) => (
                  <div key={i}>
                    <time>{String(e.time ?? '').slice(11, 19)}</time>
                    <span>{String(e.event ?? '')}</span>
                  </div>
                ))}
              </div>
              {detail.model_id && (
                <p>
                  Candidate model{' '}
                  <strong className="mono">{short(detail.model_id)}</strong> ·{' '}
                  <a href="#models">Open registry →</a>
                </p>
              )}
            </>
          )}
          {error && (
            <ErrorBox error={error} retry={() => setRetry((x) => x + 1)} />
          )}
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Training history</h2>
          <button onClick={onRefresh}>Refresh history</button>
        </div>
        {catalog.jobs.length === 0 ? (
          <Empty title="No training runs" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Steps</th>
                  <th>Model</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {catalog.jobs.map((j) => (
                  <tr key={j.job_id}>
                    <td className="mono">{short(j.job_id)}</td>
                    <td>{utc(j.created_at)}</td>
                    <td>
                      <Badge
                        tone={j.state === 'SUCCEEDED' ? 'good' : 'neutral'}
                      >
                        {j.state}
                      </Badge>
                    </td>
                    <td>{j.progress?.timesteps ?? '—'}</td>
                    <td className="mono">
                      {j.model_id ? short(j.model_id) : '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setDetail(undefined);
                          setJobId(j.job_id);
                          setRetry((x) => x + 1);
                        }}
                      >
                        Inspect run
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
