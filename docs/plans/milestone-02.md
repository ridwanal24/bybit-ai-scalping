# Milestone Implementation Plan — M2 Configuration System

Tanggal: 5 November 2026, Asia/Jakarta.
Status: **Approved**, melalui pesan `gw approve` setelah plan M2 disajikan.
Execution status: **Completed**, lihat [handoff M2](../handoffs/milestone-02.md).
Implementasi seluruh task 2.1–2.15 selesai dalam scope rencana ini. Saat planning
belum ada migration/configuration domain yang dijalankan.

## Current Project State

M0 dan M1 Completed. Baseline Git saat pemeriksaan: `a406a7a`, working tree bersih,
branch main satu commit di depan origin/main. Agent tidak melakukan commit/push
pada sesi penyusunan rencana ini. M1 memiliki API NestJS, Prisma/PostgreSQL,
Python isolated, health/readiness dan migration app_metadata.

Report M1 terakhir: `verify:foundation` passed, 5 November 2026 20:10:38–20:11:27
WIB; 16 unit backend, 2 Python, 4 integration plus built API/Python smoke. Ini
bukti pengujian terakhir, bukan klaim suite dijalankan ulang ketika membuat plan.
Tidak membaca/mencetak isi .env atau mengganti credential database.

## Objectives

Pengguna API dapat memvalidasi, menyimpan, membaca, merevisi dan membuat snapshot
konfigurasi penelitian. Invalid configuration ditolak dengan field/reason yang
jelas. Snapshot historis tidak berubah saat draft direvisi. Preset berversi dan
compatibility report tersedia tanpa membuat simulator/training/trading lebih awal.

## Scope

Seluruh task 2.1–2.15: market/risk/SL-TP-RR/exit/execution/features/network/training
config, validasi type/range/cross-field, persistence, immutable snapshots,
presets, compatibility rules dan integration tests nyata.

Konfigurasi penelitian adalah dokumen bisnis berversi, terpisah dari environment
server M1. Default awal backtest; pilihan paper/demo/real hanya deklarasi target
configuration dan tidak mengaktifkan adapter/credentials/order. M2 tidak mempunyai
activation endpoint. Snapshot adalah prasyarat eksperimen masa depan, bukan
persetujuan menjalankan eksperimen atau promosi model.

## Out of Scope

Frontend, Bybit API/metadata verification, data download, indicator computation,
observation tensor aktual, simulator/risk execution, worker/training, model
registry, active-position settings dan exchange operations. Tidak membuat tabel
Experiment/Model/Order sebelum milestone pemiliknya. Tidak mengubah runtime major,
database global/Laragon, hard safety limit existing atau PROJECT_SPEC.md.

## Dependencies

M1 API/database/Prisma dan test runner digunakan kembali. NestJS, Prisma, Zod,
TypeScript dan runtime tetap versi lock M1. Tambahan satu workspace package
`@bybit/contracts` memakai Zod versi yang sama; Python dev dependency `jsonschema`
4.x untuk pemeriksaan structural contract dengan schema yang sama. Patch exact
dan hashes dependency baru dipin/di-lock saat implementasi setelah registry check.
Tidak menginstal library RL/ML atau infrastructure service baru.

## Proposed Architecture

### Kontrak dan validasi

`packages/contracts` menjadi pemilik config schema versi 1, catalog input yang
dideklarasikan, canonicalization/hash, typed issues dan compatibility classifier.
API `ResearchConfigurationsModule` memakai kontrak tersebut, tanpa mencampurkannya
dengan ConfigModule environment M1. Database provider diekspor lewat module kecil
agar service baru tidak menduplikasi Prisma connection/pool.

