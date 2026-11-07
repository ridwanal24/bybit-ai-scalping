# Roadmap

Tanggal: 7 November 2026, Asia/Jakarta. Sumber requirement tetap
[PROJECT_SPEC.md](../PROJECT_SPEC.md) bagian 39–40. Task asli dipertahankan di bawah;
roadmap ini menambahkan dependency dan checkpoint, tidak memberi approval baru.

## Phase dan dependency

| Phase | Milestone utama | Hasil end-to-end |
| --- | --- | --- |
| Planning | M0 | Rancangan dan dokumentasi diterima |
| 1 Foundation & Market Data | M1–M3 | Data valid tersimpan dan dapat digunakan |
| 2 Simulation MVP | M4–M6 | Baseline menghasilkan trades, equity dan accounting konsisten |
| 3 RL Proof of Concept | M7–M8 | Model training/save/load dan keputusan valid |
| 4 Research Platform | M9–M10 | Evaluasi lanjutan dan dashboard backend nyata |
| 5 Real-Time & Demo | M11–M13 | Paper lalu actual Demo lifecycle |
| 6 Live Readiness | M14 | Safety dan recovery terbukti |
| 7 Controlled Real | M15 | Executor/dry-run siap; rollout dana terpisah |
| 8 Continuous Improvement | M16 terpilih | Paket backlog dengan scope/approval baru |

Urutan konservatif M0 → M1 → … → M15; dependency teknis khusus dicatat di setiap
milestone. Tidak otomatis melanjutkan milestone walaupun dependency sudah selesai.
Setiap plan harus menjelaskan file, versi dependency, migration, tests dan scope
yang konkret sebelum persetujuan milestone tersebut.

## Status dan acceptance gates

| M | Status / approval | Dependency | Acceptance dan checkpoint utama |
| --- | --- | --- | --- |
| 0 | Completed; pelaksanaan dan hasil planning Approved | Spesifikasi | 18 task terdokumentasi, ambiguities tercatat, batas MVP/ownership/dependency jelas, dokumen konsisten; hasil diterima melalui `oke ku approve`, 5 November 2026 |
| 1 | Completed; [plan Approved](plans/milestone-01.md), [handoff](handoffs/milestone-01.md) | M0 diterima | Backend/Python berjalan, DB connected, migration/health/tests/verification lulus; setup terdokumentasi |
| 2 | Completed; [plan Approved](plans/milestone-02.md), [handoff](handoffs/milestone-02.md) | M1 | Config persistence/validation, immutable snapshot, presets/compatibility dan integration/regression lulus |
| 3 | Completed; [plan](plans/milestone-03.md), [handoff](handoffs/milestone-03.md) | M1–M2 | 135 tests dan public BTCUSDT24h collection/export lulus; revisions/quality/resume/fingerprint dan source caveats tersedia |
| 4 | Completed; [plan Approved](plans/milestone-04.md), [handoff](handoffs/milestone-04.md) | M2–M3 | 290 tests setelah perbaikan audit + local public-export smoke/replay lulus; 23 fitur, main/HTF availability, ordering/shape, train-only normalizer dan semantic parity |
| 5 | Completed; [plan Approved](plans/milestone-05.md), [handoff](handoffs/milestone-05.md) | M2–M4 | 384 tests + local public-export simulation/replay lulus; exact LONG/SHORT ledger, costs/risk/exits/funding dan restricted1x/50% envelope |
| 6 | Completed; [plan Approved](plans/milestone-06.md), [handoff](handoffs/milestone-06.md) | M3–M5 | 419 tests + four-baseline public-export replay/reload lulus; shared simulator/risk/costs, exact metrics/undefined reasons dan immutable comparison |
| 7 | Completed; [plan Approved](plans/milestone-07.md), [handoff](handoffs/milestone-07.md) | M4–M6 | 461 tests, Gymnasium checker, shared incremental timeline/masks, net-equity reward/settlement/bootstrap, legacy M6 byte equivalence dan public1200-step replay/reload lulus |
| 8 | Completed; [plan Approved](plans/milestone-08.md), [handoff](handoffs/milestone-08.md) | M7 | 496 tests + two reproducible1024-step CPU jobs; train-only split/normalization, masked validation/save-load, metadata/checkpoints dan background progress/cancel/limits lulus |
| 9 | Completed; Approved `lanjut eksekusi M9` | M6–M8 | Preregistered OOS/multi-seed/WFO, matched baselines/stresses, exploratory retraining, verified reports/curves dan frozen once-only holdout/gates; short public data insufficient, tanpa promotion |
| 10 | Completed; Approved audit M9 lalu lanjut M10 | M2–M3, M8–M9 |546 tests incl7actual browser; actual config/snapshot/train/cancel/evaluation/chart/trades/model comparison/proposal, desktop/mobile/readiness guards; no execution activation |
| 11 | Planned; belum Approved | M4–M10 | Closed candle real-time → inference → risk → virtual fill; persistence/recovery, paper dashboard, no exchange order; risk conformance gate |
| 12 | Planned; belum Approved | M11 | Environment/credentials terisolasi, account state read, capability/ownership/order lifecycle, idempotency contract tests; live order belum diizinkan |
| 13 | Planned; belum Approved | M11–M12 | Actual Demo entry/exit, fill, protective stop, reconciliation, restart, emergency dan dashboard terverifikasi; Demo evaluation checkpoint |
| 14 | Planned; belum Approved | M9, M12–M13 | Critical safety/failure injection lulus, blocker closed, restore/recovery terbukti, readiness report; Real tidak otomatis aktif |
| 15 | Planned; belum Approved | M14 + model/account readiness | Real executor/credentials/safety/lifecycle siap, dry-run tanpa real order berhasil; controlled rollout tetap perlu izin operasional dana asli terpisah |
| 16 | Backlog; belum Approved | Sesuai paket terpilih | Scope dan acceptance ditetapkan per paket baru; bukan izin mengerjakan seluruh backlog |

