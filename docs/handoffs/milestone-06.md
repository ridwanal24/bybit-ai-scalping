# Milestone 6 — Baseline & Simulation MVP

Tanggal:7 November2026, Asia/Jakarta. Approved melalui instruksi
`oke lanjutkan eksekusi Milestone 6`; [implementation plan](../plans/milestone-06.md).

## Final Status

**Completed**. Task6.1–6.8 dan empat acceptance criteria selesai dalam restricted
research scope. Checkpoint Phase2 Simulation MVP tercapai; tidak ada approval M7.

## Implemented Features dan How It Works

HOLD, random berseed, EMA crossover dari main-timeframe M4 dan single-attempt
long Buy & Hold reference menghasilkan actions pada valid observations/current
ledger context. Runner M5 memberi closed indicators termasuk prehistory, dengan
decision/availability gate yang sama. Tidak ada simulator atau risk bypass baru.
EMA menutup posisi lawan sebelum entry keputusan berikutnya; Fixed RR tidak
memakai discretionary close. Protective exit tidak auto-reentry tanpa cross baru.

Evaluator menulis streaming action scripts, mereplay memakai artifact engine M5,
memeriksa report identik, lalu menerbitkan content-addressed comparison. Verifier
memeriksa script/ledger checksums, common config/data/normalizer/range/policy/code
provenance, recomputed metrics, status dan unique strategy/seed. Existing output
tidak dioverwrite. Archive harus membawa linked simulation artifacts.

Metrics Decimal: net PnL/return, sampled drawdown, profit factor, win rate,
average win/loss, expectancy, holding duration, sampled open exposure, fees/funding.
Undefined metrics null+reason, termasuk separate slippage attribution dan Sharpe.
Slippage sudah ada dalam fills, tidak didebit ulang. Invalid simulations membawa
diagnostics dan null performance metrics. Equity/drawdown curves dari ledger M5.

## Completed Tasks

| Task | Deliverable / evidence |
| --- | --- |
| 6.1 Always HOLD | Action0, zero trades/costs/net return pada fixture/public export |
| 6.2 Random Agent | Explicit seed0–2^32−1, local RNG, position/exit/risk-aware choices |
| 6.3 EMA crossover | M4 fast/slow main EMA sign cross, gap reset, close-then-entry, no stop reentry |
| 6.4 Buy & Hold | Constrained perpetual single-attempt long reference, same risk/stops/costs |
| 6.5 Evaluator | Exact net metrics/undefined reasons, streaming script + verified M5 replay |
| 6.6 Comparison | Strategy/seed/script/linked artifact identity; common provenance and metric reload |
| 6.7 End-to-end | Verified M3→M4→four policies→M5→trades/equity/metrics→replay/reload/CLI |
| 6.8 MVP verification | 419 regression tests, public-export smoke, docs/ADR/handoff |

## Files Created/Modified

- `services/quant/src/bybit_quant/baselines/`: strategies, metrics, evaluator,
  offline CLI; optional strategy hook pada existing simulation runner dan CLI dispatch.
- `packages/contracts/src/baselines.ts`, export/index, four generated schemas;
  TypeScript contracts tests dan Python baseline/fixture/CLI regressions.
- `tests/smoke_baselines.py`, root `baseline:run` dan `verify:baselines` tasks.
- README, architecture/planning/ADR14/operations/simulation/testing/progress/roadmap,
  baseline guide, plan M6 dan handoff ini. Tidak ada dependency/migration/config
  schema v1 change; source data, normalizer, credentials dan `.env` tidak diubah.

## Tests Executed

Final `.tools/node/npm.cmd run verify:baselines` exit0 PASSED,
7 November2026 08:10:19–08:13:56 WIB. Report `.runtime/baselines-report.json`
UTC01:10:19.060–01:13:56.627.

- **419 tests tanpa skip**:97 TypeScript contracts +33 backend unit +258 Python
  +31 isolated PostgreSQL/HTTP integration. Semua M1–M5 regressions tetap lulus.
- Build/typecheck/ESLint/Ruff/Prettier/schema-export drift; fresh/reapply dan
  M1/M2 upgrade/data preservation/zero schema diff lulus.
- Seed determinism/differences, EMA/exit/risk semantics, independent net metric
  arithmetic/breakeven/undefined, four-policy fixture actual trades/replay/reload,
  future mutations, mixed-policy provenance, metric/script corruption lulus.
- Invalid SHORT shock mempertahankan diagnostic artifacts/null performance;
  CLI exit0/1/2, sanitized errors dan replay identik lulus.

Initial sandbox full run berhenti pada SWC cache owner-SID check. Final memakai
owner execution context sebagaimana M1–M5; tidak mengganti dependency/ACL atau
production timeout. Initial invalid fixture diperbaiki dari LONG downside
(tidak menembus1x/50% envelope) ke SHORT upside shock. Final tidak mengalami
DB timeout; test clusters dihentikan oleh orchestrator.

