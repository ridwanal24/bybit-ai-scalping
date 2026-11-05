# Bybit AI Scalping

Platform penelitian dan automated trading Bybit berbasis NestJS, React, Python,
PostgreSQL, dan MaskablePPO. Sumber requirement: [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Status aktual

Per 5 November 2026 (Asia/Jakarta), **M1 — Project Foundation Completed**.
Backend NestJS, PostgreSQL/Prisma, Python package, environment validation,
health/readiness, migration dan foundation verification sudah berjalan.
M0 diterima pengguna; implementasi M1 disetujui melalui `lakukan`.

Belum ada frontend, data Bybit, simulator, training/model atau trading execution.
M2 — Configuration System belum disetujui dan tidak dimulai otomatis.

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
.\.tools\node\npm.cmd run db:status
.\.tools\node\npm.cmd run db:stop
```

Verification lulus: 16 unit backend, 2 Python, 4 integration, built API/Python
smoke, migration apply/reapply, build/typecheck/lint/format. Evidence dan batas
verifikasi: [testing](docs/testing.md).

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
| [Handoff M0](docs/handoffs/milestone-00.md) | Hasil, keterbatasan dan instruksi sesi berikutnya |

## Alur pengembangan

Satu persetujuan berlaku untuk satu milestone. Task normal dalam scope tersebut
tidak membutuhkan persetujuan ulang. Milestone berikutnya tidak dimulai otomatis.
Simulation MVP ditargetkan pada M6, RL proof of concept M8, dashboard riset M10,
Paper M11, Demo M13, dan kemampuan Real M15.

Real Trading harus disabled by default. Persetujuan implementasi fitur Real bukan
izin transaksi dana asli. Tidak ada jaminan profit atau promosi model otomatis.

Komponen setelah foundation dalam dokumen arsitektur tetap rancangan masa depan.