## Task M0 — Project Planning

| Task | Deliverable | Status penyusunan |
| --- | --- | --- |
| 0.1 Requirement analysis | Planning: requirement mapping | Selesai |
| 0.2 MVP scope definition | Planning: batas checkpoint M6/M8/M10 | Selesai |
| 0.3 Technical risk assessment | Planning: R01–R16 | Selesai |
| 0.4 High-level architecture | Architecture: components/ownership | Selesai |
| 0.5 Data flow design | Architecture: diagram dan flows | Selesai |
| 0.6 Node.js–Python communication | Architecture: worker protocol | Selesai |
| 0.7 Trading logic ownership | Architecture + decisions ADR-02 | Selesai |
| 0.8 Simulator event ordering design | Planning: timeline, gaps/terminal/funding | Selesai |
| 0.9 Accounting/reward design | Planning: equations dan walkthrough | Selesai |
| 0.10 Strategy risk design | Planning: sizing, daily loss/drawdown, masks | Selesai |
| 0.11 Operational safety design | Planning: failure responses | Selesai |
| 0.12 Order lifecycle design | Planning: intent/state/reconciliation | Selesai |
| 0.13 Model compatibility policy | Planning: snapshot/schema/deployment gates | Selesai |
| 0.14 Account ownership policy | Planning: dedicated account, foreign activity block | Selesai |
| 0.15 Conceptual database design | Architecture: entities/invariants | Selesai |
| 0.16 Folder structure | Architecture: planned folders | Selesai |
| 0.17 Documentation structure | README links dan progress/handoff | Selesai |
| 0.18 Detailed roadmap review | Roadmap: task lengkap, dependencies dan gates | Selesai |

Selesai di tabel berarti deliverable planning tersedia, bukan acceptance akhir
pengguna atau fitur aplikasi sudah berjalan. Bukti verifikasi ada di
[testing](testing.md); penerimaan akhir M0 diberikan melalui `oke ku approve`
pada 5 November 2026. Seluruh acceptance criteria M0 terpenuhi.

## Task milestone berikutnya

Daftar ini mempertahankan nomor task spesifikasi. Prioritas internal dan file
konkret dirinci ulang dalam implementation plan setiap milestone.

### M1 — Project Foundation

Status: Completed. Seluruh task 1.1–1.14 selesai; evidence per task dan acceptance
tersedia pada [handoff M1](handoffs/milestone-01.md). M2 tetap Planned.

