# Bybit AI Scalping

Platform penelitian dan automated trading Bybit berbasis NestJS, React, Python,
PostgreSQL, dan MaskablePPO. Sumber requirement: [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Status aktual

Per 5 November 2026 (Asia/Jakarta), **M3 — Bybit Market Data Completed**.
Foundation dan configuration M1/M2 tetap tersedia. Public REST ingestion kini
memvalidasi/menyimpan historical candles, instrument dan funding, mendukung resume,
quality report, pinned revisions, fingerprint dan JSONL export.
Implementasi M3 disetujui melalui `lanjutkan` setelah plan disajikan.

Data publik BTCUSDT 1 Januari 2025 UTC sudah terkumpul: 1.440 candle1m,
288 candle5m, 96 candle15m dan3 funding records, tanpa candle gap/invalid/conflict.
Belum ada frontend, feature engine, simulator, training/model atau trading execution.
M4 — Feature Engineering belum disetujui dan tidak dimulai otomatis.

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
.\.tools\node\npm.cmd run db:status
.\.tools\node\npm.cmd run db:stop
```

Verification M3 lulus: 70 contract tests, 30 unit backend, 5 Python, 30 integration
(135 total), migration upgrade/schema diff, export/Python checks dan seluruh M1/M2
regressions. Public smoke dan export aktual juga lulus. Evidence: [testing](docs/testing.md).

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
| [Handoff M0](docs/handoffs/milestone-00.md) | Hasil, keterbatasan dan instruksi sesi berikutnya |

## Alur pengembangan

Satu persetujuan berlaku untuk satu milestone. Task normal dalam scope tersebut
tidak membutuhkan persetujuan ulang. Milestone berikutnya tidak dimulai otomatis.
Simulation MVP ditargetkan pada M6, RL proof of concept M8, dashboard riset M10,
Paper M11, Demo M13, dan kemampuan Real M15.

Real Trading harus disabled by default. Persetujuan implementasi fitur Real bukan
izin transaksi dana asli. Tidak ada jaminan profit atau promosi model otomatis.

Komponen setelah foundation/configuration/market data tetap rancangan masa depan.