Zod strict objects menolak unknown keys, salah tipe, nonfinite/unsafe numeric dan
payload terlalu besar. Wire format memakai decimal strings kanonis untuk capital,
rate, RR dan hyperparameter pecahan; integer aman untuk period/count/timestamp UTC
millis. Preset numeric spec 0,5% disimpan sebagai fraction string `0.005` dan
dijelaskan unitnya. Jangan menerima boolean/numeric string melalui coercion yang
tidak disengaja pada field integer. Perbandingan decimal dilakukan exact dengan
integer berskala (BigInt), bukan parseFloat untuk memutuskan batas risk;
precision/length dibatasi agar payload tidak menyebabkan resource berlebihan.

Validasi struktural dipisahkan dari semantic cross-field checks. Export JSON
Schema dari schema dasar Zod beserta versioned fixtures; test Python membaca
artifact yang sama melalui jsonschema. Semantic rules TS diuji tersendiri dan
didokumentasikan; JSON Schema export tidak diklaim membawa seluruh refinements.
Python runtime semantic parity/conformance diwajibkan ketika quant mulai memakai
config pada M4/M5. M2 tidak membangun validator bisnis Python kedua secara manual.

Canonicalization: normalisasi decimal strings (hapus trailing fraction zeros,
larang exponent/negative zero), sort object keys deterministik, array order tetap
bermakna, integer aman, UTF-8. SHA256 meliputi canonical config + schema/contract
versions; tidak memasukkan DB ID, draft name, timestamps atau provenance record.
Fixtures hash yang sama dicek dengan Python standard library. Arrays feature
tidak disortir diam-diam; urutan fitur merupakan bagian kontrak model.

### Isi konfigurasi

| Bagian | Field dan aturan utama |
| --- | --- |
| Market (2.1) | Bybit, linear USDT perpetual, symbol, main/secondary timeframe, historical start/end UTC, target mode; start < end, secondary unik/lebih tinggi/aligned, catalog interval sesuai spec |
| Risk (2.2) | Capital, risk/trade, leverage, exposure/margin caps, satu posisi, daily loss/drawdown, cooldown/holding, minimum available margin; units dan basis wajib jelas |
| SL/TP/RR (2.3) | Hard SL required, ATR period/multiplier, min/max stop fraction, trigger reference, fee/slippage allowance, RR numerik sebagai decimal string |
| Exit mode (2.4) | AI_EXIT: hard SL dan TP disabled/RR tidak menghasilkan TP; FIXED_RR: SL+TP, AI close disabled; HYBRID: SL+TP dan AI close enabled |
| Execution (2.5) | Maker/taker fee assumptions, spread/slippage bps, historical/fixed funding assumption, order type, timeout, price reference; tidak menebak tier fee akun |
| Features (2.6) | Catalog ID/versions dan ordered enabled feature IDs, periods, HTF requirements, normalization policy, observation window, position/risk input declarations |
| Network (2.7) | Policy/value layers, Tanh/ReLU, Small/Medium/Large/Custom; preset layers harus konsisten, layer/unit/resource guards, parameter estimate hanya jika input dimension tersedia |
| Training (2.8) | MaskablePPO/MlpPolicy, learning rate, timesteps, batch/n_steps, gamma/GAE/entropy/clip, episode/window/seed/reward version; CPU/single-env MVP |

Cross-field checks tambahan: risk/trade <= daily loss <= max drawdown; fractions
dalam domain yang valid; min stop <= max stop; minimum margin < capital; fixed TP
memerlukan RR > 0; trigger/cost fields konsisten antar bagian; HTF feature hanya
jika timeframe-nya dipilih; feature ID tak dikenal/duplikat ditolak; enabled list
tidak kosong. Batch harus sesuai rollout n_steps × n_envs menurut policy MVP dan
episode cukup untuk window. No silent reinterpretation untuk config version lama.
Guard konfigurasi network usulan: 1–8 hidden layers per network, 1–1024 neurons
per layer, estimasi maksimum 2 juta parameter ketika input dimension tersedia.
Ini resource guard penelitian yang diajukan pada plan, bukan batas trading live.
HTF alignment memakai availability/UTC convention; tidak mewajibkan rasio integer
antara main/secondary interval yang dapat menolak kombinasi closed-candle valid.

