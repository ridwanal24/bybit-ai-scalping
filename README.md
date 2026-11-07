# Bybit AI Scalping

Platform penelitian dan automated trading Bybit berbasis NestJS, React, Python,
PostgreSQL, dan MaskablePPO. Sumber requirement: [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Status aktual

Per 7 November 2026 (Asia/Jakarta), **M10 — Dashboard Completed**.
Foundation/configuration/market data/features M1–M4 tetap tersedia. Public REST ingestion
memvalidasi/menyimpan historical candles, instrument dan funding, mendukung resume,
quality report, pinned revisions, fingerprint dan JSONL export.
M4 disetujui melalui `lanjut` setelah plan disajikan; Python sekarang menyediakan
23 fitur, closed-HTF alignment, train-only normalizer dan ObservationBuilder.
M5 disetujui melalui `kerjakan`: exact ledger LONG/SHORT, fees/funding, sizing,
SL/TP/AI/forced exits, UTC risk latches dan deterministic research simulator.
Scope market/last/1x, entry exposure50%; full exchange liquidation tidak dimodelkan.

Data publik BTCUSDT 1 Januari 2025 UTC sudah terkumpul: 1.440 candle1m,
288 candle5m, 96 candle15m dan3 funding records, tanpa candle gap/invalid/conflict.
M4 standalone smoke menghasilkan1185 observations x299 dengan synthetic FLAT
context. M5 memakai ledger-generated context; scripted public-export smoke
menghasilkan1 SHORT trade, net−1.8665445 dan final equity998.1334555 USDT.
Fixture E2E mencakup LONG+SHORT; hasil bukan baseline/model evaluation.
M6 menambahkan HOLD, seeded random, EMA crossover dan constrained Buy & Hold
reference, evaluator/metrics, deterministic replay dan immutable comparison.
Instruksi `oke lanjutkan eksekusi Milestone 6` menyetujui scope M6.
M7 disetujui melalui `lanjutkan eksekusi M7`: Gymnasium reset/step, masks,
shared incremental simulator, net-equity reward dan settlement bootstrap adapter.
M8 disetujui melalui `gas eksekusi m8`: bounded CPU MaskablePPO Small training,
train-only preprocessing, masked validation/save-load, checkpoints, persistent
background jobs/progress/cancel/resource watchdog. Model research candidate tersedia.
M9 disetujui melalui `lanjut eksekusi M9`: preregistered walk-forward/multi-seed,
matched baselines, fee/slippage/RR stresses, exit/feature/architecture experiments,
immutable report/curves dan frozen once-only holdout procedure. Gate riset
dibekukan sebelum hasil; data publik satu hari belum cukup untuk promotion.
Audit ulang M9 menutup early range rejection dan exact baseline set/seed checks;
report publik tetap valid tanpa membuka holdout. [Audit](docs/audits/milestone-09.md).
M10 disetujui melalui instruksi cek ulang M9 lalu lanjut M10: dashboard React/Vite
lokal dengan konfigurasi/snapshots, candlesticks/quality, actual background training
controls/progress, evaluation/curves/trades, model comparison dan persisted research
deployment proposals. Tidak ada aktivasi exchange; M11 belum disetujui.
Panduan: [Baselines](docs/baselines.md), [RL environment](docs/rl-environment.md),
[Training](docs/training.md), [Advanced evaluation](docs/evaluation.md),
[Dashboard](docs/dashboard.md).

## Setup Windows x64

Python pada PATH dan internet diperlukan untuk bootstrap pertama. Runtime proyek
terpisah dari instalasi global; tidak membutuhkan Docker atau GPU.

```powershell
python scripts/bootstrap.py
.\.tools\node\node.exe scripts/tasks.mjs setup
.\.tools\node\npm.cmd run dev:api
```

Dashboard lokal setelah setup:

```powershell
.\.tools\node\npm.cmd run dev:dashboard
```

Buka `http://127.0.0.1:5173`. Launcher memakai API3000 dan DB proyek55432,
tidak memakai Laragon/Docker. `npm run verify:dashboard` juga menjalankan
Playwright dengan PostgreSQL terpisah dan actual quant artifacts.

API default: `http://127.0.0.1:3000/health/live` dan `/health/ready`. Setup membuat
`.env` lokal jika belum ada, menginisialisasi cluster PostgreSQL milik proyek
pada port 55432 dan menerapkan migration. Source changes memerlukan build ulang;
dev command memantau output dist. Secret/runtime tidak di-commit.

```powershell
.\.tools\node\npm.cmd run verify:foundation
.\.tools\node\npm.cmd run verify:configuration
.\.tools\node\npm.cmd run verify:market-data
.\.tools\node\npm.cmd run verify:features
.\.tools\node\npm.cmd run verify:simulation
.\.tools\node\npm.cmd run db:status
.\.tools\node\npm.cmd run db:stop
```

Verification M10 lulus:123 contract tests,37 backend unit,348 Python,31 integration
dan7 actual browser tests (546 total), static/export checks, migration upgrade/schema
diff dan seluruh M1–M9 regressions. Actual config/snapshot/training/cancel/report/
baseline/chart/trade/model/proposal flow serta desktop/mobile/no-overflow diuji.
Evidence: [testing](docs/testing.md).

Simulation CLI, approved restrictions, policies dan output: [simulation](docs/simulation.md).

Feature CLI, context JSONL, source snapshot dan artifact layout: [features](docs/features.md).

Download/export API dan CLI: [market-data](docs/market-data.md).
Public smoke adalah command terpisah `npm run smoke:bybit-data`; bukan bagian
offline verification dan tidak otomatis mengambil satu tahun data.

Mulai konfigurasi lewat `GET /configuration-presets`, lalu
`POST /configurations/validate` dan `POST /configurations`. Contoh request,
snapshot dan revision handling ada di [operations](docs/operations.md).
Configuration valid belum berarti siap trading; execution checks tetap pending.

## Dokumen

| Dokumen | Isi |
| --- | --- |
| [Planning](docs/planning.md) | Requirement, scope MVP, timeline simulator, accounting, risk, safety, kontrak, risiko terbuka |
| [Architecture](docs/architecture.md) | Ownership, data flow, komunikasi proses, database konseptual, struktur folder |
| [Roadmap](docs/roadmap.md) | Task, dependency, acceptance criteria dan checkpoint M0–M16 |
| [Decisions](docs/decisions.md) | Keputusan desain, alternatif, konsekuensi dan status |
| [Testing](docs/testing.md) | Strategi dan skenario verifikasi, hasil pemeriksaan dokumentasi |
| [Progress](docs/progress.md) | Status dan approval scope aktual |
| [Configuration](docs/configuration.md) | Environment, runtime, paths, secrets dan ports |
| [Operations](docs/operations.md) | Setup, commands, shutdown dan recovery foundation |
| [Plan M1](docs/plans/milestone-01.md) | Scope yang disetujui |
| [Handoff M1](docs/handoffs/milestone-01.md) | Hasil, acceptance dan konteks sesi berikutnya |
| [Plan M2](docs/plans/milestone-02.md) | Scope konfigurasi yang disetujui |
| [Handoff M2](docs/handoffs/milestone-02.md) | Hasil configuration system dan next-step context |
| [Market data](docs/market-data.md) | Download/resume, quality, source limitations, API/CLI dan export |
| [Plan M3](docs/plans/milestone-03.md) | Scope ingestion yang disetujui |
| [Handoff M3](docs/handoffs/milestone-03.md) | Hasil aktual, dataset publik dan konteks M4 |
| [Features](docs/features.md) | Formula, alignment, normalizer, observation/context dan offline CLI |
| [Plan M4](docs/plans/milestone-04.md) | Scope feature engineering yang disetujui |
| [Handoff M4](docs/handoffs/milestone-04.md) | Hasil aktual dan konteks M5 |
| [Simulation](docs/simulation.md) | Ledger, event/risk/funding policies, restrictions dan CLI |
| [Plan M5](docs/plans/milestone-05.md) | Scope simulator yang disetujui |
| [Handoff M5](docs/handoffs/milestone-05.md) | Hasil aktual dan konteks M6 |
| [Baselines](docs/baselines.md) | Empat strategi, metrics, comparison dan offline CLI |
| [Plan M6](docs/plans/milestone-06.md) | Scope Baseline & Simulation MVP yang disetujui |
| [Handoff M6](docs/handoffs/milestone-06.md) | Hasil aktual dan konteks M7 |
| [RL environment](docs/rl-environment.md) | Gymnasium API, masks, rewards, settlement/bootstrap dan offline smoke |
| [Plan M7](docs/plans/milestone-07.md) | Scope RL environment yang disetujui |
| [Handoff M7](docs/handoffs/milestone-07.md) | Hasil aktual dan konteks M8 |
| [Training](docs/training.md) | CPU MaskablePPO, splits, jobs, checkpoint/metadata/compatibility dan validation |
| [Plan M8](docs/plans/milestone-08.md) | Scope training yang disetujui |
| [Handoff M8](docs/handoffs/milestone-08.md) | Hasil aktual dan konteks M9 |
| [Evaluation](docs/evaluation.md) | Preregistered OOS/seed/stress experiments, reports, gates dan holdout |
| [Plan M9](docs/plans/milestone-09.md) | Scope advanced evaluation yang disetujui |
| [Handoff M9](docs/handoffs/milestone-09.md) | Hasil aktual dan konteks M10 |
| [Audit M9](docs/audits/milestone-09.md) | Temuan completeness checks dan regression fixes sebelum M10 |
| [Dashboard](docs/dashboard.md) | Local UI/API, config/train/evaluation/model/proposal flow dan tests |
| [Plan M10](docs/plans/milestone-10.md) | Scope25 dashboard tasks yang disetujui |
| [Handoff M10](docs/handoffs/milestone-10.md) | Hasil dashboard,546 tests, actual evidence dan konteks M11 |
| [Handoff M0](docs/handoffs/milestone-00.md) | Hasil, keterbatasan dan instruksi sesi berikutnya |

## Alur pengembangan

Satu persetujuan berlaku untuk satu milestone. Task normal dalam scope tersebut
tidak membutuhkan persetujuan ulang. Milestone berikutnya tidak dimulai otomatis.
Simulation MVP M6, RL proof of concept M8, advanced evaluation M9 dan dashboard riset M10 tersedia; target berikutnya
Paper M11, Demo M13, dan kemampuan Real M15.

Real Trading harus disabled by default. Persetujuan implementasi fitur Real bukan
izin transaksi dana asli. Tidak ada jaminan profit atau promosi model otomatis.

Real-time Paper/Demo/Real trading tetap milestone berikutnya. Proposal M10 bukan aktivasi.
