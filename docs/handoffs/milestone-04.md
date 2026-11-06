# Milestone 4 — Feature Engineering

Tanggal: 6 November 2026, Asia/Jakarta. Approved melalui `lanjut` setelah
[implementation plan](../plans/milestone-04.md) disajikan.

## Final Status

**Completed**. Seluruh task 4.1–4.17 dan acceptance criteria selesai diverifikasi.

## Implemented Features dan How It Works

Python memvalidasi configuration M2 secara structural/semantic dengan exact decimal
comparison, lalu memuat export M3 dengan fingerprint/checksums/coverage/source dan
snapshot provenance. Seluruh 23-ID catalog diproses secara causal, dengan seeded
EMA/Wilder averages, closed-HTF as-of alignment dan gap/warm-up unavailable.

Normalizer memakai train role/range eksplisit dan Welford population mean/variance.
Statistics disimpan sebagai canonical decimal strings pada content-addressed
artifact; transform tidak refit. Observation market window row-major disusul current
position/risk sekali, default299 finite float32 values. Context harus current dan
berasal dari caller. Shape/schema/normalizer/source compatibility diperiksa.

CLI fit/build bekerja offline tanpa API server, network atau database writes.
Artifacts memakai atomic publication, immutable create/verify dan reload integrity
checks. Snapshot config dan dataset lama tidak berubah; tidak ada migration M4.

## Completed Tasks

| Task | Implementasi / evidence |
| --- | --- |
| 4.1 Price returns | log/percentage/rolling returns; independent golden values |
| 4.2 Candle features | body/wicks/range/location; zero-range policies |
| 4.3 EMA | fast/slow/long distances, spread/slope; SMA seeds |
| 4.4 RSI | Wilder gains/losses, flat/gain/loss-only tests |
| 4.5 MACD | raw-price line, seeded signal/histogram |
| 4.6 ATR | previous-close TR, Wilder smoothing, ATR fraction |
| 4.7 Volatility | population std log returns, unannualized |
| 4.8 Volume | change, previous-window relative, current-inclusive MA ratio |
| 4.9 Multi-timeframe | backward availability join, exact closed boundary, stale/gap checks |
| 4.10 Warm-up | first-valid seed tests, gap reset, no zero-fill |
| 4.11 Normalization | explicit train fit, frozen transform, constant flag/scale1 |
| 4.12 Feature schema | TS/Python hash identity, ordering/period/layout/context scaling |
| 4.13 Position features | FLAT/LONG/SHORT caller state, PnL/exposure/distance scaling |
| 4.14 Risk context | caller UTC equity/budget anchors, drawdown/status/fraction scaling |
| 4.15 ObservationBuilder | one finite float32 builder, current context appended once |
| 4.16 Validation | schema/shape/actual parameter guard, context/artifact mismatch unavailable |
| 4.17 Tests | golden/conformance/leakage/artifact/fixture E2E + regression orchestration |

## Files Created/Modified

- `packages/contracts/src/features.ts`, index/export script; 5 JSON schemas,
  catalog/observation/semantic conformance fixtures dan feature contract tests.
- `services/quant/src/bybit_quant/`: contracts/configuration/dataset utilities,
  features/indicators/alignment/schema/normalization, observation, artifacts,
  feature CLI dan health-compatible subcommands.
- Quant tests: shared synthetic export factory, independent rational golden
  references, semantic parity, prefix/train-only invariance, shape/context,
  corruption/provenance/artifact round-trip dan explicit local public-export smoke.
- Root package/scripts untuk features:fit/features:build/verify:features;
  jsonschema4.26.0 dipromosikan dev→runtime, uv.lock mempertahankan package versions.
- Test runner: unique workspace pytest temporary directories dengan parent
  initialization; built-API startup poll budget30s, application timeout tetap.

## Tests Executed

`npm run verify:features` exit0 PASSED pada 6 November2026
19:40:10–19:42:04 WIB (`.runtime/features-report.json`: UTC12:40:10.127–12:42:04.441).
77 TypeScript contracts +30 backend unit +142 Python +30 PostgreSQL/HTTP integration
= **279 tests**, tanpa skip. Build/typecheck/ESLint/Ruff/format/export drift lulus.
Fresh/reapply/M1+M2 upgrades, legacy data preservation, zero Prisma schema diff,
built-process health dan M1–M3 ingestion/config/lease/immutability regressions lulus.

