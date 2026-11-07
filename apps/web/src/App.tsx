import { useCallback, useEffect, useState } from 'react';
import {
  short,
  utc,
  amount,
  type Catalog,
  type Candle,
  type Dataset,
} from './api';
import {
  useResource,
  Badge,
  CandleChart,
  Empty,
  ErrorBox,
  Loading,
} from './components';
import { Configuration, type Snapshot } from './Configuration';
import { Training } from './Training';
import { Experiments } from './Experiments';
import { Models } from './Models';
const routes = [
  ['overview', 'Overview', '◈'],
  ['configuration', 'Configuration', '⚙'],
  ['market', 'Market data', '▥'],
  ['training', 'Training', '↗'],
  ['experiments', 'Experiments', '⌁'],
  ['models', 'Model registry', '▣'],
] as const;
function Market({ datasets }: { datasets: Dataset[] }) {
  const [id, setId] = useState(datasets[0]?.id ?? '');
  const [stream, setStream] = useState(
    datasets[0]?.manifest.streams[0]?.id ?? 'last:1m',
  );
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [dataDataset] = datasets.filter((x) => x.id === id);
  const resource = useResource<
    Dataset & { candles: Candle[]; has_more: boolean }
  >(
    id
      ? `/research/datasets/${id}?stream=${encodeURIComponent(stream)}&offset=${offset}&limit=120`
      : null,
    revision,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SEALED HISTORICAL EXPORTS</p>
          <h1>Market data</h1>
          <p>Closed bars and quality evidence. No live market feed.</p>
        </div>
        <Badge>{datasets.length} datasets</Badge>
      </div>
      <section className="panel">
        <div className="filter-row">
          <label>
            Historical dataset
            <select
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setOffset(0);
                setStream(
                  datasets.find((d) => d.id === e.target.value)?.manifest
                    .streams[0]?.id ?? 'last:1m',
                );
              }}
            >
              {datasets.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.manifest.symbol} · {short(d.id)} · {d.manifest.source}
                </option>
              ))}
            </select>
          </label>
          <label>
            Stream
            <select
              value={stream}
              onChange={(e) => {
                setStream(e.target.value);
                setOffset(0);
              }}
            >
              {dataDataset?.manifest.streams.map((s) => (
                <option key={s.id}>{s.id}</option>
              ))}
            </select>
          </label>
        </div>
        {!id ? (
          <Empty title="No verified dataset exports">
            Download and seal historical data through the market-data API before
            training.
          </Empty>
        ) : resource.loading ? (
          <Loading label="Verifying historical export…" />
        ) : resource.error ? (
          <ErrorBox
            error={resource.error}
            retry={() => setRevision((x) => x + 1)}
          />
        ) : (
          resource.data && (
            <>
              <div className="market-strip">
                <strong>{resource.data.manifest.symbol}</strong>
                <span>{stream}</span>
                <Badge tone="good">Verified closed bars</Badge>
                <span>
                  {utc(resource.data.manifest.requested_start_ms)} →{' '}
                  {utc(resource.data.manifest.requested_end_ms)}
                </span>
              </div>
              <CandleChart candles={resource.data.candles} />
              <div className="pager">
                <button
                  disabled={offset === 0}
                  onClick={() => setOffset((x) => Math.max(0, x - 120))}
                >
                  Previous candles
                </button>
                <span>
                  Bars {offset + 1}–{offset + resource.data.candles.length}
                </span>
                <button
                  disabled={!resource.data.has_more}
                  onClick={() => setOffset((x) => x + 120)}
                >
                  Next candles
                </button>
              </div>
              <div className="two-column">
                <div>
                  <h3>Data quality</h3>
                  <div className="stat-pairs">
                    {Object.entries(resource.data.quality.counters)
                      .slice(0, 8)
                      .map(([key, value]) => (
                        <span key={key}>
                          {key.replaceAll('_', ' ')}
                          <strong>{value}</strong>
                        </span>
                      ))}
                  </div>
                </div>
                <div>
                  <h3>Provenance & assumptions</h3>
                  <p className="mono">{resource.data.fingerprint}</p>
                  <p>
                    {resource.data.quality.metadata.historical_validity.replaceAll(
                      '_',
                      ' ',
                    )}
                  </p>
                  <p>
                    {resource.data.quality.funding.coverage.replaceAll(
                      '_',
                      ' ',
                    )}
                  </p>
                  <p className="muted">
                    Source: {resource.data.manifest.source}. Data availability
                    does not establish execution readiness.
                  </p>
                </div>
              </div>
              <details className="advanced">
                <summary>Closed candle values</summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Open UTC</th>
                        <th>Open</th>
                        <th>High</th>
                        <th>Low</th>
                        <th>Close</th>
                        <th>Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resource.data.candles.map((c) => (
                        <tr key={c.open_time_ms}>
                          <td>{utc(c.open_time_ms)}</td>
                          <td>{c.open}</td>
                          <td>{c.high}</td>
                          <td>{c.low}</td>
                          <td>{c.close}</td>
                          <td>{c.volume}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )
        )}
      </section>
    </>
  );
}
function Overview({ catalog }: { catalog: Catalog }) {
  const latest = catalog.evaluations[0];
  const running = catalog.jobs.filter((j) =>
    ['QUEUED', 'RUNNING', 'CANCELLING'].includes(j.state),
  );
  const dataset = catalog.datasets[0];
  const preview = useResource<Dataset & { candles: Candle[] }>(
    dataset
      ? `/research/datasets/${dataset.id}?stream=${encodeURIComponent(dataset.manifest.streams[0]?.id ?? 'last:1m')}&limit=80`
      : null,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR LOCAL RESEARCH WORKSPACE</p>
          <h1>Research overview</h1>
          <p>From a frozen configuration to reproducible evidence.</p>
        </div>
        <a className="button primary" href="#configuration">
          Configure research <span>↗</span>
        </a>
      </div>
      <div className="summary-grid">
        <div className="summary-card">
          <span>Verified datasets</span>
          <strong>{catalog.totals.datasets ?? 0}</strong>
          <small>
            {dataset?.manifest.symbol ?? 'No data yet'} · historical exports
          </small>
        </div>
        <div className="summary-card">
          <span>Active training</span>
          <strong>
            {running.length}
            <em> / 1 worker</em>
          </strong>
          <small>
            {running.length
              ? 'Persistent CPU job in progress'
              : 'Ready for the next bounded run'}
          </small>
        </div>
        <div className="summary-card">
          <span>Model candidates</span>
          <strong>{catalog.totals.models ?? 0}</strong>
          <small>Frozen weights · manual review</small>
        </div>
        <div className="summary-card">
          <span>Evaluation reports</span>
          <strong>{catalog.totals.evaluations ?? 0}</strong>
          <small>Walk-forward · multi-seed · stresses</small>
        </div>
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">HISTORICAL MARKET</p>
              <h2>{dataset?.manifest.symbol ?? 'Market preview'}</h2>
            </div>
            <a href="#market">Explore data →</a>
          </div>
          {preview.loading ? (
            <Loading label="Verifying closed candles…" />
          ) : preview.error ? (
            <ErrorBox error={preview.error} />
          ) : preview.data ? (
            <>
              <CandleChart candles={preview.data.candles} />
              <div className="market-foot">
                <span>{dataset?.manifest.source}</span>
                <span>Closed historical bars · not a live price</span>
              </div>
            </>
          ) : (
            <Empty title="Import a historical dataset to begin" />
          )}
        </section>
        <section className="panel evidence-panel">
          <p className="eyebrow">LATEST RESEARCH SCREEN</p>
          <h2>Evidence, before execution.</h2>
          {latest ? (
            <>
              <Badge
                tone={
                  latest.screen.status === 'research_screen_pass'
                    ? 'good'
                    : 'warn'
                }
              >
                {latest.screen.status.replaceAll('_', ' ')}
              </Badge>
              <p>
                {latest.screen.reasons
                  .slice(0, 3)
                  .map((x) => x.replaceAll('_', ' '))
                  .join(' · ')}
              </p>
              <div className="stat-pairs">
                <span>
                  OOS coverage
                  <strong>
                    {amount(latest.screen.unique_oos_ms / 86400000, 3)} days
                  </strong>
                </span>
                <span>
                  Seeds<strong>{latest.screen.per_seed.length}</strong>
                </span>
                <span>
                  Report rows<strong>{latest.rows}</strong>
                </span>
                <span>
                  Execution<strong>Disabled</strong>
                </span>
              </div>
              <a className="button" href="#experiments">
                Inspect evaluation →
              </a>
            </>
          ) : (
            <>
              <p>
                Complete training and a preregistered evaluation to review
                baseline, sensitivity and out-of-sample evidence.
              </p>
              <a className="button" href="#training">
                Open training →
              </a>
            </>
          )}
          <div className="research-note">
            <span>◎</span>
            <div>
              <strong>Research mode</strong>
              <p>
                No trading account connected. Balance, positions and live
                execution are unavailable.
              </p>
            </div>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Recent activity</h2>
          <a href="#training">All training runs →</a>
        </div>
        {!catalog.jobs.length ? (
          <Empty title="Your experiment history starts here">
            Configure a strategy, freeze a snapshot, then start a bounded CPU
            training run.
          </Empty>
        ) : (
          <div className="activity-list">
            {catalog.jobs.slice(0, 5).map((j) => (
              <div key={j.job_id}>
                <span className="activity-icon">↗</span>
                <div>
                  <strong>
                    Training run <span className="mono">{short(j.job_id)}</span>
                  </strong>
                  <p>{utc(j.created_at)}</p>
                </div>
                <Badge tone={j.state === 'SUCCEEDED' ? 'good' : 'neutral'}>
                  {j.state}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
export default function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || 'overview');
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  const resource = useResource<Catalog>(
    '/research/catalog?limit=100',
    revision,
    true,
  );
  const health = useResource<{ status: string }>('/health/ready');
  useEffect(() => {
    const onHash = () => {
      setRoute(location.hash.slice(1) || 'overview');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    document.title =
      (routes.find(([id]) => id === route)?.[1] ?? 'Not found') + ' · Stratum';
  }, [route]);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a href="#overview" className="brand">
          <span className="brand-mark">S</span>
          <span>
            stratum<small>RESEARCH TERMINAL</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-dot" />
          <div>
            <strong>Local workspace</strong>
            <small>Bybit · linear USDT</small>
          </div>
          <Badge>01</Badge>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {routes.map(([id, label, icon]) => (
            <a
              href={'#' + id}
              key={id}
              className={route === id ? 'active' : ''}
              aria-current={route === id ? 'page' : undefined}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
              {route === id && <i />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mode-indicator">
            <span />
            Backtest research
          </div>
          <p>
            Frozen inputs. Traceable results.
            <br />
            No exchange execution.
          </p>
          <div className="local-profile">
            <span>L</span>
            <div>
              <strong>Local researcher</strong>
              <small>CPU environment</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>
              {routes.find(([id]) => id === route)?.[1] ?? 'Not found'}
            </strong>
          </div>
          <div className="topbar-status">
            <span
              className={
                health.data?.status === 'ok'
                  ? 'health-dot'
                  : 'health-dot offline'
              }
            />
            {health.data?.status === 'ok'
              ? 'Backend ready'
              : health.error
                ? 'Backend unavailable'
                : 'Connecting'}
            <span className="topbar-divider" />
            <span>LOCAL ONLY</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {resource.error ? (
            <>
              <div className="page-heading">
                <h1>Research workspace</h1>
              </div>
              <ErrorBox error={resource.error} retry={refresh} />
            </>
          ) : !resource.data ? (
            <Loading label="Reading the local research catalog…" />
          ) : (
            <>
              {resource.data.errors.length > 0 && (
                <div className="notice warning" role="status">
                  {resource.data.errors.length} artifact summaries are
                  unavailable. They have been excluded from this catalog;
                  inspect local artifacts before using them.
                </div>
              )}
              {route === 'overview' ? (
                <Overview catalog={resource.data} />
              ) : route === 'configuration' ? (
                <Configuration
                  onSnapshot={setSnapshot}
                  datasets={resource.data.datasets}
                />
              ) : route === 'market' ? (
                <Market datasets={resource.data.datasets} />
              ) : route === 'training' ? (
                <Training
                  catalog={resource.data}
                  snapshot={snapshot}
                  onRefresh={refresh}
                />
              ) : route === 'experiments' ? (
                <Experiments catalog={resource.data} />
              ) : route === 'models' ? (
                <Models catalog={resource.data} />
              ) : (
                <Empty title="Page not found">
                  <a href="#overview">Return to Overview</a>
                </Empty>
              )}
            </>
          )}
        </main>
        <footer>
          <span>STRATUM / RESEARCH WORKSPACE</span>
          <span>Research results do not authorize trading.</span>
        </footer>
      </div>
    </div>
  );
}
