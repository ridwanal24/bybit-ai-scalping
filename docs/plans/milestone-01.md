# Milestone Implementation Plan — M1 Project Foundation

Tanggal: 5 November 2026, Asia/Jakarta.
Approval status: **Approved** melalui pesan `lakukan` setelah plan M1 disajikan.
Execution status: **Completed**; hasil aktual pada [handoff M1](../handoffs/milestone-01.md).
Instruksi sebelumnya `oke lanjutkan` memulai penyusunan rencana. Tidak ada kode
atau dependency diinstal ketika menyusun rencana; implementasi dimulai setelah
persetujuan `lakukan`.

## Current Project State

M0 Completed dan hasil planning diterima melalui `oke ku approve`. Baseline Git
saat pemeriksaan: `42f8dc8`, working tree bersih. Repository berisi spesifikasi
dan dokumentasi; aplikasi/database/test suite belum tersedia. Semua hasil test
yang sudah dicatat adalah pemeriksaan dokumen M0, bukan foundation tests.

Preflight read-only pada mesin Windows/PowerShell:

| Item | Hasil aktual |
| --- | --- |
| Node.js / npm | v26.13.0 / 11.20.0 |
| Python pada PATH | 3.15.2; `py -0p` tidak menemukan interpreter terdaftar |
| Docker / psql | Tidak ditemukan pada PATH; executable Docker dan folder PostgreSQL pada lokasi Program Files umum juga tidak ditemukan |
| CPU / RAM | 8 logical CPU / sekitar 16 GiB, melalui Node os API |
| Disk workspace | Sekitar 213 GiB tersedia, melalui Node statfs |

Inventaris bukan bukti tidak ada instalasi pada lokasi lain. Query hardware CIM
ditolak oleh environment; hasil resource di atas memakai API Node sebagai
fallback. Nilai Free dari provider PowerShell tidak dipakai sebagai bukti disk
penuh. Tidak membaca secret atau credentials akun.

## Objectives

Backend NestJS, Python package dan PostgreSQL lokal dapat dijalankan ulang dari
setup terdokumentasi. Foundation memiliki validasi environment, migration yang
versioned, health/readiness, tests dan satu verification command end-to-end.

## Scope dan Out of Scope

Scope mencakup seluruh task 1.1–1.14. Tidak mengubah history Git yang sudah ada.
Menyiapkan tooling lokal, manifest/lockfile, backend minimal, DB lifecycle,
Python package minimal, tests, commands serta dokumentasi operasional foundation.

Trading configuration/domain schema M2, data Bybit, shared trading schemas,
simulator, job orchestration, RL dependencies/training, frontend, exchange
credentials dan transaksi berada di luar scope. Tidak menambah broker/cloud/GPU.
Tidak melakukan global runtime replacement, Windows service installation,
perubahan PATH permanen atau penghapusan data existing.

## Dependencies dan versi usulan

| Komponen | Pilihan untuk implementasi |
| --- | --- |
| Runtime Node | Node 24.x, minimal 24.15 untuk floor CLI Nest yang didokumentasikan; patch resmi yang kompatibel dipin saat bootstrap |
| Backend | NestJS 12.x, Express adapter, TypeScript 5.9.x, ESM/NodeNext |
| ORM/database driver | Prisma 7.x + `@prisma/adapter-pg` + `pg`; Prisma CLI/client/adapter satu versi kompatibel |
| Config | `@nestjs/config`, Zod untuk runtime environment; tidak membuat config trading M2 |
| Tests JS | Vitest, Supertest, `@nestjs/testing`; transform yang mempertahankan decorator metadata untuk DI Nest |
| Quality JS | ESLint + typescript-eslint, Prettier; strict TypeScript |
| Runtime Python | CPython 3.12.x terisolasi, dikelola uv; tidak mengganti Python 3.15 global |
| Python tooling | uv, pyproject/uv.lock, pytest, Ruff; package src layout |
| Database | PostgreSQL 17.x patch resmi yang masih didukung, binary Windows dari distribusi yang ditautkan PostgreSQL |

Exact patches, engines/peer constraints dan artifact hashes dipastikan sebelum
install, dicatat dalam lockfile/runtime manifest dan ADR. Nomor major di atas
adalah batas pilihan plan, bukan klaim sudah lolos tests di mesin ini. Perubahan
patch/minor yang compatible dalam jalur tersebut termasuk scope M1; penggantian
ORM/runtime major atau arsitektur secara material memerlukan review ulang.

Alasan Node 24: dokumentasi Prisma 7 yang diperiksa menyebut jalur 20/22/24;
runtime global Node 26 belum dianggap tervalidasi untuk stack ini. Python 3.12
dipilih konservatif sebagai fondasi quant; compatibility stack RL tetap diverifikasi
ketika diperkenalkan M7/M8. Tidak memasang PyTorch pada M1.

## Proposed Architecture

Root npm workspace mengelola `apps/api`. Python tetap proyek tersendiri pada
`services/quant`. Script Node/PowerShell mengoordinasikan setup dan verification
lintas proses. Runtime yang belum ada disimpan di `.tools/` dan cache download
lokal; runtime data/log DB pada `.runtime/`. Semua di-ignore Git.