Local public-export smoke terakhir selesai 6 November2026 19:40:52 WIB,8.075s:

- Dataset M3 `3717d128-5be2-433f-90dc-ac21d3c35b54`, BTCUSDT 1 Januari2025 UTC;
  tidak ada network download baru.
- Dataset fingerprint `229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa`.
- Train `[1735689600000,1735732800000)`;495 valid fit rows.
- Normalizer `e9313eebe60972c72d972987e279757bfd3016b8faca0c3652db06c7a39bcfd9`.
- Artifact `7d34b20d9fb0f3ea010dcd618a93d705ccb8662a63fa5976a326d08f1bffb975`.
- 1185 valid vectors x299,255 warm-up unavailable; first decision04:16 UTC,
  last decision Jan2 00:00 UTC (final candle close). Heldout `[12:00,24:00)`
  mempunyai720 decisions, semuanya transform-only.
- `observations.f32` SHA256 `91f098e6c647ecf4cc53647c2275c356c54f43546775684fc19d87148184a844`.
- `decisions.jsonl` SHA256 `570a8878d39a816e8745495513976931cf9c318f7045309b3c4d8135a234751c`.
- Label context `synthetic_flat_context_on_public_market_data`; bukan account/
  simulator output. CLI replay dan reload memeriksa content ID/file hashes identik.

Ignored evidence: `.runtime/features-report.json`, `verify-features.log`,
`features-smoke.json` dan `artifacts/features/`. Tidak ada credential dicetak.

Run awal menemukan fixture temp Windows dengan ownership SID berbeda. Test runner
kini memakai parent yang dibuat eksplisit dan unique child di `.runtime/pytest/`.
Regression smoke juga menemukan cold API startup6.4s melebihi poll lama sekitar5s;
startup test diberi budget30s tanpa mengubah health timeout/production behavior.

## Acceptance Criteria Verification

Indikator dan 23-ID coverage, no-future HTF/prefix invariance, train-only statistics,
stable ordering/shape, finite dtype/context/artifact validation dan shared training/
live observation contracts terbukti melalui tests. Final regression gate lulus.

## Remaining Tasks

Tidak ada task wajib M4 tersisa. Tidak ada blocker M4.

## Known Issues dan Technical Debt

- Standard-library Python dipilih sesuai plan; full-year throughput/live latency
  belum dibenchmark. Rolling windows mengonsumsi resource sesuai period/data masuk.
- Source schemas di-load dari repository contract artifacts; installed editable
  package membutuhkan repo layout. Standalone distribution/worker protocol M8/M11.
- Historical availability adalah closed-candle assumption M3; bukan actual publish
  latency. Current instrument rules/funding cadence caveats M3 tetap berlaku.
- Hashes adalah integrity identifiers, bukan signatures. Admin dapat mengganti
  file/hash/DB via akses penuh. Local artifact registry/backup/purge belum tersedia.
- Context position/risk eksplisit sudah divalidasi, tetapi engine accounting,
  latched daily-loss/cooldown/SL dan exchange safety belum dibuat. M5/M11 tetap gate.
- Numeric tolerance diperlukan lintas platform; tidak mengklaim bitwise portability
  transcendental float results. Tidak ada model, profit/evaluation atau order claim.

## Documentation Updated dan How to Run

README, architecture, configuration, operations, decisions ADR12, roadmap,
progress, testing, plan M4 dan [features](../features.md). Handoff file ini adalah
`docs/handoffs/milestone-04.md`.

```powershell
.\.tools\node\npm.cmd run verify:features
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_feature_export.py
```

Fit/build examples, snapshot envelope API vs portable, context JSONL dan artifact
paths ada pada [features](../features.md). Offline suite tidak mengunduh Bybit.

## Next Milestone dan Status

M5 — Trading Simulator, informasi saja. Baca spec/progress/roadmap dan handoff ini,
periksa Git, lalu siapkan plan+approval baru. Gunakan observation/context semantics
M4; settlement/cost/risk/rounding/event ordering/margin/liquidation/accounting perlu
dirancang dan diuji sebelum RL. Tidak ada approval M5 atau trading dari M4.

**Waiting for Next Milestone Instruction.**
