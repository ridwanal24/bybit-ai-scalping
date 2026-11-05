# Operasi foundation lokal

Target implementasi M1: Windows x64/PowerShell, satu mesin CPU. Belum ada UI,
market data, simulator, training, order atau deployment model.

## Setup

Dari root repository, Python pada PATH diperlukan untuk unduhan awal portable
runtime. Perintah menggunakan argument array tanpa shell pada subprocess. Download
memerlukan internet; npm/uv registry dan sumber runtime harus dapat diakses.

```powershell
python scripts/bootstrap.py
.\.tools\node\node.exe scripts/tasks.mjs setup
```

Setelah bootstrap, root commands melalui npm global juga meneruskan task ke Node
proyek. Bila PowerShell memblokir npm.ps1, gunakan `npm.cmd` atau executable lokal:

```powershell
.\.tools\node\npm.cmd run setup
.\.tools\node\npm.cmd run db:status
.\.tools\node\npm.cmd run dev:api
```

Setup memakai `npm ci` jika lockfile tersedia; Python memakai `uv sync --locked`.
Approval install scripts npm dibatasi tiga package/version yang dicatat pada root
package.json, bukan mengizinkan semua script dependency. Setup membuat `.env`
hanya bila belum ada, start cluster portable loopback, generate Prisma Client dan
apply migration. Setup tidak menghentikan DB development setelah selesai.

`dev:api` membangun TypeScript lalu memantau perubahan output `dist`; setelah
mengubah source, jalankan `npm run build` pada terminal lain. Ini belum compiler
watch hot reload. Hentikan API foreground dengan Ctrl+C.

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health/live
Invoke-RestMethod http://127.0.0.1:3000/health/ready
```

Liveness hanya memastikan proses HTTP hidup; readiness memeriksa akses metadata
schema versi 1 melalui Prisma/PostgreSQL. Jangan menggunakan liveness sebagai
bukti database siap. Production startup failures dicetak sebagai event tersanitasi.

## Verification

```powershell
.\.tools\node\npm.cmd run verify:foundation
```

Urutan: Prisma generate, build, typecheck, lint/format, unit JS/Python, cluster
integration baru, migration apply dua kali, DB/HTTP tests, built API health,
Python subprocess dan cleanup proses test. Kegagalan atau prerequisite hilang
menghasilkan exit code nonzero. Report lokal `.runtime/foundation-report.json`
menyimpan hasil terakhir, bukan riwayat audit deployment.

Command terpisah: `npm test`, `npm run test:integration`, `npm run build`,
`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run db:migrate`.
Integration tidak boleh dijalankan langsung ke DB development: guard memerlukan
URL database test yang dibuat runner pada port test. Tidak ada Bybit network test.

## Shutdown dan recovery

```powershell
.\.tools\node\npm.cmd run db:stop
.\.tools\node\npm.cmd run db:start
```

Helper hanya menghentikan cluster dengan marker workspace, data directory,
postmaster port dan executable identity yang sesuai. Jika marker/PID mismatch,
jangan menghapus file PID atau memaksa kill server. Periksa log lokal dan proses
yang memiliki port, lalu selesaikan ownership dahulu.

Jika setup terputus sebelum initdb selesai, helper menolak overwrite data directory
yang parsial. Simpan directory untuk diagnosis dan gunakan cluster baru setelah
review; tidak ada recursive delete otomatis. Cluster test dipertahankan setelah
stop untuk diagnosis, sehingga disk usage bertambah per verification.

Migration deploy hanya menjalankan migration versioned yang belum diterapkan.
M1 tidak menyediakan destructive rollback. Sebelum perubahan schema pada data
penting, ambil backup DB yang sesuai dan buat recovery plan milestone tersebut.
Backup/restore dan credential hardening sebelum trading tetap gate masa depan;
belum diklaim teruji pada foundation.

Jika bootstrap/server/bind port dibatasi sandbox, gunakan mekanisme approval
environment untuk command yang diperlukan. Jangan mengganti hasil integration
dengan mock atau menandai milestone Completed sebelum verification wajib lulus.
