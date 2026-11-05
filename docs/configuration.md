# Konfigurasi aplikasi dan penelitian

M1 menyediakan runtime environment untuk API dan koneksi database. Konfigurasi
M2 menambahkan dokumen konfigurasi penelitian, draft berversi dan snapshot
immutable. M3 memakai snapshot tersebut untuk dataset request yang terpisah;
range subset/references download tidak memodifikasi config atau snapshot asal.
Environment server dan konfigurasi penelitian tetap terpisah.

Root `.env` lokal dibuat `npm run setup` hanya jika file belum ada. Password DB
generated acak; tidak dicetak atau di-commit. `.env.example` hanya template.
Environment proses yang diberikan eksplisit mengalahkan `.env`. API dijalankan
melalui runner root agar file env dimuat dengan konsisten; menjalankan built API
langsung memerlukan environment yang disediakan sendiri.

| Variabel | Default / aturan |
| --- | --- |
| NODE_ENV | development; development/test/production saja |
| HOST | 127.0.0.1; hanya 127.0.0.1, ::1, localhost |
| PORT | 3000; integer 1–65535 |
| DATABASE_URL | Wajib; URL postgres/postgresql dengan hostname dan nama database |
| DATABASE_TIMEOUT_MS | 2000; integer 100–30000; timeout pool/query dan readiness |
| PYTHON_PATH | services/quant/.venv/Scripts/python.exe; path nonkosong, disiapkan untuk integrasi berikutnya |

Runner foundation menggunakan Python terisolasi yang dipin; PYTHON_PATH belum
menjadi kontrol worker/inference. Invalid environment ditolak tanpa mencetak
nilai input. DB/schema tidak tersedia membuat readiness 503, tetapi liveness
tetap 200. Batas timeout readiness juga berlaku jika dependency tidak merespons.

## Runtime dan state lokal

`toolchain.json` memin versi dan checksum archive Node, uv serta PostgreSQL.
Node/uv awalnya diverifikasi terhadap checksum upstream. PostgreSQL didapat lewat
HTTPS distribusi EDB yang dirujuk situs PostgreSQL; checksum pertama dihitung
lokal lalu dipin untuk unduhan ulang, bukan diklaim signature/checksum upstream.
Python dikelola uv pada `.tools/python`; package versions di `uv.lock`.

| Path (ignored) | Isi |
| --- | --- |
| .tools/ | Runtime portable, cache npm/uv, download dan provenance checksum |
| .runtime/postgres/ | Cluster development, marker ownership/credential lokal, logs |
| .runtime/integration/ | Cluster test terisolasi per run, dipertahankan untuk diagnosis |
| .runtime/logs/ | Log smoke API |
| .runtime/foundation-report.json | Hasil verification terakhir; baca status dan timestamp |
| services/quant/.venv/ | Virtual environment Python |

Jangan membagikan `.env`, marker cluster atau runtime logs tanpa pemeriksaan.
File runtime menyimpan credential DB lokal; permission file pada Windows mengikuti
ACL workspace. Ini setup lokal, belum secret store produksi. Tidak ada credential
Bybit atau runtime mode live pada M1.

Port DB development 55432, test 55433, smoke API 53001, semuanya loopback. Cluster
default menggunakan role development `bybit`; bukan role least-privilege produksi.
Port bentrok menyebabkan gagal, tidak mematikan proses lain. Marker path/PID/
postmaster options diperiksa sebelum stop database milik proyek.

DATABASE_URL boleh menunjuk DB proyek existing yang sengaja disediakan. Perintah
`db:start/stop/status` tetap mengelola cluster portable milik workspace, tidak
mengendalikan server dari DATABASE_URL. `setup` menyiapkan cluster default dan
menerapkan migration menggunakan DATABASE_URL efektif; review env Anda sebelum
setup bila memakai DB existing. Tidak ada operasi reset/drop otomatis.

## Research configuration M2

Kontrak: [configuration-v1.schema.json](../packages/contracts/schemas/configuration-v1.schema.json).
Schema source Zod dan semantic validator berada pada `@bybit/contracts`.
[Preset JSON](../packages/contracts/presets/research-small-hybrid-v1.json) adalah
contoh lengkap dan berversi, bukan tarif akun Bybit atau jaminan trading.
`GET /configuration-presets` mengembalikan preset lengkap dan hash-nya.

| Kelompok | Isi / units |
| --- | --- |
| Versions | schema_version, contract_version dan action_schema_version = string `1` |
| Market | Bybit linear USDT, symbol, main/secondary timeframe, historical UTC epoch ms, mode |
| Risk | Decimal strings untuk USDT/fractions, integer leverage/count/bars; satu posisi |
| Stop loss | Hard stop wajib, ATR period/multiplier, min/max fraction, trigger reference dan allowances |
| Exit | AI_EXIT, FIXED_RR atau HYBRID; explicit fixed_tp_enabled/ai_close_enabled/rr |
| Execution | Explicit fee rates, spread/slippage bps, funding source, order type, timeout ms |
| Features | Ordered enabled {id,timeframe}, catalog/periods, position/risk inputs, window dan normalization policy |
| Network | Small/Medium/Large/Custom, actor/value layer lists, activation dan optional declared input_dimension |
| Training | MaskablePPO/MlpPolicy, CPU/single env, explicit hyperparameters, window/episode/seed/reward |

