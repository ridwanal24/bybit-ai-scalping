# Milestone 7 — RL Environment

Tanggal:7 November2026, Asia/Jakarta. Approved melalui `lanjutkan eksekusi M7`;
[implementation plan](../plans/milestone-07.md), task7.1–7.11.

## Final Status

**Completed**. Seluruh task7.1–7.11 dan acceptance criteria selesai. M0–M6 tetap
Completed; M8/training/model/exchange orders belum disetujui atau dijalankan.

## Implemented Features dan How It Works

DatasetSession mengekstrak incremental closed-candle M3→M4→M5 timeline dari runner.
Script/baseline dan TradingEnv Gymnasium memakai session dan financial engine yang
sama. Observation/context dari frozen M4 pipeline; tidak ada simulator/accounting
atau feature implementation kedua.

TradingEnv menyediakan finite float32 Box/schema M4, Discrete5, bool masks,
fresh observation/info, reset(seed), one-main-bar step, terminated/truncated dan
close. Current-information mask mengecek state/exit mode, observation/risk/cooldown,
pending/forced intents, final eligible open/latency, ATR dan sizing preview pada
known closed price. Fill tetap revalidate terhadap actual gap/funding/constraints.
Invalid observations memakai explicit zero sentinel/HOLD-only; protections tetap
aktif. In-space masked action rejected/no-op, malformed action tidak advance.

Reward `net_equity_initial_v1` adalah net equity delta/initial capital, Decimal128
sebelum float boundary, tanpa bonus/penalty/clipping. Fees/funding, unrealized loss,
forced exit dan terminal settlement masuk sekali. Sum reward=net return.
Raw risk/invalid terminated, range end truncated. Independent settled episodes
tidak bootstrap lintas split: info bootstrap_discount0; SettledEpisodeWrapper
mempertahankan raw flags/truncation sambil memberi absorbing terminated=true.

Offline CLI HOLD/masked-random merekam actions/transition/observation hashes dan
equity/rewards, replay ke artifacts M5 dan memverifikasi setiap step terhadap
ledger. Immutable episode ID mengikat checksums, seed/agent, source/config/data/
normalizer/schema/code/lock/runtime dan linked simulation. Invalid diagnostic
tetap disimpan, bukan successful usable rollout. Tidak ada learner/model.

## Completed Tasks

| Task | Deliverable / evidence |
| --- | --- |
| 7.1 Observation space | M4 dimension/schema, fresh finite float32, unavailable sentinel+reason |
| 7.2 Action space | Discrete5, action IDs0–4, NumPy ints accepted, malformed reject |
| 7.3 Action masks | HOLD always, state/mode/risk/pending/forced/latency/sizing/current information |
| 7.4 reset | Local seed, fresh account/risk/indicators, frozen normalizer/fixed split, no carry |
| 7.5 step | Submit current decision, next eligible open, one closed bar/terminal event |
| 7.6 Integration | Shared DatasetSession/Simulator/ObservationBuilder, identical direct-run ledger |
| 7.7 Reward | Net-equity/initial, costs/funding/mark-to-market/settlement once, exact trace |
| 7.8 Termination | Raw risk/invalid vs range flags, post-settlement context, bootstrap wrapper |
| 7.9 Checks | Gymnasium check_env actual pinned runtime, no checker warnings final |
| 7.10 Determinism | Seed/reset, future/availability, direct/legacy replay, immutable artifacts |
| 7.11 Reward integrity | HOLD/overtrading/losing hold/fees/funding/forced/bankruptcy/terminal/reset |

## Files Created/Modified

- `services/quant/src/bybit_quant/rl/`: environment/wrapper, episode artifacts/
  independent verifier, offline CLI; `simulation/session.py`, runner extraction,
  Simulator masks/masked submission dan main CLI dispatch.
- `packages/contracts/src/rl.ts`, export/index, four generated schemas dan TS
  tests; Python `test_rl_environment.py`, `smoke_environment.py`.
- `services/quant/pyproject.toml`, `uv.lock`: Gymnasium1.2.1, NumPy2.3.4,
  cloudpickle3.1.2, farama-notifications0.0.6 pada Python3.12.12. Actual local
  Windows wheels installed/verified; no Torch/SB3/sb3-contrib yet.
- Root `environment:run`/`verify:environment`; README, architecture/planning/ADR15/
  operations/simulation/baseline/testing/progress/roadmap, guide/plan/handoff M7.
  Tidak ada database/config v1 migration atau perubahan source dataset/normalizer/
  preset/credentials/.env. Dependency installation memakai project-local uv/cache.

## Tests Executed

Final `.tools/node/npm.cmd run verify:environment` exit0 PASSED,
7 November2026 08:35:00–08:39:25 WIB. Report `.runtime/environment-report.json`
UTC01:35:00.231–01:39:25.286.

- **461 tests tanpa skip**:107 contracts +33 backend unit +290 Python
  +31 isolated PostgreSQL/HTTP integration. M7 menambah10 TS/32 Python cases.
- Gymnasium checker; all states/exit modes, gates/sizing/latency masks, lifecycle/
  seed/reset, readonly outputs, exact fee/reward arithmetic, funding-before-close,
  forced exit, losing HOLD/overtrading, negative equity/drawdown, post-settlement
  observation/one-time costs/flags/bootstrap target, future/availability lulus.
