import { useEffect, useState } from 'react';
import {
  api,
  amount,
  percent,
  short,
  utc,
  type Catalog,
  type Equity,
  type Evaluation,
  type Trade,
  type Metrics,
  type Model,
} from './api';
import {
  useResource,
  Badge,
  Empty,
  EquityChart,
  ErrorBox,
  Loading,
  MetricGrid,
} from './components';

type Paged<T> = { items: T[]; has_more: boolean; offset: number };
export function Simulation({ id, modelId }: { id: string; modelId?: string }) {
  const [points, setPoints] = useState<Equity[]>([]);
  const [more, setMore] = useState(false);
  const [pointOffset, setPointOffset] = useState(0);
  const [tradeOffset, setTradeOffset] = useState(0);
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const suffix = modelId ? '&model_id=' + modelId : '';
  useEffect(() => {
    setPoints([]);
    setPointOffset(0);
    setTradeOffset(0);
    setError(undefined);
  }, [id, modelId]);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    api<Paged<Equity>>(
      `/research/simulations/${id}?kind=equity&limit=1000&offset=${pointOffset}${suffix}`,
      { signal: ctrl.signal },
    )
      .then((p) => {
        if (!ctrl.signal.aborted) {
          setPoints((previous) =>
            pointOffset === 0 ? p.items : [...previous, ...p.items],
          );
          setMore(p.has_more);
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [id, suffix, pointOffset, revision]);
  const trades = useResource<Paged<Trade>>(
    `/research/simulations/${id}?kind=trades&limit=50&offset=${tradeOffset}${suffix}`,
    revision,
  );
  return (
    <>
      {error && (
        <ErrorBox error={error} retry={() => setRevision((x) => x + 1)} />
      )}
      <div className="two-column charts">
        <section>
          <h3>Equity curve</h3>
          {loading && points.length === 0 ? (
            <Loading label="Verifying ledger curves…" />
          ) : (
            <EquityChart points={points} />
          )}
        </section>
        <section>
          <h3>Drawdown</h3>
          <EquityChart points={points} kind="drawdown" />
        </section>
      </div>
      {more && (
        <div className="action-bar">
          <span>
            Showing {points.length.toLocaleString()} points from the beginning
            of this episode.
          </span>
          <button
            disabled={loading}
            onClick={() => setPointOffset(points.length)}
          >
            Load next curve points
          </button>
        </div>
      )}
      <div className="section-heading">
        <h3>Trade history</h3>
        <span>Closed positions · exact ledger values</span>
      </div>
      {trades.error && (
        <ErrorBox
          error={trades.error}
          retry={() => setRevision((x) => x + 1)}
        />
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Side</th>
              <th>Entry UTC</th>
              <th>Exit UTC</th>
              <th>Quantity</th>
              <th>Entry</th>
              <th>Exit</th>
              <th>Net PnL</th>
              <th>Exit reason</th>
            </tr>
          </thead>
          <tbody>
            {trades.data?.items.map((t, i) => (
              <tr key={i}>
                <td>
                  <Badge>{t.side}</Badge>
                </td>
                <td>{utc(t.opened_ms)}</td>
                <td>{utc(t.closed_ms)}</td>
                <td>{t.quantity}</td>
                <td>{t.entry}</td>
                <td>{t.exit}</td>
                <td className={Number(t.net_pnl) < 0 ? 'negative' : 'positive'}>
                  {t.net_pnl}
                </td>
                <td>{t.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {trades.data?.items.length === 0 && (
          <Empty title="No closed trades in this episode" />
        )}
      </div>
      <div className="pager">
        <button
          disabled={tradeOffset === 0}
          onClick={() => setTradeOffset((x) => Math.max(0, x - 50))}
        >
          Previous trades
        </button>
        <span>Offset {tradeOffset}</span>
        <button
          disabled={!trades.data?.has_more}
          onClick={() => setTradeOffset((x) => x + 50)}
        >
          Next trades
        </button>
      </div>
    </>
  );
}
type Comparison = {
  results: {
    strategy: { name: string };
    metrics: Metrics;
    total_trades: number;
    simulation_id: string;
  }[];
};
function AdvancedReport({ id }: { id: string }) {
  const [retry, setRetry] = useState(0);
  const resource = useResource<Evaluation>(
    '/research/evaluations/' + id,
    retry,
  );
  const [rowIndex, setRowIndex] = useState(0);
  const [baselineId, setBaselineId] = useState<string>();
  useEffect(() => setBaselineId(undefined), [id, rowIndex]);
  const row = resource.data?.rows[rowIndex];
  const paired = resource.data?.baselines.find(
    (b) => b.fold === row?.fold && b.seed === row?.seed,
  );
  const baseline = useResource<Comparison>(
    paired ? '/research/baselines/' + paired.comparison_id : null,
  );
  useEffect(() => setRowIndex(0), [id]);
  if (resource.error)
    return (
      <ErrorBox error={resource.error} retry={() => setRetry((x) => x + 1)} />
    );
  if (!resource.data)
    return <Loading label="Verifying report, models and linked ledgers…" />;
  const r = resource.data;
  return (
    <>
      <div className="notice warning">
        <strong>{r.screen.status.replaceAll('_', ' ')}</strong>
        <p>
          {r.screen.reasons.map((x) => x.replaceAll('_', ' ')).join(' · ') ||
            'Research screen passed. Operational approval is still required.'}
        </p>
        <small>
          Unique OOS: {amount(r.screen.unique_oos_ms / 86400000, 3)} days ·
          required {r.screen.gates.min_oos_ms / 86400000} days · execution
          disabled
        </small>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Seed</th>
              <th>Folds</th>
              <th>Trades</th>
              <th>Mean return</th>
              <th>Profit factor</th>
              <th>Worst DD</th>
            </tr>
          </thead>
          <tbody>
            {r.screen.per_seed.map((s) => (
              <tr key={s.seed}>
                <td>{s.seed}</td>
                <td>{s.folds}</td>
                <td>{s.trades}</td>
                <td>{percent(s.mean_return)}</td>
                <td>{s.profit_factor ?? 'Undefined'}</td>
                <td>{percent(s.worst_drawdown)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="row-picker">
        Experiment episode
        <select
          value={rowIndex}
          onChange={(e) => setRowIndex(Number(e.target.value))}
        >
          {r.rows.map((x, i) => (
            <option key={i} value={i}>
              {x.group} · {x.name} · fold {x.fold + 1} · seed {x.seed}
            </option>
          ))}
        </select>
      </label>
      {row && (
        <>
          <MetricGrid metrics={row.metrics} />
          <p className="muted">
            {row.group === 'exploratory'
              ? 'Exploratory: one seed/fold; not promotion evidence.'
              : row.group === 'counterfactual'
                ? 'Counterfactual: weights frozen; masks/actions/sizing recomputed. Deployment incompatible.'
                : 'Primary OOS: independent account per fold. No compounded portfolio claim.'}
          </p>
          <Simulation key={row.simulation_id} id={row.simulation_id} />
        </>
      )}
      <h3>Matched baselines</h3>
      {baseline.loading && <Loading label="Verifying matched comparisons…" />}
      {baseline.error && <ErrorBox error={baseline.error} />}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Trades</th>
              <th>Net PnL</th>
              <th>Return</th>
              <th>Drawdown</th>
              <th>Profit factor</th>
              <th>Ledger</th>
            </tr>
          </thead>
          <tbody>
            {baseline.data?.results.map((b) => (
              <tr key={b.strategy.name}>
                <td>{b.strategy.name}</td>
                <td>{b.total_trades}</td>
                <td>{b.metrics.net_profit.value ?? 'Undefined'}</td>
                <td>{percent(b.metrics.net_return.value)}</td>
                <td>{percent(b.metrics.max_drawdown.value)}</td>
                <td>{b.metrics.profit_factor.value ?? 'Undefined'}</td>
                <td>
                  <button onClick={() => setBaselineId(b.simulation_id)}>
                    Inspect {b.strategy.name}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {baselineId && (
        <section aria-label="Baseline episode details">
          <h3>Baseline ledger</h3>
          <Simulation key={baselineId} id={baselineId} />
        </section>
      )}
      {r.failures.length > 0 && (
        <div className="notice danger" role="alert">
          {r.failures.length} failed experiment cells. This report cannot pass
          the research screen.
        </div>
      )}
      <details className="advanced">
        <summary>Research gates and provenance</summary>
        <pre>
          {JSON.stringify(
            {
              gates: r.screen.gates,
              protocol: r.protocol_id,
              semantic_sha256: r.semantic_sha256,
              failures: r.failures,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </>
  );
}
export function ModelValidation({ model }: { model: Model }) {
  return (
    <>
      <MetricGrid metrics={model.validation.metrics} />
      <p className="muted">
        Chronological validation · {utc(model.validation.start_ms)} →{' '}
        {utc(model.validation.end_ms)} · not final holdout.
      </p>
      <Simulation id={model.validation.simulation_id} modelId={model.id} />
    </>
  );
}
export function Experiments({ catalog }: { catalog: Catalog }) {
  const [tab, setTab] = useState<'advanced' | 'validation'>(
    catalog.evaluations.length ? 'advanced' : 'validation',
  );
  const [id, setId] = useState(catalog.evaluations[0]?.id ?? '');
  const [modelId, setModelId] = useState(catalog.models[0]?.id ?? '');
  const model = useResource<Model>(
    tab === 'validation' && modelId ? '/research/models/' + modelId : null,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">EVIDENCE BEFORE PROMOTION</p>
          <h1>Experiments</h1>
          <p>Out-of-sample results, costs, baselines and every failed gate.</p>
        </div>
        <Badge>{catalog.evaluations.length} reports</Badge>
      </div>
      <section className="panel">
        <div className="tabs" role="tablist" aria-label="Evaluation views">
          <button
            role="tab"
            aria-selected={tab === 'advanced'}
            onClick={() => setTab('advanced')}
          >
            Advanced reports
          </button>
          <button
            role="tab"
            aria-selected={tab === 'validation'}
            onClick={() => setTab('validation')}
          >
            Training validation
          </button>
        </div>
        {tab === 'advanced' ? (
          catalog.evaluations.length ? (
            <>
              <label>
                Evaluation report
                <select value={id} onChange={(e) => setId(e.target.value)}>
                  {catalog.evaluations.map((r) => (
                    <option value={r.id} key={r.id}>
                      {short(r.id)} · {r.rows} rows · {r.screen.status}
                    </option>
                  ))}
                </select>
              </label>
              {id && <AdvancedReport key={id} id={id} />}
            </>
          ) : (
            <Empty title="No advanced evaluation reports">
              Run a preregistered M9 evaluation to add multi-seed, walk-forward
              and sensitivity evidence. Training validation remains available in
              the next tab.
            </Empty>
          )
        ) : catalog.models.length ? (
          <>
            <label>
              Validation model
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              >
                {catalog.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {short(m.id)} · {m.metadata.configuration.network.preset} ·
                    seed {m.metadata.seed}
                  </option>
                ))}
              </select>
            </label>
            {model.loading && <Loading label="Verifying model archive…" />}
            {model.error && <ErrorBox error={model.error} />}{' '}
            {model.data && <ModelValidation key={modelId} model={model.data} />}
          </>
        ) : (
          <Empty title="No trained models yet">
            Complete a training run to inspect actual validation metrics and
            trades.
          </Empty>
        )}
      </section>
    </>
  );
}
