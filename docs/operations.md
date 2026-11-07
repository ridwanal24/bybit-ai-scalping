# Operasi lokal

## Advanced evaluation M9

`npm run evaluation:register -- --request FILE` menerbitkan immutable protocol;
`npm run evaluation:run -- --protocol SHA` menjalankan bounded experiment matrix.
`npm run evaluation:report -- --report SHA` memverifikasi report dan references.
`npm run verify:evaluation` menjalankan full regression dengan report
`.runtime/evaluation-report.json`. Explicit public-data smoke:
`services/quant/.venv/Scripts/python.exe services/quant/tests/smoke_evaluation.py`.
Smoke memakai existing M3 export/M8 candidate; 11 training384steps, 35 rows,
6 baseline comparisons dan cache rerun. Tidak mengunduh candles atau membuka
holdout. Format request/CLI freeze/once-only policy: [evaluation](evaluation.md).
Arsipkan reports bersama protocols/models/simulations/baselines/reviews dan
holdout registry. Jangan hapus consumed markers untuk mengulang final holdout.

## CPU training/background jobs M8

`npm run training:submit -- --request FILE` membekukan input dan mengembalikan
UUID job. Pantau `npm run training:status -- --job UUID`; cancel melalui
`npm run training:cancel -- --job UUID`. Persistent state/progress/log/checkpoint
di `artifacts/training-jobs/<uuid>/`; successful candidate di `artifacts/models/<id>/`.
No HTTP/DB training job API M8. [Request, limits dan recovery](training.md).
`npm run verify:training` menjalankan full regression, report
`.runtime/training-report.json`. Explicit pre-registered1024-step CPU smoke:
`services/quant/.venv/Scripts/python.exe services/quant/tests/smoke_training.py`.
Helper menjalankan dua sequential jobs, bukan full training/holdout evaluation.
Gunakan `uv sync --locked` untuk pinned CPU stack, tanpa upgrade global Python.
Archive model membawa validation ledger sendiri; archive job jika logs/checkpoints
dibutuhkan. Source/runtime/config changes dapat reject load dan butuh review.

## RL environment offline M7

`npm run environment:run -- --request FILE` menjalankan fixed HOLD atau
masked-random episode, bukan training. Request/CLI/artifacts:
[RL environment](rl-environment.md). Output `artifacts/environments/<id>/` harus
diarsipkan bersama linked `artifacts/simulations/<id>/`.
`npm run verify:environment` menjalankan full regression dengan report
`.runtime/environment-report.json`. Bounded public smoke helper:
`services/quant/.venv/Scripts/python.exe services/quant/tests/smoke_environment.py`.
Dependency sync memakai existing project uv dan `--locked`; NumPy/Gymnasium
berada pada venv proyek. Learner M8 sudah memakai adapter berikut:
gunakan SettledEpisodeWrapper/bootstrap0 dan reject `report.status=invalid`.

## Baseline offline M6

`npm run baseline:run -- --request FILE` membaca strict baseline request dan
menerbitkan comparison beserta action scripts di `artifacts/baselines/<id>/`,
dengan linked immutable ledgers di `artifacts/simulations/<id>/`. Tidak memakai
DB/network/credentials. Exit0=restricted valid, exit2=contains invalid diagnostics,
exit1=input/artifact incompatible; lihat [baselines](baselines.md).
`npm run verify:baselines` menjalankan full static/unit/Python/isolated DB regression
dan menulis `.runtime/baselines-report.json`. Explicit local public-export smoke:
`services/quant/.venv/Scripts/python.exe services/quant/tests/smoke_baselines.py`.
Tidak otomatis download/refit bila artifact asal tidak tersedia. Simpan linked
simulation artifacts bersama comparison saat backup; hash bukan signature.

Target implementasi: Windows x64/PowerShell, satu mesin CPU. Belum ada UI,
training, order exchange atau deployment model.
M2 menambahkan research configuration API; tidak membutuhkan server baru.
M3 menambahkan public historical ingestion dan CLI download/export; lihat
[market-data](market-data.md) untuk request, resume, quality/source caveats dan limits.
M4 menambahkan offline Python features/normalizer/observation CLI dan verified
artifacts. [Features](features.md) memuat commands fit/build, context JSONL dan
optional source snapshot untuk config variant; command tidak memakai network/DB.
M5 menambahkan `simulation:run -- --request FILE` dan `verify:simulation`.
[Simulation](simulation.md) menjelaskan request-relative paths, scripted actions,
restricted envelope, artifacts/status/exit codes dan local-only smoke helper.
Tidak ada server/database/migration/dependency baru untuk simulation CLI.

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