- 1.1 Repository initialization; 1.2 NestJS setup; 1.3 TypeScript setup.
- 1.4 Linting/formatting; 1.5 Environment configuration; 1.6 PostgreSQL setup.
- 1.7 ORM setup; 1.8 Database migrations; 1.9 Health check.
- 1.10 Backend tests; 1.11 Python environment; 1.12 Python tests.
- 1.13 Local development commands; 1.14 Foundation integration test.

Repository sudah memiliki Git; periksa kebutuhan initialization agar tidak menimpa
history. Pilih versi Node/Python/PostgreSQL/ORM dan lockfile yang kompatibel.
Python foundation tidak perlu memasang seluruh stack RL sebelum dibutuhkan.

### M2 — Configuration System

Completed: task 2.1–2.15 selesai dan diverifikasi. Final verification 86 automated
tests plus E2E smoke; schema/migration tanpa drift, development migration diterapkan.
Bukti dan batas kemampuan ada di [handoff M2](handoffs/milestone-02.md).

- 2.1 Market config; 2.2 Risk config; 2.3 SL/TP/RR config.
- 2.4 Exit mode config; 2.5 Execution config; 2.6 Feature config.
- 2.7 Neural network config; 2.8 Training config; 2.9 Type/range validation.
- 2.10 Cross-field validation; 2.11 Persistence; 2.12 Immutable snapshots.
- 2.13 Presets; 2.14 Compatibility rules; 2.15 Configuration integration tests.

Selesaikan R06/R07 sebelum konfigurasi dipakai run. M2 menyediakan contract dan
validation network; training dan architecture research tetap M8/M9.

### M3 — Bybit Market Data

Completed: task3.1–3.17 selesai; evidence actual data, migrations/schema diff,
offline135 tests dan batas kemampuan tercatat pada [handoff M3](handoffs/milestone-03.md).

- 3.1 REST client; 3.2 OHLCV fetch; 3.3 Pagination.
- 3.4 Timestamp normalization; 3.5 Candle validation; 3.6 Persistence.
- 3.7 Duplicate prevention; 3.8 Gap detection; 3.9 Incomplete candle handling.
- 3.10 Retry/backoff; 3.11 Resumable download; 3.12 Dataset metadata.
- 3.13 Data quality report; 3.14 Dataset fingerprint; 3.15 Instrument metadata.
- 3.16 Funding data; 3.17 Market data integration test.

Gunakan fixtures untuk failure/pagination dan public API smoke hanya bila tersedia;
hasil aktual harus dibedakan. Dataset berubah memerlukan versi baru.

### M4 — Feature Engineering

Implementation plan: [milestone-04.md](plans/milestone-04.md), 6 November 2026.
Approved melalui `lanjut`; seluruh task4.1–4.17 dan Python semantic configuration
parity selesai. Evidence/gates pada [handoff M4](handoffs/milestone-04.md).

- 4.1 Price returns; 4.2 Candle features; 4.3 EMA; 4.4 RSI; 4.5 MACD.
- 4.6 ATR; 4.7 Volatility; 4.8 Volume; 4.9 Multi-timeframe alignment.
- 4.10 Warm-up; 4.11 Normalization; 4.12 Feature schema; 4.13 Position features.
- 4.14 Risk context; 4.15 ObservationBuilder; 4.16 Observation validation.
- 4.17 Feature/observation tests.

### M5 — Trading Simulator

Implementation plan: [milestone-05.md](plans/milestone-05.md),6 November2026.
Approved melalui `kerjakan`; task5.1–5.27 selesai dan diverifikasi.
Plan menetapkan market-only/last-price/1x, declared funding schedule dengan
boundary settlements, conservative envelope dan artifact/ledger contracts.

- 5.1 Market state; 5.2 Portfolio state; 5.3 Position state.
- 5.4 Long PnL; 5.5 Short PnL; 5.6 Entry accounting; 5.7 Exit accounting.
- 5.8 Fees; 5.9 Slippage; 5.10 Quantity rounding; 5.11 Position sizing.
- 5.12 Hard SL; 5.13 Fixed TP; 5.14 AI early exit; 5.15 Hybrid exit.
- 5.16 Funding; 5.17 Margin validation; 5.18 Liquidation handling or documented restrictions.
- 5.19 Equity tracking; 5.20 Trade history; 5.21 Daily loss protection.
- 5.22 Drawdown protection; 5.23 Episode end; 5.24 Deterministic runner.
- 5.25 Event ordering tests; 5.26 Accounting regression tests.
- 5.27 Simulator integration test.