Bootstrap mengambil Node portable resmi, uv dan Python managed serta PostgreSQL
binary resmi/distribusi yang dirujuk upstream; pin versi, verifikasi checksum
upstream bila tersedia dan simpan provenance/checksum. Tidak menjalankan script
remote melalui pipe ke shell. uv cache/Python install/bin directories diarahkan
ke workspace; tidak mengubah konfigurasi akun global.

Default database memakai proses PostgreSQL project-local, bukan Docker karena
Docker belum terdeteksi. `initdb` hanya pada cluster baru yang dibuat project ini;
cluster existing tidak ditimpa. Proses background tersembunyi, log ke file,
port loopback configurable (default 55432), password auth SCRAM. DB development
dan integration test terpisah. Helper memeriksa ownership/path/PID sebelum stop;
tidak mematikan server pengguna atau menghapus volume. Tidak menginstal service.
Compose bukan dependency M1; DATABASE_URL boleh menunjuk DB PostgreSQL existing
yang secara eksplisit disediakan untuk proyek.

`ConfigModule` memvalidasi NODE_ENV, HOST, PORT, DATABASE_URL, database timeout dan
path Python. Default HOST 127.0.0.1. Port/range/protocol invalid ditolak sebelum
startup. Log/error tidak memuat database password atau raw connection URL.
`.env.example` tidak mengandung secret; file `.env` lokal tidak di-commit.

Endpoint:

- `GET /health/live`: 200 jika proses API hidup, tidak mengklaim DB sehat.
- `GET /health/ready`: query DB berbatas waktu dan cek metadata migration;
  200 bila siap, 503 bila DB unavailable/schema belum siap. Respons error publik
  berupa status terstruktur yang sudah disanitasi, tanpa connection detail.

Python menyediakan package importable dan command health lokal yang menghasilkan
JSON versi/runtime/status. Ini bukan job worker protocol atau layanan inference.
API M1 tidak menjalankan worker/training; integration runner menguji Python
sebagai subprocess agar fondasi lintas bahasa dapat diverifikasi.

## Task Breakdown dan Files Expected