## Bounded Public-Export Smoke

Existing dataset `3717d128-5be2-433f-90dc-ac21d3c35b54`, fingerprint
`229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa`.
Frozen normalizer `e9313eebe60972c72d972987e279757bfd3016b8faca0c3652db06c7a39bcfd9`.
Episode `[2025-01-01 04:00,2025-01-02 00:00)` UTC, original M2 preset, declared8h
funding schedule/last-open proxy/current metadata acknowledgements. Seed42 dan
periods tetap; tidak tuning setelah losses/zero trades.

Dua Python CLI runs + independent comparison reload selesai08:09:52 WIB,91.921s;
output identik. Semua results `completed_restricted`, final FLAT.
Root `npm run baseline:run -- --request .runtime/baselines-smoke/request.json`
juga exit0, export drift check lulus dan menghasilkan comparison ID yang sama.

| Baseline | Trades | Net USDT | Final equity USDT | Fees USDT | Sampled exposure |
| --- | --- | --- | --- | --- | --- |
| HOLD | 0 | 0 | 1000 | 0 | 0 |
| Random seed42 | 13 | −21.376356 | 978.623644 | 12.177356 | 0.02 |
| EMA crossover | 9 | −11.7493405 | 988.2506595 | 8.4768405 | 0.075 |
| Buy & Hold reference | 0 | 0 | 1000 | 0 | 0 |

Funding semua0. Buy & Hold attempt ditolak `stop_distance_outside_limits`; zero
PnL bukan completed filled Buy & Hold trade. Random348/EMA44 proposals juga
ditolak oleh gate yang sama. Actual reference trade dibuktikan synthetic fixture.
Max sampled drawdown random0.021376356; EMA sekitar0.0123136551. Exposure adalah
fraction open samples, bukan notional exposure atau exact intrabar duration.

Comparison ID: `d4f107dc48082e2b315c64e06218317e73d6d51eba157d38279fec358ad08d15`.
Code fingerprint: `291e4e3c70af1f382b54b9ed9a89aabe46d429875e89368539b28ca1d147a373`.

| Baseline | Linked simulation artifact ID |
| --- | --- |
| HOLD | `ca83c6c27310e52394f7f9c10b087e3f1064378ecc1eb1c98accb31cc006888b` |
| Random42 | `d926c2dafafb8ad617fbd2cdea62373a9be7aae69fcc3e8ed2be6a0069619387` |
| EMA | `165abdd3d4d56536f395cafeff5828141ee4fb9660b7e49e9e542baeb084d4d7` |
| Buy & Hold | `3354c77058efcde59a221b8c08a9bbc9f5ad10a396106cca82e8330560e70376` |

Evidence ignored: `.runtime/verify-baselines-final.log`, `baselines-report.json`,
`baselines-smoke.json`, `baselines-smoke.log`, `baselines-root-cli.log` dan `artifacts/baselines/<id>/`
beserta linked simulations.

## Acceptance Criteria Verification

Historical data menjadi policy decisions melalui verified M3/M4; simulator
menghasilkan fixture/public trades dan reconciled equity; exact baseline metrics
dan undefined reasons tersedia; full CLI pipeline/comparison/replay/reload lulus.
Public reference zero-trade diungkap eksplisit, tanpa melonggarkan risk defaults.
Seluruh acceptance selesai dalam scope restricted research, tanpa klaim efficacy.

## Remaining Tasks dan Known Issues

Tidak ada task wajib M6 tersisa. Full-year throughput, multi-seed/OOS efficacy,
Sharpe sampling/annualization, separate slippage attribution, model promotion dan
live risk conformance tetap milestone/backlog terkait. Two-pass replay menambah
CPU/I/O; memory streaming bounded. Artifact hashes bukan signature dan layout
masih bergantung repo/linked simulation directories.

Buy & Hold bukan spot/100%-exposure benchmark. Semua policy tetap hard SL/TP,
holding/daily/drawdown limits, market/last/1x/50% envelope, artificial terminal
settlement, declared funding schedule/last-open proxy dan current metadata.
Sampling tidak membuktikan intrabar path atau exchange liquidation realism.
Smoke losses/zero trades tidak membuktikan strategy efficacy atau live readiness.

## How to Run dan Next Milestone

```powershell
.\.tools\node\npm.cmd run verify:baselines
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_baselines.py
.\.tools\node\npm.cmd run baseline:run -- --request .runtime/baselines-smoke/request.json
```

Request/strategy/metrics/reload semantics: [baseline guide](../baselines.md).
M7 — RL Environment adalah next milestone, belum Approved. Baca spec/progress/
roadmap/handoff ini dan susun plan M7 sebelum pekerjaan berikutnya. Reuse
simulator dan M4 observations; Gymnasium API/masks/reward/bootstrap semantics
belum diimplementasikan. Tidak ada approval training atau exchange orders.

**Waiting for Next Milestone Instruction.**
