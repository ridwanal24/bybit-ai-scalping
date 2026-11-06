# Bybit AI Scalping

Platform penelitian dan automated trading Bybit berbasis NestJS, React, Python,
PostgreSQL, dan MaskablePPO. Sumber requirement: [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Status aktual

Per 6 November 2026 (Asia/Jakarta), **M5 — Trading Simulator Completed**.
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
Belum ada frontend, training/model atau exchange execution. M6 belum disetujui.

## Setup Windows x64

Python pada PATH dan internet diperlukan untuk bootstrap pertama. Runtime proyek
terpisah dari instalasi global; tidak membutuhkan Docker atau GPU.

```powershell
python scripts/bootstrap.py
.\.tools\node\node.exe scripts/tasks.mjs setup
.\.tools\node\npm.cmd run dev:api
```

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

Verification M5 lulus:84 contract tests,33 backend unit,236 Python,31 integration
(384 total), static/export checks, migration upgrade/schema diff dan seluruh
M1–M4/audit regressions. Exact accounting, event ordering, unavailable gates,
artifact reconciliation, fixture E2E dan public-export replay lulus.
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
| [Handoff M0](docs/handoffs/milestone-00.md) | Hasil, keterbatasan dan instruksi sesi berikutnya |

## Alur pengembangan

Satu persetujuan berlaku untuk satu milestone. Task normal dalam scope tersebut
tidak membutuhkan persetujuan ulang. Milestone berikutnya tidak dimulai otomatis.
Simulation MVP ditargetkan pada M6, RL proof of concept M8, dashboard riset M10,
Paper M11, Demo M13, dan kemampuan Real M15.

Real Trading harus disabled by default. Persetujuan implementasi fitur Real bukan
izin transaksi dana asli. Tidak ada jaminan profit atau promosi model otomatis.

Komponen setelah foundation/configuration/market data tetap rancangan masa depan.