Review kapasitas scope sebelum implementasi; bila perlu split, ajukan struktur
dan acceptance end-to-end sekali, tunggu persetujuan. Dilarang mulai RL sebelum
simulator melewati accounting/event ordering gate.

### M6 — Baseline & Simulation MVP

- 6.1 Always HOLD; 6.2 Random Agent; 6.3 EMA crossover; 6.4 Buy & Hold reference.
- 6.5 Baseline evaluator; 6.6 Baseline comparison.
- 6.7 End-to-end baseline backtest; 6.8 Simulation MVP verification.

Buy & Hold dilabeli reference dengan exposure/biaya yang eksplisit; tidak boleh
menyembunyikan perbedaan constraint dengan strategi single-position risk-limited.

### M7 — RL Environment

- 7.1 Observation space; 7.2 Action space; 7.3 Action masks.
- 7.4 reset(); 7.5 step(); 7.6 Simulator integration; 7.7 Reward.
- 7.8 Episode termination; 7.9 Environment checks; 7.10 Deterministic tests.
- 7.11 Reward hacking tests.

### M8 — RL Training

- 8.1 Chronological split; 8.2 Data preparation; 8.3 Small architecture.
- 8.4 MaskablePPO integration; 8.5 Smoke training; 8.6 Validation evaluator.
- 8.7 Checkpoint saving; 8.8 Model metadata; 8.9 Model save/load.
- 8.10 Training logs; 8.11 Reproducibility; 8.12 Background jobs.
- 8.13 Progress reporting; 8.14 Cancellation; 8.15 Resource limits.
- 8.16 RL end-to-end verification.

Tetapkan smoke budget CPU/timesteps/durasi sebelum run. Evaluator wajib mask-aware.
Jika training gagal/tidak profitable, laporkan tanpa mengubah tujuan teknis.

### M9 — Advanced Evaluation

Task9.1–9.19 selesai. [Guide](evaluation.md), [handoff](handoffs/milestone-09.md).

- 9.1 Net PnL; 9.2 Drawdown metrics; 9.3 Profit factor; 9.4 Expectancy.
- 9.5 Trade statistics; 9.6 Equity curve; 9.7 Baseline comparison.
- 9.8 Multi-seed evaluation; 9.9 Walk-forward splits; 9.10 Walk-forward runner.
- 9.11 Fee sensitivity; 9.12 Slippage sensitivity; 9.13 RR sensitivity.
- 9.14 Exit mode comparison; 9.15 Feature ablation; 9.16 Architecture comparison.
- 9.17 Evaluation report; 9.18 Final holdout procedure; 9.19 Model promotion criteria.

Kerjakan prosedur holdout dan pre-registration promotion criteria sebelum run
evaluasi yang dipakai keputusan; nomor task bukan kewajiban urutan eksekusi.

### M10 — Dashboard

Seluruh25tasks selesai. [Guide](dashboard.md), [handoff](handoffs/milestone-10.md).

- 10.1 React/Vite setup; 10.2 Routing; 10.3 Layout; 10.4 Navigation; 10.5 Overview.
- 10.6 Market configuration; 10.7 Feature configuration; 10.8 Risk configuration.
- 10.9 SL/TP/RR configuration; 10.10 Neural network configuration.
- 10.11 Training configuration; 10.12 Configuration API integration.
- 10.13 Historical data page; 10.14 Candlestick chart; 10.15 Training controls.
- 10.16 Training progress; 10.17 Experiment history; 10.18 Evaluation metrics.
- 10.19 Equity/drawdown charts; 10.20 Trade history; 10.21 Model comparison.
- 10.22 Model deployment UI; 10.23 Loading/error states; 10.24 Responsive review.
- 10.25 Dashboard integration tests.

Deployment UI menunjukkan readiness/mode capability; fitur exchange belum tersedia
harus disabled/empty secara jelas. Review scope untuk usulan split sebelum approval;
tidak membuat UI mock yang mengaku live atau mengaktifkan Real melalui frontend.

### M11 — Paper Trading

