# Operasi foundation dan configuration lokal

Target implementasi: Windows x64/PowerShell, satu mesin CPU. Belum ada UI,
simulator, training, order atau deployment model.
M2 menambahkan research configuration API; tidak membutuhkan server baru.
M3 menambahkan public historical ingestion dan CLI download/export; lihat
[market-data](market-data.md) untuk request, resume, quality/source caveats dan limits.
M4 menambahkan offline Python features/normalizer/observation CLI dan verified
artifacts. [Features](features.md) memuat commands fit/build, context JSONL dan
optional source snapshot untuk config variant; command tidak memakai network/DB.

`npm run verify:features` menjalankan verification stack M1–M4. Python fixture
temporary directory unik berada di `.runtime/pytest/<timestamp>_<pid>` agar tidak
bergantung pada ownership folder temp Windows antar SID. Cluster PostgreSQL
regression tetap terisolasi di55433 dan dihentikan setelah run; tidak ada migration M4.

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

## Menggunakan configuration API

Setelah update source M2, jalankan build dan `npm run db:migrate` pada DB proyek,
lalu `npm run dev:api`. Jangan menghapus/mereset data M1: migration baru additive.
Readiness M2 memerlukan foundation_schema_version=1 dan configuration_schema_version=1.

Contoh PowerShell berikut membuat draft dan snapshot pada DB development ketika
dijalankan pengguna; ini bukan command aktivasi trading:

```powershell
$apiBase = 'http://127.0.0.1:3000'
$preset = (Invoke-RestMethod "$apiBase/configuration-presets").items[0]
$payload = $preset.configuration
Invoke-RestMethod "$apiBase/configurations/validate" -Method Post -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 30)
$draftBody = @{ name = 'Penelitian pertama'; configuration = $payload } | ConvertTo-Json -Depth 30
$draft = Invoke-RestMethod "$apiBase/configurations" -Method Post -ContentType 'application/json' -Body $draftBody
$snapshotBody = @{ expectedRevision = $draft.revision } | ConvertTo-Json
$snapshot = Invoke-RestMethod "$apiBase/configurations/$($draft.id)/snapshots" -Method Post -ContentType 'application/json' -Body $snapshotBody
Invoke-RestMethod "$apiBase/configuration-snapshots/$($snapshot.id)"
```

Untuk PUT draft, kirim {name,configuration,expectedRevision} lengkap; ambil revision
terbaru setelah 409 lalu review perubahan sebelum retry. Jangan silent overwrite.
Daftar: GET /configurations?limit=20&offset=0 (limit1–100, offset0–1000000).
Compare: POST /configurations/compatibility dengan {referenceSnapshotId,candidate}.
Invalid input 400, missing record404, stale/integrity409, storage unavailable503.

## Contract maintenance dan verification M2

```powershell
.\.tools\node\npm.cmd run contracts:export
.\.tools\node\npm.cmd run verify:configuration
```

`contracts:export` diperlukan hanya setelah sengaja mengubah contract source;
commit schema/preset/fixtures hasil export bersama source-nya. Build biasa
mengecek drift dan tidak meregenerasi artifact diam-diam. `npm test` mencakup
contracts/backend/Python; Python fixture test membutuhkan schema export tracked.

Configuration verification mencakup foundation regressions, contract export drift,
structural/canonical Python tests, additive upgrade dari M1 dengan sentinel data
yang dipertahankan, Prisma schema diff, API workflow, snapshot DML guards dan
concurrency. Cluster test tetap terpisah dari dev; report lokal berada di
`.runtime/configuration-report.json`. Command verify:foundation juga menjalankan
seluruh regression yang tersedia saat ini, bukan hanya daftar test historis M1.

## Operasi market data M3

```powershell
.\.tools\node\npm.cmd run verify:market-data
.\.tools\node\npm.cmd run data:download -- --id UUID_DOWNLOAD
.\.tools\node\npm.cmd run data:export -- --dataset UUID_DATASET
```

Create request melalui POST /market-data/downloads, lalu jalankan CLI dengan ID
yang diterima. PAUSED karena budget dapat dilanjutkan dengan ID sama; FAILED
karena permanent invalid source memerlukan diagnosis/new request. Crash worker
menunggu lease expiry120 detik sebelum takeover; worker stale tidak dapat commit.

`smoke:bybit-data` adalah explicit network command terpisah; default24 jam
BTCUSDT2025-01-01 UTC dalam preset snapshot, bukan latest rolling24h atau full-year.
Command ini membuat research config/snapshot dan dataset pada dev DB proyek dan
menyimpan export ignored. Tidak memakai credentials/API order. Hasil aktual dan
dataset ID ada pada [handoff M3](handoffs/milestone-03.md).

M3 readiness memerlukan ketiga schema markers. Migration baru additive; jangan
mengedit migration lama atau reset DB untuk update. Development DB tetap running
pada55432; test cluster55433 dihentikan verification. Shutdown timeout helper
60 detik mengakomodasi disk checkpoint beberapa upgrade DB di Windows; tidak
force-kill proses pengguna. Dataset exports/test clusters bukan source control;
hapus hanya setelah review path/ownership dan kebutuhan reproducibility.