Metadata capability exchange, liquidations, actual observation shape, normalization
artifact, parameter count berbasis shape aktual dan margin feasibility tetap
memerlukan data/artifact milestone berikutnya. Hasil validasi M2 membedakan
`configuration_valid` dengan `execution_checks_pending`, bukan label ready-to-trade.
Symbol/timeframe yang lolos syntax/catalog belum diklaim didukung akun exchange.

### Defaults, R06 dan R07

Defaults spesifikasi dipertahankan: BTCUSDT 1m + 5m/15m, capital `1000`, risk/trade
`0.005`, satu posisi, daily loss `0.02`, drawdown `0.1`, ATR14 × `1.5`, Hybrid,
Small [64,64] actor/critic. Usulan RR penelitian default `2`; bukan target hasil.

Field yang belum memiliki default di spec wajib eksplisit dalam dokumen lengkap;
tidak diisi berdasarkan akun atau dianggap safety limit live. Preset
`research-small-hybrid-v1` akan menyediakan contoh deterministik berlabel
`synthetic_research_assumptions`: leverage 1, maximum notional `1000`, maximum
margin fraction `0.5`, minimum available margin `50`, cooldown 5 bars, max holding
240 bars, stop fraction min `0.001`/max `0.05`, maker/taker fee masing-masing
`0.001`, spread/slippage masing-masing 5 bps, timeout 5000 ms. Angka ini adalah
contoh asumsi pengujian/simulasi yang direview dalam plan ini, bukan tarif Bybit
terverifikasi atau operational hard limits. User dapat membuat konfigurasi lain
dalam domain validasi; actual feasibility/risk enforcement ada pada M3/M5/M11.

Preset memakai historical funding (memerlukan dataset M3); fixed funding bernilai
0 hanya jika dipilih eksplisit dan dilabeli. Historical range contoh dibekukan
2025-01-01 sampai 2026-01-01 UTC; tidak mengklaim data telah tersedia. Network
Small dan Tanh, window 32, seed 42, n_envs 1, n_steps 128, batch 64, total
timesteps 1024, learning rate `0.0003`, gamma `0.99`, GAE lambda `0.95`, entropy
coefficient `0`, clip range `0.2`, episode length 1440 bars, reward version
net-equity-delta/initial-capital-v1 tanpa shaping. Ini small-run template,
bukan rekomendasi hyperparameter optimal. Normalization policy train-only z-score,
dengan fitted artifact masih pending M4/M8.

R07 diformalkan sebagai konfigurasi yang merekam equity basis termasuk unrealized,
UTC day reset, persistent daily anchor, high-water drawdown per run/deployment,
latching entry block + controlled close posisi bot saat breach. External cashflow
selama run memerlukan block/review anchor. M2 menyimpan semantics/version, belum
mengimplementasikan engine atau mengaktifkan limit; final conformance dan tests
execution tetap M5/M11. Reset tidak menghapus emergency/drawdown latch.

### Persistence, snapshots dan concurrency

Draft tervalidasi penuh boleh direvisi dengan optimistic concurrency
`expectedRevision`. Request stale menghasilkan 409, tidak menimpa update lain.
Snapshot dibuat secara transaksional dari revision draft yang diminta dan
menyimpan config lengkap, schema version, hash, source revision/preset provenance.
Snapshot ID dipakai eksperimen pada M8; belum ada tabel eksperimen M2.

Snapshot append-only: tidak ada API update/delete; PostgreSQL triggers menolak
UPDATE/DELETE/TRUNCATE snapshot, FK parent restrictive. DB owner/superuser tetap
dapat menonaktifkan trigger/DDL; desain ini bukan janji anti-tamper terhadap admin.
Retrieval/compatibility memverifikasi supported schema/hash. Draft edits tidak
mengubah snapshot/provenance yang telah ada. Duplicate snapshot dari revision
yang sama dikembalikan secara idempotent dengan unique source/revision constraint.

### API yang direncanakan

