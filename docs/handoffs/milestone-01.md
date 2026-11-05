# Milestone 1 — Project Foundation: implementation report dan handoff

Tanggal: 5 November 2026, Asia/Jakarta. Final status: **Completed**.
Approval: pengguna memberi `lakukan` setelah [plan M1](../plans/milestone-01.md)
disajikan. Scope task 1.1–1.14; M2 dan transaksi bukan bagian approval.

## Implemented features dan cara kerja

Npm workspace berisi NestJS API ESM dengan runtime config tervalidasi,
Prisma/PostgreSQL provider, liveness dan readiness. Readiness memeriksa metadata
schema version 1 melalui database nyata, dengan timeout/error tersanitasi.
Liveness tidak bergantung DB. Python isolated src package menyediakan health JSON.

Bootstrap mengambil runtime portable yang dipin ke `.tools`, tanpa mengganti
global runtime/service/PATH. Setup menginstal locked dependencies, menyiapkan
Python env, cluster DB lokal dengan generated password, generate Prisma Client
dan apply migration. Root runner mengoordinasikan build/tests/DB/verification.
PostgreSQL Laragon 14.5 yang ditemukan di mesin tidak dipakai atau dihentikan.

## Completed tasks dan files created/modified

| Task | Hasil dan file utama |
| --- | --- |
| 1.1 Repository initialization | Git history dipertahankan; root package/lock, .gitignore/.gitattributes/.editorconfig |
| 1.2 NestJS setup | apps/api/package.json, src/main.ts, application.ts, app.module.ts |
| 1.3 TypeScript setup | apps/api/tsconfig.json dan tsconfig.build.json; strict ESM/NodeNext |
| 1.4 Linting/formatting | eslint.config.mjs, .prettier*, Python Ruff config |
| 1.5 Environment configuration | .env.example dan src/config/environment.ts; ignored .env lokal |
| 1.6 PostgreSQL setup | scripts/bootstrap.py, database.mjs, toolchain.json; local cluster dengan ownership guards |
| 1.7 ORM setup | prisma.config.ts, schema.prisma, src/database/database.service.ts, generated client ignored |
| 1.8 Database migrations | prisma/migrations/202611050001_foundation/migration.sql dan migration_lock.toml |
| 1.9 Health check | src/health/health.controller.ts dan health.service.ts |
| 1.10 Backend tests | test/environment.spec.ts, health.spec.ts; Vitest/SWC configs |
| 1.11 Python environment | services/quant/pyproject.toml, uv.lock, .python-version, src/bybit_quant |
| 1.12 Python tests | services/quant/tests/test_health.py |
| 1.13 Local development commands | scripts/common.mjs/tasks.mjs; README, configuration dan operations docs |
| 1.14 Foundation integration | test/foundation.integration.ts, tasks.mjs E2E/cleanup/report |

Task tersisa: tidak ada dalam scope wajib M1. Folder/file tests sedikit
disederhanakan dari contoh plan: integration cases berada di API test folder dan
root runner, bukan folder tests/integration kosong. Worker/trading/schema domain
future milestone tidak dibuat.

## Dependency dan perubahan kontrak

Node 24.22.2, uv 0.13.7, CPython 3.12.12, PostgreSQL 17.10-1 dipin pada
toolchain.json. NestJS 12.3.3, TypeScript 5.9.3, Prisma/client/adapter 7.10.1,
Vitest 5.1.0, Zod 4.6.7, pg 8.23.1 dan dev tooling di package-lock.json.
Python runtime tidak memiliki dependency bisnis; pytest 9.2.0/Ruff 0.17.3 dan
transitive dependencies dipin uv.lock. Install scripts npm hanya diizinkan untuk
versi @swc/core, prisma dan @prisma/engines yang tercatat di package.json.

API baru: GET /health/live (200), GET /health/ready (200 atau 503).
Python CLI: `python -m bybit_quant health` → JSON status/service/version/python.
Tidak ada kontrak trading atau job protocol yang diimplementasikan.

## Database migrations

