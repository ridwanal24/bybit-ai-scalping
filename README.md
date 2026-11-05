# Bybit AI Scalping

Platform penelitian dan automated trading Bybit berbasis NestJS, React, Python,
PostgreSQL, dan MaskablePPO. Sumber requirement: [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Status aktual

Per 5 November 2026 (Asia/Jakarta), **M2 — Configuration System Completed**.
Foundation M1 tetap tersedia. API kini memvalidasi, menyimpan dan merevisi research
configuration, membuat snapshot immutable, menyediakan preset berversi dan
configuration compatibility report. Implementasi M2 disetujui melalui `gw approve`.

Belum ada frontend, data Bybit, simulator, training/model atau trading execution.
M3 — Bybit Market Data belum disetujui dan tidak dimulai otomatis.

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
.\.tools\node\npm.cmd run db:status
.\.tools\node\npm.cmd run db:stop
```

Verification M2 lulus: 52 contract tests, 16 unit backend, 4 Python, 14 integration,
built API/Python smoke, fresh/reapply/upgrade M1 migrations dan zero Prisma schema
diff, build/typecheck/lint/format. Evidence: [testing](docs/testing.md).

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
| [Handoff M0](docs/handoffs/milestone-00.md) | Hasil, keterbatasan dan instruksi sesi berikutnya |

## Alur pengembangan

Satu persetujuan berlaku untuk satu milestone. Task normal dalam scope tersebut
tidak membutuhkan persetujuan ulang. Milestone berikutnya tidak dimulai otomatis.
Simulation MVP ditargetkan pada M6, RL proof of concept M8, dashboard riset M10,
Paper M11, Demo M13, dan kemampuan Real M15.

Real Trading harus disabled by default. Persetujuan implementasi fitur Real bukan
izin transaksi dana asli. Tidak ada jaminan profit atau promosi model otomatis.

Komponen setelah foundation/configuration tetap rancangan masa depan.
