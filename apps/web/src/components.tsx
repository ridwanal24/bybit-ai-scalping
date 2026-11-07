import { useEffect, useState } from 'react';
import {
  api,
  ApiError,
  amount,
  utc,
  type Candle,
  type Equity,
  type Metrics,
} from './api';

export function useResource<T>(
  endpoint: string | null,
  revision = 0,
  retainOnRefresh = false,
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!retainOnRefresh) setData(undefined);
    setError(undefined);
    if (!endpoint) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    api<T>(endpoint, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e : new Error('Request failed'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, revision, retainOnRefresh]);
  return { data, error, loading };
}
export function ErrorBox({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div className="notice danger" role="alert">
      <strong>Unable to complete this request</strong>
      <p>{error.message}</p>
      {error instanceof ApiError && error.issues.length > 0 && (
        <ul>
          {error.issues.slice(0, 12).map((x, i) => (
            <li key={i}>
              {x.field}: {x.message ?? x.code}
            </li>
          ))}
        </ul>
      )}
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  );
}
export function Loading({
  label = 'Loading research data…',
}: {
  label?: string;
}) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">↗</span>
      <h3>{title}</h3>
      <p>{children ?? 'Nothing has been recorded yet.'}</p>
    </div>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  return <span className={'badge ' + tone}>{children}</span>;
}
export function MetricGrid({ metrics }: { metrics: Metrics }) {
  const names = [
    'net_profit',
    'net_return',
    'max_drawdown',
    'profit_factor',
    'expectancy',
    'win_rate',
  ] as const;
  return (
    <div className="metric-grid">
      {names.map((name) => {
        const m = metrics[name];
        return (
          <div className="metric" key={name}>
            <span>{name.replaceAll('_', ' ')}</span>
            <strong
              className={
                name === 'net_profit' && Number(m.value) < 0 ? 'negative' : ''
              }
            >
              {m.value === null
                ? 'Undefined'
                : name.includes('return') ||
                    name.includes('drawdown') ||
                    name === 'win_rate'
                  ? `${amount(Number(m.value) * 100)}%`
                  : amount(m.value)}
            </strong>
            {m.value === null && <small>{m.reason}</small>}
          </div>
        );
      })}
    </div>
  );
}

function useChartWidth() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(940);
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref: setElement, width };
}
export function EquityChart({
  points,
  kind = 'equity',
}: {
  points: Equity[];
  kind?: 'equity' | 'drawdown';
}) {
  const { ref, width } = useChartWidth();
  if (!points.length) return <Empty title="No curve points" />;
  let peak = Number(points[0]!.equity);
  const values = points.map((p) => {
    peak = Math.max(peak, Number(p.equity));
    return kind === 'equity'
      ? Number(p.equity)
      : peak > 0
        ? ((peak - Number(p.equity)) / peak) * 100
        : 0;
  });
  const lo = values.reduce((a, b) => Math.min(a, b), Infinity),
    hi = values.reduce((a, b) => Math.max(a, b), -Infinity),
    span = Math.max(hi - lo, kind === 'equity' ? 1 : 0.01);
  const x = (i: number) =>
    60 + (i / Math.max(1, values.length - 1)) * (width - 90);
  const y = (v: number) => 195 - ((v - lo) / span) * 145;
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <figure className="chart" ref={ref}>
      <svg
        viewBox={`0 0 ${width} 240`}
        role="img"
        aria-label={
          kind === 'equity'
            ? 'Equity curve from verified ledger'
            : 'Drawdown curve from verified ledger'
        }
      >
        <title>
          {kind} · {points.length} ledger points
        </title>
        {[0, 1, 2, 3].map((n) => (
          <g key={n}>
            <line
              x1="60"
              x2={width - 30}
              y1={50 + (n * 145) / 3}
              y2={50 + (n * 145) / 3}
              stroke="#e7ecee"
            />
            <text x="50" y={54 + (n * 145) / 3} textAnchor="end">
              {amount(
                lo + ((3 - n) * span) / 3,
                kind === 'equity' && span >= 10 ? 0 : 2,
              )}
            </text>
          </g>
        ))}
        <polyline
          points={line}
          fill="none"
          stroke={kind === 'equity' ? '#197d73' : '#bc6c49'}
          strokeWidth="2.4"
        />
        <text x="60" y="225">
          {utc(points[0]!.time_ms).slice(11, 16)}
        </text>
        <text x={width - 30} y="225" textAnchor="end">
          {utc(points.at(-1)!.time_ms).slice(11, 16)} UTC
        </text>
      </svg>
      <figcaption>
        {kind === 'equity' ? 'Equity · USDT' : 'Drawdown · %'} · {points.length}{' '}
        points · independent research account
      </figcaption>
    </figure>
  );
}
export function CandleChart({ candles }: { candles: Candle[] }) {
  const { ref, width } = useChartWidth();
  if (!candles.length) return <Empty title="No closed candles in this page" />;
  const lo = Math.min(...candles.map((c) => Number(c.low))),
    hi = Math.max(...candles.map((c) => Number(c.high))),
    span = Math.max(hi - lo, 0.01);
  const y = (v: string) => 195 - ((Number(v) - lo) / span) * 155;
  const step = (width - 90) / candles.length;
  return (
    <figure className="chart" ref={ref}>
      <svg
        viewBox={`0 0 ${width} 240`}
        role="img"
        aria-label="Historical closed candlestick chart"
      >
        <title>Closed historical candles · {candles.length} bars</title>
        {[0, 1, 2, 3].map((n) => (
          <g key={n}>
            <line
              x1="60"
              x2={width - 30}
              y1={40 + (n * 155) / 3}
              y2={40 + (n * 155) / 3}
              stroke="#e7ecee"
            />
            <text x="50" y={44 + (n * 155) / 3} textAnchor="end">
              {amount(hi - (n * span) / 3, span < 10 ? 2 : 0)}
            </text>
          </g>
        ))}
        {candles.map((c, i) => {
          const x = 60 + (i + 0.5) * step,
            color = Number(c.close) >= Number(c.open) ? '#197d73' : '#c36654';
          return (
            <g key={c.open_time_ms}>
              <title>
                {utc(c.open_time_ms)} · O {c.open} H {c.high} L {c.low} C{' '}
                {c.close}
              </title>
              <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} />
              <rect
                x={x - Math.min(step * 0.65, 9) / 2}
                width={Math.min(step * 0.65, 9)}
                y={Math.min(y(c.open), y(c.close))}
                height={Math.max(1, Math.abs(y(c.open) - y(c.close)))}
                fill={color}
              />
            </g>
          );
        })}
        <text x="60" y="225">
          {utc(candles[0]!.open_time_ms).slice(11, 16)}
        </text>
        <text x={width - 30} y="225" textAnchor="end">
          {utc(candles.at(-1)!.open_time_ms).slice(11, 16)} UTC
        </text>
      </svg>
      <figcaption>
        Closed candles · USDT · {candles.length} bars on this page
      </figcaption>
    </figure>
  );
}