| Method/route | Perilaku |
| --- | --- |
| POST /configurations/validate | Validasi tanpa write, field/reason issues dan pending checks |
| GET /configuration-presets | Preset source berversi, payload lengkap dan label asumsi |
| POST /configurations | Buat named draft tervalidasi |
| GET /configurations | Daftar dengan bounded pagination |
| GET /configurations/:id | Read draft + revision/version/hash |
| PUT /configurations/:id | Ganti payload lengkap memakai expectedRevision; tidak deep-merge ambigu |
| POST /configurations/:id/snapshots | Freeze revision yang diminta dalam transaksi |
| GET /configuration-snapshots/:id | Read snapshot immutable dan verifikasi hash |
| POST /configurations/compatibility | Compare reference snapshot dengan candidate tervalidasi |

Response invalid HTTP 400, not found 404, stale revision 409 dan DB unavailable
503; reason codes stabil, tidak membocorkan connection URL/raw SQL. API tetap
loopback M1 tanpa remote exposure. Tidak ada delete/activation endpoint pada M2.

Compatibility report memakai hasil terpisah: schema/action mismatch → incompatible;
pair/timeframe/feature ordering/window/normalization/exit/SL/RR/network perubahan
→ retraining/re-evaluation required; risk/cost perubahan → re-evaluation dan
behavioral/retraining review; config identik → exact config match. Tanpa model
artifact, tidak boleh menghasilkan label model approved/compatible-for-live.

## Task Breakdown dan Files Expected

