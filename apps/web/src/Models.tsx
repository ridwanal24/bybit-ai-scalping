import { useEffect, useState } from 'react';
import {
  post,
  percent,
  short,
  utc,
  type Catalog,
  type Model,
  type Proposal,
} from './api';
import { useResource, Badge, Empty, ErrorBox, Loading } from './components';
export function Models({ catalog }: { catalog: Catalog }) {
  const [selected, setSelected] = useState<string[]>(
    catalog.models.slice(0, 2).map((m) => m.id),
  );
  const [focus, setFocus] = useState(catalog.models[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const model = useResource<Model>(focus ? '/research/models/' + focus : null);
  const history = useResource<{ items: Proposal[] }>(
    '/research/deployment-proposals',
    revision,
  );
  const compared = catalog.models.filter((m) => selected.includes(m.id));
  const sameScope = compared.every(
    (m) =>
      m.metadata.dataset_fingerprint ===
        compared[0]?.metadata.dataset_fingerprint &&
      m.validation.start_ms === compared[0]?.validation.start_ms &&
      m.validation.end_ms === compared[0]?.validation.end_ms,
  );
  useEffect(() => {
    if (!focus && catalog.models.length) setFocus(catalog.models[0]!.id);
  }, [catalog.models, focus]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FROZEN WEIGHTS · MANUAL REVIEW</p>
          <h1>Model registry</h1>
          <p>
            Compare evidence. Record a research proposal. Keep activation
            explicit.
          </p>
        </div>
        <Badge>No active deployment</Badge>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Research candidates</h2>
          <span>{catalog.models.length} indexed archives</span>
        </div>
        {!catalog.models.length ? (
          <Empty title="No model candidates">
            Complete training to add a versioned model archive.
          </Empty>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Compare</th>
                    <th>Model</th>
                    <th>Network</th>
                    <th>Seed</th>
                    <th>Steps</th>
                    <th>Validation net</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {catalog.models.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={'Compare ' + short(m.id)}
                          checked={selected.includes(m.id)}
                          onChange={(e) =>
                            setSelected((s) =>
                              e.target.checked
                                ? [...s, m.id].slice(-4)
                                : s.filter((id) => id !== m.id),
                            )
                          }
                        />
                      </td>
                      <td className="mono">{short(m.id)}</td>
                      <td>{m.metadata.configuration.network.preset}</td>
                      <td>{m.metadata.seed}</td>
                      <td>{m.metadata.timesteps.toLocaleString()}</td>
                      <td
                        className={
                          Number(m.validation.report.net_equity_change) < 0
                            ? 'negative'
                            : 'positive'
                        }
                      >
                        {m.validation.report.net_equity_change}
                      </td>
                      <td>
                        <Badge>Candidate</Badge>
                      </td>
                      <td>
                        <button onClick={() => setFocus(m.id)}>
                          Review model
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Model comparison</h3>
            {compared.length < 2 ? (
              <p>
                Select at least two models to compare their archived validation
                evidence.
              </p>
            ) : (
              <>
                {!sameScope && (
                  <div className="notice warning">
                    These models have different datasets or validation ranges.
                    Their results are not a matched performance ranking.
                  </div>
                )}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Evidence</th>
                        {compared.map((m) => (
                          <th key={m.id}>{short(m.id)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          'Network',
                          'Parameters',
                          'Dataset',
                          'Validation range',
                          'Exit mode',
                          'Net return',
                          'Profit factor',
                          'Drawdown',
                        ] as const
                      ).map((label) => (
                        <tr key={label}>
                          <th>{label}</th>
                          {compared.map((m) => (
                            <td key={m.id}>
                              {label === 'Network'
                                ? m.metadata.configuration.network.preset
                                : label === 'Parameters'
                                  ? m.metadata.parameters.toLocaleString()
                                  : label === 'Dataset'
                                    ? short(m.metadata.dataset_fingerprint)
                                    : label === 'Validation range'
                                      ? utc(m.validation.start_ms) +
                                        ' → ' +
                                        utc(m.validation.end_ms)
                                      : label === 'Exit mode'
                                        ? m.metadata.configuration.exit.mode
                                        : label === 'Net return'
                                          ? percent(
                                              m.validation.metrics.net_return
                                                .value,
                                            )
                                          : label === 'Profit factor'
                                            ? (m.validation.metrics
                                                .profit_factor.value ??
                                              'Undefined')
                                            : percent(
                                                m.validation.metrics
                                                  .max_drawdown.value,
                                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted">
                  Indexed summaries; use Review model for full archive
                  verification. No automatic winner or promotion.
                </p>
              </>
            )}
          </>
        )}
      </section>
      <div className="two-column">
        <section className="panel">
          <h2>Model review</h2>
          {model.loading && <Loading label="Verifying frozen model archive…" />}
          {model.error && <ErrorBox error={model.error} />}{' '}
          {!focus && <Empty title="Choose a model" />}
          {model.data && (
            <>
              <p className="mono">{model.data.id}</p>
              <Badge tone="good">Archive verified</Badge>
              <div className="stat-pairs">
                <span>
                  Configuration
                  <strong className="mono">
                    {short(model.data.metadata.configuration_hash)}
                  </strong>
                </span>
                <span>
                  Normalizer
                  <strong className="mono">
                    {short(model.data.metadata.normalizer_id)}
                  </strong>
                </span>
                <span>
                  Parameters
                  <strong>
                    {model.data.metadata.parameters.toLocaleString()}
                  </strong>
                </span>
                <span>
                  Current code
                  <strong>
                    {model.data.compatibility?.current_code
                      ? 'Matches'
                      : 'Review required'}
                  </strong>
                </span>
              </div>
              <h3>Deployment gates</h3>
              <ul>
                {model.data.compatibility?.blockers.map((x) => (
                  <li key={x}>{x.replaceAll('_', ' ')}</li>
                ))}
              </ul>
              <div className="notice warning">
                Candidate status does not authorize execution. Paper, Demo and
                Real activation require later operational readiness and mode
                approval.
              </div>
            </>
          )}
        </section>
        <section className="panel">
          <h2>Research deployment proposal</h2>
          <p>
            A proposal records your intended model and frozen configuration. It
            does not activate trading or promote the candidate.
          </p>
          <label>
            Target mode
            <select defaultValue="backtest">
              <option value="backtest">Backtest research proposal</option>
              <option disabled>Paper — operational readiness pending</option>
              <option disabled>Demo — exchange readiness pending</option>
              <option disabled>Real — unavailable</option>
            </select>
          </label>
          <label>
            Review note
            <textarea
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the evidence and what still needs review."
            />
          </label>
          <label className="check assumption">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            I understand this is a research proposal and does not activate
            execution.
          </label>
          <div className="action-bar">
            <button
              className="primary"
              disabled={!model.data || busy || !ack || note.trim().length < 8}
              onClick={async () => {
                setBusy(true);
                setError(undefined);
                setMessage('');
                try {
                  await post('/research/deployment-proposals', {
                    model_id: focus,
                    target: 'backtest',
                    note,
                    acknowledge_research_only: ack,
                  });
                  setMessage(
                    'Research proposal recorded. No execution activated.',
                  );
                  setRevision((x) => x + 1);
                } catch (e) {
                  setError(e as Error);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Recording…' : 'Record proposal'}
            </button>
            <button
              disabled
              title="Execution is outside the research dashboard"
            >
              Activate execution
            </button>
          </div>
          <p role="status">{message}</p>
          {error && <ErrorBox error={error} />}
        </section>
      </div>
      <section className="panel">
        <h2>Deployment proposal history</h2>
        {history.loading && <Loading />}
        {history.error && (
          <ErrorBox
            error={history.error}
            retry={() => setRevision((x) => x + 1)}
          />
        )}{' '}
        {history.data?.items.length === 0 && (
          <Empty title="No deployment proposals" />
        )}
        {history.data?.items.map((p) => (
          <article className="proposal" key={p.id}>
            <div>
              <Badge>{p.status}</Badge>
              <span>{utc(p.created_at)}</span>
            </div>
            <p>
              <strong className="mono">{short(p.model_id)}</strong> · {p.target}
            </p>
            <p>{p.note}</p>
            <small>
              Execution disabled ·{' '}
              {p.blockers.map((x) => x.replaceAll('_', ' ')).join(' · ')}
            </small>
          </article>
        ))}
      </section>
    </>
  );
}