- Direct runner dan environment identical observations/events/trades/equity/report;
  CLI exit0/1/2, replay/reload, checksum/forged reward rejection lulus.
- Build/typecheck/ESLint/Ruff/Prettier/schema export drift, existing migrations
  fresh/reapply/M1+M2 upgrades/data preservation/zero schema diff lulus.
- No DB timeout final; owner execution context dipakai untuk native SWC/DB seperti
  M1–M6. Orchestrator menutup isolated test clusters.

Terarah M5/M6 integration36 tests lulus. Tambahan legacy comparison terhadap actual
M6 public artifacts membuktikan seluruh4 baseline punya identical action scripts,
events/trades/equity JSONL bytes dan reports setelah refactor. New IDs berubah
karena source/lock fingerprint, bukan accounting behavior. Evidence
`.runtime/environment-legacy-equivalence.json`, `.runtime/m7-legacy-equivalence/`.

## Bounded Public-Export Smoke

Existing dataset `3717d128-5be2-433f-90dc-ac21d3c35b54`, fingerprint
`229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa`.
Frozen normalizer `e9313eebe60972c72d972987e279757bfd3016b8faca0c3652db06c7a39bcfd9`.
Original preset, explicit restricted M5 policies/declared8h schedule/current
metadata/last-open proxy, episode `[2025-01-01 04:00,2025-01-02 00:00)` UTC.

HOLD dan NumPy masked-random seed42 masing-masing1200 steps (1184 valid/16 warm-up),
dua CLI runs/agent identik dan independent reward-ledger reload. Selesai08:36:12
WIB,61.587s. Semua completed_restricted, raw truncated, bootstrap0, final FLAT.
Root npm `environment:run` juga exit0 dan episode ID identik.

| Agent | Trades | Net USDT | Total reward | Fees USDT | Final equity USDT |
| --- | --- | --- | --- | --- | --- |
| HOLD | 0 | 0 | 0 | 0 | 1000 |
| Masked-random NumPy seed42 | 14 | −21.6276225 | −0.0216276225 | 13.1191225 | 978.3723775 |

Funding0/no rejected proposals; fill revalidation rejection dibuktikan fixture gap.
Float sum−0.021627622500000002 cocok terhadap Decimal net return (tolerance1e-12).
Masked NumPy agent berbeda dari M6 Python Random baseline. Tidak tuning assumptions,
download/refit/training; losses dipertahankan, bukan performance/promotion gate.

Code fingerprint `a258fa632d9016573b45ebf1fcecd517488d87804799b9e3c6b841d88a616f33`.

| Agent | Episode ID | Linked M5 simulation ID |
| --- | --- | --- |
| HOLD | `0fed0c26f5623f1ecaff2c0c3a328389d0d506531030cf0d14eefe61a4221bd2` | `104bc7aeda2d3b910813f93ba862912ba6687b39ed3147c4486a9f985860efb5` |
| Masked-random42 | `4585ef20312b005db36624bf7f168384eed5f646f471167a3038b56a57043a2c` | `76f3e4a5214484e41d0328e64b56b993053b17a162f0a9510644da69f31ed50e` |

Evidence ignored: `.runtime/verify-environment-final.log`, `environment-report.json`,
`environment-smoke.json/log`, `environment-root-cli.log`, legacy-equivalence
files, `artifacts/environments/<id>/` dan linked M5 simulations.

## Acceptance Verification dan Remaining Tasks

Gymnasium API/checker valid; masks/HOLD sesuai state/mode/gates; satu financial
simulator; reward/accounting dan deterministic/reward-integrity scenarios lulus.
Seluruh task wajib M7 selesai; tidak ada blocker atau unfinished task M7.

## Known Issues / M8 Requirements

M8 wajib memakai SettledEpisodeWrapper/bootstrap0 untuk independent settled
episodes dan reject `report.status=invalid`; raw truncation saja dapat memicu
bootstrap value yang salah pada standard learner. Manual early reset/close
membuang unfinished episode, bukan valid evaluation. Unavailable observation
sentinel/info/mask harus dihormati. Tidak ada generic mid-position TimeLimit
yang menggantikan explicit simulator settlement.

Torch/SB3/MaskablePPO compatibility, training/evaluation/model metadata, smoke
resource budget, jobs/progress/cancel/save-load dan OOS selection masih M8+.
Memory default streaming/count-only; full-year/learner throughput belum diuji.
Artifacts membutuhkan source layout/linked M5 archive, hash bukan signature.
Restricted market/last/1x/50%, OHLC ambiguity/full fills, artificial settlement,
declared funding proxy/current metadata tetap bukan exchange realism/live readiness.

## How to Run dan Next Milestone

```powershell
.\.tools\node\npm.cmd run verify:environment
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_environment.py
.\.tools\node\npm.cmd run environment:run -- --request .runtime/environment-smoke/masked_random.json
```

API/request/reward/bootstrap/policies: [RL environment guide](../rl-environment.md).
M8 — RL Training adalah next milestone; belum Approved. Baca spec/progress/roadmap/
handoff ini dan susun plan M8. Reuse shared session/simulator/normalizer/masks;
tetapkan Small CPU smoke budget sebelum training, gunakan mask-aware evaluation,
save/load compatibility dan settlement adapter. Profit bukan technical acceptance.
Tidak otomatis mengaktifkan training/model promotion/exchange execution.

**Waiting for Next Milestone Instruction.**