| Task | Hasil | File utama yang diperkirakan |
| --- | --- | --- |
| 2.1–2.8 | Delapan kelompok config, strict types/schema/semantics, feature catalog dan network presets | packages/contracts/src/configuration/* |
| 2.9–2.10 | Type/range/cross-field validation, reason codes dan exported JSON Schema | packages/contracts/src/*, schemas/*, fixtures/* |
| 2.11 | CRUD/revision API dan Prisma persistence | apps/api/src/research-configurations/*, database/database.module.ts |
| 2.12 | Snapshot transaction, canonical hash, DB immutable triggers | contracts canonicalization, API service, Prisma migration |
| 2.13 | Versioned source presets dengan asumsi eksplisit | packages/contracts/presets/* |
| 2.14 | Config comparison dan model compatibility policy | packages/contracts/src/compatibility*, API endpoint |
| 2.15 | HTTP + DB + shared structural/canonical fixtures dan regressions | API test/*.spec.ts/*.integration.ts, contracts tests, quant tests |

File lain: root/package workspace manifests dan locks, contracts package build
config, API app.module.ts/imports, services/quant/pyproject.toml dan uv.lock,
scripts/tasks.mjs (contracts build/export dan verify:configuration), documentation
configuration/operations/testing/architecture/decisions/progress/roadmap/README,
serta docs/handoffs/milestone-02.md. Struktur folder boleh disederhanakan dengan
scope dan ownership tetap sama. Tidak mengubah environment credentials.

## Database Changes

Migration additive baru: ResearchConfiguration (UUID, name, JSONB payload,
schemaVersion, revision, configHash, timestamps) dan ConfigurationSnapshot
(UUID, sourceConfigurationId/sourceRevision unique, immutable JSONB/schema/hash/
provenance, createdAt). Naming final mengikuti Prisma @map snake_case.
Tambahkan FK/index/checks dan immutable triggers; marker schema readiness diperbarui
secara versioned bila diperlukan, beserta expected marker service/tests yang sama.

AppMetadata M1 dan data existing dipertahankan. Migration diuji dari DB kosong
dan upgrade dari M1 pada test cluster. Tidak memakai reset/drop pada development,
tidak mengubah migration M1 yang telah diterapkan. Jika ditemukan perubahan
destruktif yang benar-benar perlu, ajukan keputusan sebelum bagian tersebut.

## Tests

- Unit/contract: semua tipe/range dan cross-field positif/negatif, unknown keys,
  decimal canonicalization/precision, deterministic hash, preset consistency,
  feature ordering, layer/hyperparameter validation dan compatibility reason codes.
- Python structural fixtures memakai exported schema yang sama, schema drift
  check dan canonical hash golden vectors. Tidak mengklaim semantic parity Python
  penuh sebelum runtime quant validator diperkenalkan pada milestone berikutnya.
- Integration PostgreSQL/HTTP: create/read/update/list, invalid no-write, stale
  revision, concurrent snapshot/edit consistency, snapshot idempotency, draft edit
  leaves old snapshot unchanged, API no update/delete, raw SQL UPDATE/DELETE/
  TRUNCATE snapshot ditolak trigger, corrupted/unsupported schema/hash reject,
  DB failure sanitized, upgrade M1 migration tanpa kehilangan marker/data.
- End-to-end: preset → validate → save → read → snapshot → update draft → read
  original snapshot → compatibility report. Termasuk invalid config path.
- Regression M1: health/migration checks disesuaikan untuk schema version baru
  tanpa melemahkan semantics missing-schema/503; Python CLI, root commands,
  lint/typecheck/build/format dan foundation suite tetap lulus.

Sediakan `npm run verify:configuration` yang menjalankan checks relevan termasuk
foundation regressions, dedicated test cluster dan report exit nonzero pada fail/
skip DB wajib. Gunakan cache/execution context M1 yang sudah diketahui, tidak
membaca atau mematikan PostgreSQL pengguna lain. Tidak melakukan Bybit network test.

## Acceptance Criteria

1. Seluruh kelompok configuration dapat divalidasi, disimpan dan dibaca API/DB.
2. Invalid types/ranges/cross-fields ditolak dengan field/reason; no invalid write.
3. Preset lengkap/berversi, units jelas dan asumsi biaya bukan tarif akun tersirat.
4. Snapshot immutable pada aplikasi dan ordinary DB DML, hash deterministik;
   perubahan draft tidak mengubah snapshot eksperimen historis.
5. Schema/structural fixtures lintas bahasa konsisten; compatibility report
   konservatif dan tidak mengklaim model/trading readiness yang belum diuji.
6. Critical unit/contract/integration/E2E dan regressions M1 lulus pada PostgreSQL
   nyata, additive migration berhasil dari fresh DB dan upgrade M1.
7. Dokumentasi, decisions, progress, roadmap dan handoff sinkron dengan bukti aktual.

## Risks & Tradeoffs

JSONB dan full-document replacement memudahkan versioned snapshots tetapi tidak
optimal untuk query setiap parameter; indexing tambahan ditunda sampai ada beban
nyata. Immutable triggers bukan pengganti role/privilege produksi. Draft concurrency
dan snapshot race diuji dengan transaction/unique constraints, bukan asumsi API.

Cross-field semantics tidak seluruhnya diekspor ke JSON Schema; metadata/pending
checks harus jujur. Configuration valid tidak membuktikan exchange support,
funding availability, actual observation shape atau model profit. Preset tambahan
di atas adalah asumsi penelitian yang secara eksplisit diajukan untuk review,
bukan perubahan hard limit live. M3/M4/M5/M8 tetap memiliki gate sendiri.

## Referensi resmi

Diperiksa 5 November 2026; tidak meng-upgrade package dari dokumentasi bergerak.

- [Zod JSON Schema](https://zod.dev/json-schema): export schema dan keterbatasan
  representasi custom/transform types, sehingga semantic checks dipisahkan.
- [Python jsonschema validation](https://python-jsonschema.readthedocs.io/en/stable/validate/):
  consumer structural schema lintas bahasa, bukan validator behavior trading.
- [PostgreSQL trigger functions](https://www.postgresql.org/docs/17/plpgsql-trigger.html):
  mekanisme guard UPDATE/DELETE/TRUNCATE, dengan batas privilege yang disebut di atas.

## Approval Status

**Approved** melalui `gw approve`. Seluruh task M2 dikerjakan tanpa ACC per task
dalam scope ini. M3 tidak dimulai otomatis.