Semua field dokumen lengkap wajib disediakan; tidak ada implicit trading defaults
ketika POST/PUT. API menolak unknown keys dan scalar types yang salah. Decimal
strings maksimal 18 digit integer dan 18 fractional, tanpa exponent atau negative
zero. Risk 0,5% adalah `0.005`, bukan `0.5`. Fee `0.001` berarti fraction 0,1%,
spread/slippage `5` berarti 5 bps. Comparisons risk memakai integer berskala,
bukan floating point. Integers harus aman dan tidak diterima sebagai strings.

Preset research-small-hybrid-v1 memakai capital 1000, risk/trade 0.005, daily loss
0.02, drawdown 0.1, ATR14 × 1.5, RR2, Hybrid dan Small [64,64]. Asumsi tambahan
yang disetujui dalam plan: leverage1, margin fraction0.5, notional1000, minimum
available margin50, cooldown5 bars/holding240 bars, stop fraction0.001–0.05,
fee maker/taker0.001, spread/slippage5 bps. Funding historical memerlukan data M3.
Rentang 2025-01-01–2026-01-01 UTC adalah contoh, bukan dataset tersedia.

Validation memeriksa risk/trade <= daily loss <= drawdown; min stop <= max stop;
margin vs capital; allowance fee round-trip dan slippage+spread; trigger reference
konsisten; feature timeframe/duplicates; EMA/MACD/ATR periods; exit flags/RR;
layer presets, batch/rollout dan window/episode. AI_EXIT tidak membuat fixed TP
dari RR; FIXED_RR menonaktifkan discretionary close; HYBRID mengizinkannya.

Daily-risk semantics equity-utc-latched-v1 disimpan sebagai bagian konfigurasi:
equity termasuk unrealized, reset UTC, high-water per run/deployment, block new
entries dan controlled close posisi bot saat breach. Ini belum risk execution
engine; M5/M11 mengimplementasikan dan menguji behavior tersebut.

Network guard penelitian: 1–8 hidden layers dan 1–1024 neurons/layer per network;
estimasi terpisah actor/critic maksimum 2 juta parameter bila input dimension
diberikan. Nilai null menyatakan actual shape belum tersedia. Indicator catalog,
declared dimension dan normalization policy belum membuktikan hasil feature/tensor
M4 atau fitted preprocessing/model M8.

## Draft, snapshot dan hash

Draft adalah dokumen valid yang masih dapat diganti melalui PUT penuh, bukan
partial config. `expectedRevision` melindungi dari lost update; stale request 409.
Metadata respons Prisma menggunakan camelCase (`configHash`, `schemaVersion`,
`sourceRevision`); embedded payload tetap snake_case seperti schema kontrak.

Snapshot dibuat dari revision tertentu di transaksi dengan row lock. Retry
source/revision yang sama mengembalikan ID yang sama, termasuk jika draft kemudian
sudah berubah. Jika revision lama belum pernah disnapshot dan draft maju, request
freeze revision lama ditolak 409. Payload/schema/hash/provenance snapshot immutable;
draft edit tidak mengubahnya. Tidak ada API update/delete snapshot; DB triggers
menolak ordinary UPDATE/DELETE/TRUNCATE. Owner/superuser bisa mengubah DDL/trigger,
sehingga kontrol ini bukan perlindungan dari admin database yang bermaksud merusak.

Hash SHA256 memakai normalized decimal fields dan sorted object keys dengan UTF-8;
urutan array tidak diubah. Name, UUID dan timestamps di luar payload tidak masuk
hash. Artifact IDs yang tampak numeric tetap opaque, tidak dinormalisasi sebagai
decimal. Shared [golden vectors](../packages/contracts/fixtures/canonical-vectors.json)
diverifikasi di TypeScript/Python. Source preset provenance ditentukan server
hanya ketika config hash sama dengan built-in preset, bukan dari klaim client.

## Validasi, compatibility dan batas kemampuan

`POST /configurations/validate` sukses menghasilkan `configuration_valid: true`,
config normalized, hash dan `execution_checks_pending`. Invalid 400 memuat issues
{field,code,message}, tanpa memantulkan nilai input/SQL/connection URL.

Compatibility membandingkan snapshot reference dengan candidate, bukan model
artifact. Exact hash → exact_config_match; versions berbeda → incompatible;
market/feature/window/network/exit/SL/RR/training berubah → retraining_required;
risk/cost/mode berubah → reevaluation_required dengan behavioral review.
Respons selalu menyatakan model_approval dan execution_readiness not_assessed.
Configuration valid atau target mode real tidak mengaktifkan akun/trading.

JSON Schema artifact menjamin struktur, bukan seluruh aturan lintas field. Python
jsonschema saat ini hanya dev/contract test consumer, bukan runtime business
validator kedua. Python semantic conformance wajib sebelum penggunaan quant M4/M5.
Exchange capability/instrument metadata, dataset/funding, observation shape,
normalization artifact, liquidation/margin, model evaluation dan operational
readiness tetap gate milestone berikutnya.

M3 telah menyediakan public instrument observations, dataset/funding records,
quality dan reproducible export. Actual public data tersedia, tetapi current
metadata observation belum menjadi historical instrument rules dan funding cadence
tetap dilabeli unverified. Item checks pending pada config M2 tidak otomatis
dianggap selesai/approved hanya karena satu dataset sudah READY. Penggunaan:
[market-data](market-data.md).