Satu migration menciptakan `app_metadata(key, value, created_at)` dan marker
foundation_schema_version=1. `_prisma_migrations` dikelola Prisma. Apply pada DB
kosong dan reapply diuji; tidak ada reset/drop atau tabel domain M2.
Development DB memakai loopback 55432; test cluster terpisah port 55433 dengan
nama bybit_test_* dan guard sebelum tests. Script stop memverifikasi marker,
data/PID/port dan executable identity; tidak mematikan DB lain.

## Tests executed dan acceptance verification

Final command: `.tools/node/npm.cmd run verify:foundation`, exit 0, PASSED.
UTC 2026-11-05T13:10:38.335Z–13:11:27.095Z (WIB 20:10:38–20:11:27).

| Acceptance M1 | Bukti aktual | Status |
| --- | --- | --- |
| Backend berjalan | tsc build/typecheck dan built-process HTTP smoke | Terpenuhi |
| Python berjalan | isolated package CLI, 2 pytest dan subprocess root smoke | Terpenuhi |
| Database connectivity | PostgreSQL 17 nyata, migration/reapply, ORM read/write/rollback | Terpenuhi |
| Health check | live 200; ready 503 sebelum migration lalu 200; wrong marker/unreachable DB 503 | Terpenuhi |
| Test command berfungsi | 16 unit backend + 2 Python + 4 integration, semua lulus; invalid startup nonzero | Terpenuhi |
| Setup terdokumentasi | Setup exit 0, lifecycle stop/status/start/migrate exit 0; README/configuration/operations | Terpenuhi |
| Plan checks/documents | ESLint API/scripts, Ruff/format, Prettier lulus; locks, ignored secrets, progress/ADR/handoff | Terpenuhi |

Unit tests tidak memerlukan Bybit. Integration/built API memakai DB nyata; fake
dependency hanya untuk unit timeout/error. Native SWC dan socket sandbox memerlukan
eskalasi execution context pemilik workspace; final verification lulus tanpa skip.
Cluster test dan smoke API dihentikan; dev DB tetap running. Tidak ada frontend,
training, Demo/Real tests atau profit claims. Detail evidence: [testing](../testing.md).

## Known issues dan technical debt

- Bootstrap portable baru Windows x64. Paths mengandung spasi sudah teruji.
- Dev command memantau dist; source changes perlu `npm run build` terpisah.
- Runtime cached files memiliki ACL execution context pembuat; sandbox SID lain
  mungkin gagal native cache/write. Tidak mengubah ACL/profil user global.
- Test cluster stopped disimpan untuk diagnosis; belum ada otomatisasi purge.
- DB role adalah bootstrap developer lokal, bukan least-privilege produksi.
- Restore backup, authentication remote, worker/inference, RL compatibility dan
  trading safety tetap milestone berikutnya. Tidak ada blocker foundation terbuka.
- PostgreSQL initial archive digest dihitung lokal atas HTTPS EDB, lalu dipin;
  Node/uv memakai checksum upstream. Provenance lokal `.tools/provenance.json`.

## Menjalankan dan menghentikan

Dari root Windows PowerShell:

```powershell
python scripts/bootstrap.py
.\.tools\node\node.exe scripts/tasks.mjs setup
.\.tools\node\npm.cmd run dev:api
```

API default 127.0.0.1:3000; live/ready routes di atas. Ctrl+C menghentikan API.
`npm run db:stop` menghentikan hanya DB proyek. `npm run db:start` mengaktifkan lagi.
`npm run verify:foundation` menjalankan full checks; jalankan npm.cmd bila npm.ps1
diblokir PowerShell. Setup/verification memerlukan akses network/port yang sesuai.

## Documentation updated dan sesi berikutnya

README, architecture, decisions (ADR-09), roadmap, progress, testing, approved plan,
configuration, operations dan handoff ini disinkronkan. PROJECT_SPEC.md tidak diubah.
Tidak ada commit atau push yang dilakukan agent.

Next milestone: **M2 — Configuration System**, informasi saja. Pada sesi berikutnya,
baca spec/progress/roadmap/architecture/decisions/handoff ini, periksa Git dan test
summary. Siapkan implementation plan M2 dan approval scope sebelum implementasi.
Jangan meminta approval ulang untuk pekerjaan M1 yang sudah diizinkan; jangan
memperluasnya menjadi M2 atau izin credentials/order.

**Waiting for Next Milestone Instruction.**
