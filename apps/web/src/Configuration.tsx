import { useEffect, useState } from 'react';
import {
  FEATURE_IDS,
  INTERVAL_MS,
  NETWORK_PRESETS,
  TIMEFRAMES,
  canonicalJson,
  validateConfiguration,
  type ResearchConfiguration,
} from '@bybit/contracts/browser';
import { api, post, ApiError, short, type Dataset } from './api';
import { ErrorBox, Loading, Badge } from './components';
export type Snapshot = {
  id: string;
  configHash: string;
  payload: ResearchConfiguration;
};
type Draft = {
  id: string;
  name: string;
  revision: number;
  payload: ResearchConfiguration;
};
const panels = [
  'Market',
  'Features',
  'Risk',
  'Exits & execution',
  'Network',
  'Training',
] as const;
export function Configuration({
  onSnapshot,
  datasets,
}: {
  onSnapshot: (value: Snapshot | null) => void;
  datasets: Dataset[];
}) {
  const [c, setC] = useState<ResearchConfiguration>();
  const [tab, setTab] = useState<(typeof panels)[number]>('Market');
  const [name, setName] = useState('Research configuration');
  const [draft, setDraft] = useState<Draft>();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<Error>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbolsError, setSymbolsError] = useState(false);
  const [symbolsLoading, setSymbolsLoading] = useState(true);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [symbolsAttempt, setSymbolsAttempt] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setSymbolsLoading(true);
    setSymbolsError(false);
    api<{ items: string[] }>('/market-data/symbols', { signal: ctrl.signal })
      .then((result) => {
        if (!ctrl.signal.aborted) setSymbols(result.items);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setSymbolsError(true);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setSymbolsLoading(false);
      });
    return () => ctrl.abort();
  }, [symbolsAttempt]);
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      api<{ items: { configuration: ResearchConfiguration }[] }>(
        '/configuration-presets',
        { signal: ctrl.signal },
      ),
      api<{ items: Draft[] }>('/configurations', { signal: ctrl.signal }),
    ])
      .then(([p, d]) => {
        setC(structuredClone(p.items[0]!.configuration));
        setDrafts(d.items);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(e);
      });
    return () => ctrl.abort();
  }, []);
  function edit(fn: (value: ResearchConfiguration) => void) {
    if (!c) return;
    const next = structuredClone(c);
    fn(next);
    setC(next);
    setMessage('Unsaved changes');
    onSnapshot(null);
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Request failed'));
    } finally {
      setBusy(false);
    }
  }
  if (!c)
    return error ? (
      <ErrorBox error={error} />
    ) : (
      <Loading label="Loading configuration presets…" />
    );
  const config = c;
  function field(
    section: 'risk' | 'stop_loss' | 'training' | 'execution' | 'market',
    key: string,
    label: string,
    kind: 'number' | 'text' = 'text',
  ) {
    const value = (config[section] as Record<string, unknown>)[key];
    return (
      <label key={key}>
        {label}
        <input
          type={kind}
          value={String(value ?? '')}
          onChange={(e) =>
            edit((v) => {
              (v[section] as Record<string, unknown>)[key] =
                kind === 'number' ? Number(e.target.value) : e.target.value;
            })
          }
        />
      </label>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">RESEARCH SETUP</p>
          <h1>Configuration</h1>
          <p>Define the experiment. Freeze a snapshot before training.</p>
        </div>
        <Badge>Schema v1</Badge>
      </div>
      <div className="config-layout">
        <section className="panel">
          <div className="section-heading">
            <h2>Strategy parameters</h2>
            <span>Backtest research</span>
          </div>
          <div
            className="tabs"
            role="tablist"
            aria-label="Configuration sections"
          >
            {panels.map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={p === tab}
                onClick={() => setTab(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="form-grid">
            {tab === 'Market' && (
              <>
                <label>
                  Search symbols
                  <input
                    type="search"
                    value={symbolSearch}
                    onChange={(e) => setSymbolSearch(e.target.value)}
                    placeholder="Search Bybit symbols"
                  />
                </label>
                <label>
                  Symbol
                  <select
                    aria-label="Symbol"
                    value={config.market.symbol}
                    disabled={symbolsLoading || symbolsError}
                    onChange={(e) =>
                      edit((v) => {
                        v.market.symbol = e.target.value;
                      })
                    }
                  >
                    <option value={config.market.symbol}>
                      {config.market.symbol}
                      {!symbols.includes(config.market.symbol) &&
                      !symbolsLoading &&
                      !symbolsError
                        ? ' (not currently listed)'
                        : ''}
                    </option>
                    {symbols
                      .filter(
                        (symbol) =>
                          symbol !== config.market.symbol &&
                          symbol.includes(symbolSearch.trim().toUpperCase()),
                      )
                      .map((symbol) => (
                        <option key={symbol}>{symbol}</option>
                      ))}
                  </select>
                  <small>
                    {symbolsLoading
                      ? 'Loading Bybit symbols…'
                      : 'Active Bybit USDT perpetual contracts.'}
                  </small>
                </label>
                {symbolsError && (
                  <div className="notice full-width" role="alert">
                    Could not load symbols from Bybit. Your current symbol is
                    preserved.
                    <button onClick={() => setSymbolsAttempt((n) => n + 1)}>
                      Retry symbols
                    </button>
                  </div>
                )}
                <label>
                  Timeframe
                  <select
                    aria-label="Timeframe"
                    value={config.market.timeframe}
                    onChange={(e) =>
                      edit((v) => {
                        v.market.timeframe = e.target
                          .value as typeof v.market.timeframe;
                        v.market.secondary_timeframes =
                          v.market.secondary_timeframes.filter(
                            (tf) =>
                              INTERVAL_MS[tf] > INTERVAL_MS[v.market.timeframe],
                          );
                        v.features.enabled = v.features.enabled.filter(
                          (f) =>
                            f.timeframe === v.market.timeframe ||
                            v.market.secondary_timeframes.includes(f.timeframe),
                        );
                      })
                    }
                  >
                    {TIMEFRAMES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <fieldset className="full-width">
                  <legend>Secondary timeframes</legend>
                  <div className="checkbox-grid">
                    {TIMEFRAMES.filter(
                      (tf) =>
                        INTERVAL_MS[tf] > INTERVAL_MS[config.market.timeframe],
                    ).map((tf) => (
                      <label className="check" key={tf}>
                        <input
                          type="checkbox"
                          checked={config.market.secondary_timeframes.includes(
                            tf,
                          )}
                          onChange={(e) =>
                            edit((v) => {
                              v.market.secondary_timeframes = TIMEFRAMES.filter(
                                (item) =>
                                  item === tf
                                    ? e.target.checked
                                    : v.market.secondary_timeframes.includes(
                                        item,
                                      ),
                              );
                              v.features.enabled = v.features.enabled.filter(
                                (f) =>
                                  f.timeframe === v.market.timeframe ||
                                  v.market.secondary_timeframes.includes(
                                    f.timeframe,
                                  ),
                              );
                            })
                          }
                        />
                        {tf}
                      </label>
                    ))}
                  </div>
                  <small>
                    Select higher timeframes; streams must exist in the dataset.
                  </small>
                </fieldset>
                {(['historical_start_ms', 'historical_end_ms'] as const).map(
                  (key) => (
                    <label key={key}>
                      {key === 'historical_start_ms'
                        ? 'Historical start (UTC)'
                        : 'Historical end (UTC)'}
                      <input
                        type="datetime-local"
                        step={60}
                        required
                        value={new Date(config.market[key])
                          .toISOString()
                          .slice(0, 16)}
                        onChange={(e) => {
                          const timestamp = Date.parse(e.target.value + 'Z');
                          if (Number.isFinite(timestamp))
                            edit((v) => {
                              v.market[key] = timestamp;
                            });
                        }}
                      />
                      <small>
                        UTC time. Must align with the main timeframe.
                      </small>
                    </label>
                  ),
                )}
                <div className="notice">
                  Mode: backtest · linear USDT perpetual. Execution remains
                  disabled.
                </div>
              </>
            )}
            {tab === 'Features' && (
              <>
                <label>
                  Observation window
                  <input
                    type="number"
                    value={config.features.observation_window}
                    onChange={(e) =>
                      edit((v) => {
                        v.features.observation_window =
                          v.training.observation_window = Number(
                            e.target.value,
                          );
                      })
                    }
                  />
                </label>
                <div className="full-width">
                  <h3>Market inputs</h3>
                  <p className="muted">
                    Only closed bars are used. Every enabled input enters the
                    observation.
                  </p>
                  {[
                    config.market.timeframe,
                    ...config.market.secondary_timeframes,
                  ].map((tf) => (
                    <fieldset key={tf}>
                      <legend>{tf} features</legend>
                      <div className="checkbox-grid">
                        {FEATURE_IDS.map((id) => (
                          <label className="check" key={id}>
                            <input
                              type="checkbox"
                              checked={config.features.enabled.some(
                                (f) => f.id === id && f.timeframe === tf,
                              )}
                              onChange={(e) =>
                                edit((v) => {
                                  v.features.enabled =
                                    v.features.enabled.filter(
                                      (f) => f.id !== id || f.timeframe !== tf,
                                    );
                                  if (e.target.checked)
                                    v.features.enabled.push({
                                      id,
                                      timeframe: tf,
                                    });
                                })
                              }
                            />
                            {id.replaceAll('_', ' ')}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                  <h3>Indicator periods</h3>
                  <div className="form-grid">
                    {Object.entries(config.features.periods).map(
                      ([key, value]) => (
                        <label key={key}>
                          {key.replaceAll('_', ' ')}
                          <input
                            type="number"
                            value={value}
                            onChange={(e) =>
                              edit((v) => {
                                (v.features.periods as Record<string, number>)[
                                  key
                                ] = Number(e.target.value);
                              })
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                </div>
              </>
            )}
            {tab === 'Risk' && (
              <>
                {(
                  [
                    'initial_capital',
                    'risk_per_trade',
                    'daily_loss_limit',
                    'max_drawdown',
                    'max_margin_fraction',
                    'max_position_notional',
                    'min_available_margin',
                  ] as const
                ).map((key) => field('risk', key, key.replaceAll('_', ' ')))}
                {(
                  [
                    'max_leverage',
                    'max_holding_bars',
                    'cooldown_bars',
                    'max_concurrent_positions',
                  ] as const
                ).map((key) =>
                  field('risk', key, key.replaceAll('_', ' '), 'number'),
                )}
                <div className="notice full-width">
                  Fractions use decimals: 0.005 = 0.5%. Restricted simulator: 1×
                  leverage and at most 50% entry exposure. Risk gates remain
                  independent of the model.
                </div>
              </>
            )}
            {tab === 'Exits & execution' && (
              <>
                <label>
                  Exit mode
                  <select
                    value={config.exit.mode}
                    onChange={(e) =>
                      edit((v) => {
                        const mode = e.target.value as typeof v.exit.mode;
                        v.exit = {
                          mode,
                          rr: mode === 'AI_EXIT' ? null : (v.exit.rr ?? '2'),
                          fixed_tp_enabled: mode !== 'AI_EXIT',
                          ai_close_enabled: mode !== 'FIXED_RR',
                        };
                      })
                    }
                  >
                    {['HYBRID', 'FIXED_RR', 'AI_EXIT'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Reward / risk
                  <input
                    disabled={config.exit.mode === 'AI_EXIT'}
                    value={config.exit.rr ?? ''}
                    onChange={(e) =>
                      edit((v) => {
                        v.exit.rr = e.target.value;
                      })
                    }
                  />
                </label>
                {(
                  [
                    'atr_multiplier',
                    'min_stop_fraction',
                    'max_stop_fraction',
                    'fee_allowance_rate',
                    'slippage_allowance_bps',
                  ] as const
                ).map((key) =>
                  field('stop_loss', key, key.replaceAll('_', ' ')),
                )}
                {field('stop_loss', 'atr_period', 'Stop ATR period', 'number')}
                {(
                  [
                    'taker_fee_rate',
                    'maker_fee_rate',
                    'spread_bps',
                    'slippage_bps',
                  ] as const
                ).map((key) =>
                  field('execution', key, key.replaceAll('_', ' ')),
                )}
                {field(
                  'execution',
                  'timeout_ms',
                  'Execution timeout (ms)',
                  'number',
                )}
                <div className="notice full-width">
                  Market orders / last-price trigger. Fees, spread and slippage
                  are explicit research assumptions.
                </div>
              </>
            )}
            {tab === 'Network' && (
              <>
                <label>
                  Network preset
                  <select
                    value={config.network.preset}
                    onChange={(e) =>
                      edit((v) => {
                        const preset = e.target
                          .value as typeof v.network.preset;
                        v.network.preset = preset;
                        if (preset !== 'Custom') {
                          v.network.policy_layers = [
                            ...NETWORK_PRESETS[preset],
                          ];
                          v.network.value_layers = [...NETWORK_PRESETS[preset]];
                        }
                      })
                    }
                  >
                    {['Small', 'Medium', 'Large', 'Custom'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Activation
                  <select
                    value={config.network.activation}
                    onChange={(e) =>
                      edit((v) => {
                        v.network.activation = e.target
                          .value as typeof v.network.activation;
                      })
                    }
                  >
                    {['Tanh', 'ReLU'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                {(['policy_layers', 'value_layers'] as const).map((key) => (
                  <label key={key}>
                    {key === 'policy_layers' ? 'Policy layers' : 'Value layers'}
                    <input
                      disabled={config.network.preset !== 'Custom'}
                      value={config.network[key].join(',')}
                      onChange={(e) =>
                        edit((v) => {
                          v.network[key] = e.target.value
                            .split(',')
                            .map(Number);
                        })
                      }
                    />
                  </label>
                ))}
                <div className="notice full-width">
                  Dashboard training uses the M8 Small preset. Medium/Large are
                  available in the preregistered M9 evaluation workflow. Custom
                  definitions can be validated and saved.
                </div>
              </>
            )}
            {tab === 'Training' && (
              <>
                {(
                  [
                    'total_timesteps',
                    'n_steps',
                    'batch_size',
                    'episode_length_bars',
                    'seed',
                    'n_envs',
                  ] as const
                ).map((key) =>
                  field('training', key, key.replaceAll('_', ' '), 'number'),
                )}
                {(
                  [
                    'learning_rate',
                    'gamma',
                    'gae_lambda',
                    'clip_range',
                    'entropy_coefficient',
                  ] as const
                ).map((key) =>
                  field('training', key, key.replaceAll('_', ' ')),
                )}
                <div className="notice full-width">
                  MaskablePPO · MlpPolicy · CPU. Train-only normalization;
                  chronological 70/15/15. Final holdout remains untouched.
                </div>
              </>
            )}
          </div>
          <details className="advanced">
            <summary>Complete configuration JSON</summary>
            <textarea
              aria-label="Complete configuration JSON"
              key={JSON.stringify(config)}
              defaultValue={JSON.stringify(config, null, 2)}
              onBlur={(e) => {
                try {
                  const value = validateConfiguration(
                    JSON.parse(e.target.value),
                  );
                  if (!value.valid) throw new Error('Invalid configuration');
                  setC(value.configuration);
                  onSnapshot(null);
                  setError(undefined);
                } catch {
                  setError(new ApiError(400, 'invalid_configuration_json'));
                }
              }}
            />
          </details>
          <div className="action-bar">
            <button
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await post('/configurations/validate', config);
                  setMessage(
                    'Configuration valid. Exchange readiness is assessed separately.',
                  );
                })
              }
            >
              Validate configuration
            </button>
            <span role="status">{message}</span>
          </div>
          {error && <ErrorBox error={error} />}
        </section>
        <aside className="panel config-save">
          <p className="eyebrow">VERSIONED RESEARCH</p>
          <h2>Save & freeze</h2>
          <p>
            Training uses an immutable snapshot, including these risk and
            execution assumptions.
          </p>
          <label>
            Configuration name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const saved = draft
                  ? await api<Draft>('/configurations/' + draft.id, {
                      method: 'PUT',
                      body: JSON.stringify({
                        name,
                        configuration: config,
                        expectedRevision: draft.revision,
                      }),
                    })
                  : await post<Draft>('/configurations', {
                      name,
                      configuration: config,
                    });
                setDraft(saved);
                setDrafts(
                  (await api<{ items: Draft[] }>('/configurations')).items,
                );
                onSnapshot(null);
                setMessage('Draft saved · revision ' + saved.revision);
              })
            }
          >
            Save draft
          </button>
          <button
            disabled={!draft || busy}
            onClick={() =>
              action(async () => {
                if (!draft) return;
                if (canonicalJson(draft.payload) !== canonicalJson(config))
                  throw new Error(
                    'Save your latest changes before freezing a snapshot.',
                  );
                const snapshot = await post<Snapshot>(
                  '/configurations/' + draft.id + '/snapshots',
                  { expectedRevision: draft.revision },
                );
                onSnapshot(snapshot);
                setMessage(
                  'Snapshot ' +
                    short(snapshot.id) +
                    ' frozen. Open Training to continue.',
                );
              })
            }
          >
            Freeze snapshot
          </button>
          {draft && (
            <small>
              Revision {draft.revision} · {short(draft.id)}
            </small>
          )}
          <hr />
          <h3>Saved configurations</h3>
          {drafts.length === 0 ? (
            <p>No saved drafts yet.</p>
          ) : (
            drafts.map((item) => (
              <button
                className="draft-item"
                key={item.id}
                onClick={() => {
                  setDraft(item);
                  setC(structuredClone(item.payload));
                  setName(item.name);
                  onSnapshot(null);
                  setMessage('Loaded revision ' + item.revision);
                }}
              >
                <span>{item.name}</span>
                <small>
                  v{item.revision} · {short(item.id)}
                </small>
              </button>
            ))
          )}
          <hr />
          <p>
            {datasets.length} verified local dataset
            {datasets.length === 1 ? '' : 's'} available. Match symbol,
            timeframe and coverage before training.
          </p>
          <a href="#market">Download historical prices</a>
        </aside>
      </div>
    </>
  );
}