- 11.1 Public WebSocket; 11.2 Closed candle processing; 11.3 Reconnect.
- 11.4 Incremental features; 11.5 ObservationBuilder integration.
- 11.6 Model compatibility; 11.7 Inference; 11.8 Action validation.
- 11.9 Strategy risk checks; 11.10 Operational safety checks; 11.11 Paper execution.
- 11.12 Position persistence; 11.13 Recovery; 11.14 Audit logs; 11.15 Paper dashboard.
- 11.16 Stale data handling; 11.17 Backtest/paper comparison; 11.18 End-to-end tests.

Selesaikan transport inference, latency budget, conformance dan restore test.
General order concepts dipakai minimal untuk Paper; adapter exchange lengkap M12.

### M12 — Exchange Integration

- 12.1 Exchange adapter interface; 12.2 Environment separation; 12.3 Credential isolation.
- 12.4 Authentication; 12.5 Balance retrieval; 12.6 Position retrieval.
- 12.7 Active order retrieval; 12.8 Capability checks; 12.9 Order state machine.
- 12.10 Unique order identifiers; 12.11 Idempotency; 12.12 Account ownership checks.
- 12.13 Contract tests.

Credential account read memerlukan izin penggunaan yang eksplisit bila belum
tercakup approval milestone. Fixtures tidak membuktikan koneksi akun nyata.

### M13 — Bybit Demo

- 13.1 Demo REST client; 13.2 Demo private WebSocket; 13.3 Connectivity.
- 13.4 Entry order; 13.5 Order confirmation; 13.6 Execution tracking.
- 13.7 Protective SL; 13.8 Fixed TP; 13.9 Reduce-only close; 13.10 AI early exit.
- 13.11 Partial fills; 13.12 Timeout recovery; 13.13 Reconciliation.
- 13.14 Restart recovery; 13.15 Duplicate prevention; 13.16 Emergency controls.
- 13.17 Demo dashboard; 13.18 End-to-end Demo tests; 13.19 Demo evaluation checkpoint.

Simpan bukti executions/position/stop, bukan hanya HTTP ACK. Credential dan actual
Demo order harus jelas termasuk scope approval M13 sebelum menjalankan integrasi.

### M14 — Live Trading Safety

- 14.1 Credential audit; 14.2 Strategy risk audit; 14.3 Operational safety audit.
- 14.4 Order manager audit; 14.5 Protective SL audit; 14.6 Reconciliation audit.
- 14.7 Restart recovery audit; 14.8 Preflight checks; 14.9 Account ownership validation.
- 14.10 Model approval workflow; 14.11 Trading activation controls.
- 14.12 Audit logging; 14.13 Operational alerts; 14.14 Failure injection tests.
- 14.15 Readiness report.

### M15 — Bybit Real Trading

- 15.1 Real executor; 15.2 Real connectivity; 15.3 Balance validation.
- 15.4 Position synchronization; 15.5 Order lifecycle; 15.6 Protective SL verification.
- 15.7 Real trading readiness; 15.8 Explicit activation controls; 15.9 Real dashboard.
- 15.10 Dry-run without real orders.
- 15.11 Controlled real-money rollout only after separate explicit approval.
- 15.12 Monitoring; 15.13 Incident handling; 15.14 Paper/Demo/Real comparison.

Implementation readiness dan dry-run tidak berarti izin 15.11. Report harus
membedakan fitur siap, hasil dry-run, dan rollout yang belum diizinkan/dilaksanakan.
Jika model/operasional gagal gate, jangan rollout meskipun kode selesai.

### M16 — Continuous Improvement (backlog)

- 16.1 Additional neural network presets; 16.2 Custom architectures.
- 16.3 Architecture comparison improvements; 16.4 Optuna integration.
- 16.5 Hyperparameter search spaces; 16.6 Trial runner; 16.7 Trial validation.
- 16.8 Optimization history; 16.9 Resource limits; 16.10 Multi-seed shortlist.
- 16.11 Optimization dashboard; 16.12 Alternative RL algorithms.
- 16.13 Additional pairs; 16.14 Additional timeframes.
- 16.15 Improved market data granularity; 16.16 Execution model improvements.
- 16.17 Performance improvements; 16.18 Reliability improvements.

Setiap paket backlog memerlukan plan, ID/scope dan approval terpisah.