| Task | Implementasi | File utama yang diperkirakan |
| --- | --- | --- |
| 1.1 Repository initialization | npm workspace, ignores, editor defaults; pertahankan Git history | `package.json`, `package-lock.json`, `.gitignore`, `.editorconfig`, runtime manifest |
| 1.2 NestJS setup | Bootstrap API dan AppModule, graceful shutdown, loopback binding | `apps/api/package.json`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts` |
| 1.3 TypeScript setup | Strict ESM/NodeNext dan build config | `apps/api/tsconfig*.json` |
| 1.4 Linting/formatting | ESLint/Prettier; Ruff Python | `eslint.config.*`, `.prettier*`, Python pyproject |
| 1.5 Environment config | Fail-fast schema dan contoh config terpisah development/test | `.env.example`, `apps/api/src/config/*` |
| 1.6 PostgreSQL setup | Bootstrap/start/stop/status cluster milik proyek | `scripts/bootstrap.*`, `scripts/db.*`, runtime manifest |
| 1.7 ORM setup | Prisma generation, driver adapter, lifecycle provider | `apps/api/prisma.config.ts`, `apps/api/src/database/*` |
| 1.8 Database migrations | Metadata foundation minimal, generate/apply/reapply verification | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*` |
| 1.9 Health check | Liveness dan readiness nyata, timeout/sanitized errors | `apps/api/src/health/*` |
| 1.10 Backend tests | Config validation, health behavior dan DB integration | `apps/api/test/*`, `apps/api/vitest.config.*` |
| 1.11 Python environment | uv-managed Python 3.12 + package src layout | `services/quant/pyproject.toml`, `uv.lock`, `.python-version`, `src/bybit_quant/*` |
| 1.12 Python tests | Package CLI/JSON dan error exit behavior | `services/quant/tests/*` |
| 1.13 Local development commands | Setup/build/lint/test/db/dev/verify commands | `scripts/*`, root/API manifests, README, `docs/configuration.md`, `docs/operations.md` |
| 1.14 Foundation integration | Fresh test DB migration, API HTTP readiness, Python subprocess, failure cleanup | `scripts/verify-foundation.*`, `tests/integration/*` |

Update `docs/architecture.md`, `decisions.md`, `testing.md`, `roadmap.md`,
`progress.md`, README dan buat `docs/handoffs/milestone-01.md` setelah implementasi.
Script extension boleh `.mjs`/`.ps1` sesuai kebutuhan quoting dan cross-platform;
struktur fungsi/file boleh disederhanakan tanpa mengubah task/acceptance.

## Database Changes

Satu migration awal membuat metadata teknis foundation (`app_metadata`, key/value
dan timestamp), dengan marker versi schema untuk readiness. Tidak membuat tabel
configuration/market/trading sebelum milestone pemiliknya. Ini bukan tabel dummy
untuk mengaku DB terhubung; readiness memeriksa marker migration aktual.

Migration diterapkan pada DB proyek baru, diuji apply dari kosong dan reapply
idempotent melalui migration runner. Integration memakai DB khusus dengan guard
nama/namespace agar tidak menyentuh development/DB lain. Tidak menjalankan reset,
drop schema atau rollback destruktif pada DB existing. Jika migration perlu ubah
data existing yang penting, berhenti pada bagian terdampak dan ajukan keputusan.

## Tests dan verification command

Command yang akan disediakan (belum tersedia saat plan ini disusun):

| Command root | Tujuan |
| --- | --- |
| `npm run setup` | Bootstrap lokal, install locked dependency, Python env, persiapan env/DB baru |
| `npm run db:start` / `db:stop` / `db:status` | Lifecycle PostgreSQL milik proyek |
| `npm run db:migrate` | Apply versioned migration |
| `npm run dev:api` | API development |
| `npm run build` / `typecheck` / `lint` / `format:check` | Static/build verification |
| `npm test` | Unit JS + Python, tidak memerlukan Bybit |
| `npm run test:integration` | DB migration/transaction/API tests nyata |
| `npm run verify:foundation` | Orchestration foundation end-to-end dan report exit code |

Unit scenarios: missing/invalid env, invalid ports/URL, readiness DB failure/timeout,
sanitized error response, Python health CLI parse dan exit code. Integration:
migration dari test DB kosong, reapply tanpa duplicate metadata, Prisma transaction
read/write/rollback, HTTP live/ready, DB unavailable menjadi 503 dalam timeout,
Python subprocess output valid, API/proses yang dimulai runner berhenti bersih.
Gunakan injection/fault test untuk kegagalan DB tanpa menghentikan DB pengguna.

Gunakan instance/port test tersendiri; jangan memaksa terminate proses lain bila
port bentrok. Command verification harus fail bila DB test dilewati atau test gagal,
bukan melaporkan Completed dengan mock sebagai pengganti integration. Save report
command/versions/results di testing dan handoff. Tidak ada regression suite lama
aplikasi; unit/integration foundation akan menjadi baseline regression berikutnya.

## Acceptance Criteria

1. Backend build dan startup berhasil dengan runtime yang dipin.
2. Python environment terisolasi, package import dan CLI health berhasil.
3. PostgreSQL nyata dapat dijangkau Prisma; migration dari kosong dan reapply lulus.
4. Liveness 200; readiness 200 ketika DB/schema valid dan 503 saat dependency gagal.
5. Unit JS/Python, integration, lint/typecheck/build dan foundation verification
   lulus; command gagal memberi exit code nonzero bila prerequisite/test gagal.
6. Setup/running/shutdown/test didokumentasikan dan diuji di mesin ini.
7. Tidak ada secret atau runtime artifact di Git; setup tidak menimpa runtime/data
   global; progress/roadmap/ADR dan handoff mencerminkan bukti aktual.

## Risks & Tradeoffs

- Portable runtime menambah unduhan dan bootstrap maintenance, tetapi menjaga
  instalasi global. Network download/eksekusi binary atau bind local port mungkin
  dibatasi environment; bila terblokir, selesaikan bagian independen dan laporkan
  blocker. Tidak mengklaim integration lulus tanpa DB.
- ESM, decorator metadata, Prisma adapter dan test transforms harus cocok. Exact
  versions/metadata DI diuji sebelum memperluas scaffolding; bukan alasan
  mengganti ORM diam-diam.
- RAM 16 GiB cukup sebagai target foundation ringan; concurrency test dibatasi.
  Kelayakan training CPU/timesteps/RAM baru dinilai M8, bukan disimpulkan dari M1.
- PostgreSQL portable memerlukan library runtime Windows yang kompatibel. Jika
  distribusi tidak berjalan tanpa perubahan mesin, bagian DB menjadi blocker;
  tidak memasang system dependency global tanpa menjelaskan kebutuhan tersebut.
- Setup development password adalah secret lokal generated, tidak credential
  Bybit; hanya loopback. Kontrol akses dashboard remote bukan scope M1.

## Referensi resmi untuk pilihan tooling

Diperiksa 5 November 2026; patch registry/provenance dicek lagi saat implementasi.

- [Nest migration/requirements](https://docs.nestjs.com/migration-guide): floor CLI,
  ESM dan test stack; plan memilih ESM dengan Vitest.
- [Prisma system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements)
  dan [Prisma 7 guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7):
  Node supported lines, ESM dan driver adapter.
- [PostgreSQL Windows](https://www.postgresql.org/download/windows/) dan
  [version policy](https://www.postgresql.org/support/versioning/): sumber distribusi
  dan pemilihan major yang masih didukung.
- [uv Python management](https://docs.astral.sh/uv/guides/install-python/): Python
  managed, versi terisolasi dan install directories.

## Approval Status

**Approved** melalui `lakukan`. Seluruh task M1 boleh dikerjakan tanpa ACC per task
selama masih dalam scope. M2 tidak dimulai otomatis.
