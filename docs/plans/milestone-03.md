# Milestone Implementation Plan — M3 Bybit Market Data

Tanggal: 5 November 2026, Asia/Jakarta.
Approval status: **Approved** melalui `lanjutkan` setelah plan M3 disajikan.
Execution status: **Completed**; hasil aktual pada [handoff M3](../handoffs/milestone-03.md).
Implementasi task 3.1–3.17 selesai dalam scope plan. Saat planning belum ada
kode, migration atau download pasar M3 yang dijalankan.

## Current Project State

M0–M2 Completed. Baseline Git: `06cc22d`, main sinkron dengan origin/main dan
working tree bersih saat pemeriksaan. Source berisi foundation lokal, research
configuration API, immutable snapshots dan contracts; belum ada ingestion Bybit.

Report terakhir M2: verify:configuration passed pada 5 November 2026
20:46:49–20:48:06 WIB; 52 contract + 16 backend unit + 4 Python + 14 integration
tests, migration upgrade dan zero Prisma schema diff. Ini hasil terakhir yang
dibaca, bukan test suite yang dijalankan ulang ketika menyiapkan plan M3.

## Objectives

Historical public market data dapat diambil dari Bybit, divalidasi, disimpan,
dilanjutkan setelah interupsi, diidentifikasi dengan fingerprint dan dibaca/export
secara kronologis. Dataset lama tidak berubah ketika upstream merevisi data.
Quality report membedakan data lengkap, invalid, gap, truncated dan unknown.

## Scope

Seluruh task 3.1–3.17. Satu simbol per dataset, Bybit linear USDT perpetual;
BTCUSDT sebagai smoke default. Main/secondary timeframe berasal dari config
snapshot M2. Dataset request menyimpan snapshot ID/hash dan interval subset bila
diminta; subset tidak mengubah snapshot asal. Target kemampuan sampai satu tahun
histori jika tersedia; tidak menjanjikan histori setiap simbol sama panjangnya.

Public REST GET saja: server time, instruments-info, kline, funding/history.
Mark/index OHLC stream ditambahkan jika diminta eksplisit atau diperlukan stop
trigger reference konfigurasi. Last-traded OHLCV tidak disamakan dengan mark/index.
Source default public mainnet, terpisah dari target trading mode pada konfigurasi.
Tidak membutuhkan API key, secret atau account connection.

## Out of Scope

WebSocket/live feeds, fitur/indikator/normalization, simulator, RL, training jobs,
dashboard, order/positions, private API dan Demo/Real execution. Tidak mengubah
config schema v1, snapshot M2, fee assumptions, safety limits atau .env credentials.
Tidak menginstal broker/cloud atau mengambil histori setahun otomatis saat smoke.
Persisted download state hanya untuk resumable ingestion M3, bukan job framework M8.

## Dependencies

Gunakan NestJS/Prisma/PostgreSQL, Zod dan contracts M2 yang sudah dipin. HTTP client
memakai built-in fetch/AbortController Node; hashing dan streaming memakai standard
library. Tidak memerlukan SDK Bybit atau library runtime baru. Tambahkan candle,
instrument/funding, request/quality/manifest schemas serta shared structural/hash
fixtures di @bybit/contracts; Python tetap consumer contract tests sampai M4.

PostgreSQL proyek pada loopback55432 tetap target migration development. Data test
memakai cluster terisolasi yang sama polanya dengan M1/M2. Lokasi Laragon/global
tidak dipakai atau dihentikan. Tidak melakukan upgrade dependency massal.

## Proposed Architecture

### REST client dan batas akses

NestJS MarketDataModule berisi transport, endpoint adapters, pagination/validation,
repository, download coordinator dan dataset read/export services. Endpoint/client
allowlist mencegah arbitrary URL/SSRF; default host https://api.bybit.com. Redirect
tidak diikuti ke host tak dikenal. Regional/testnet source bukan fallback otomatis.
Mock transport hanya di test injection; fixture dataset tidak dilabeli data Bybit live.

Usulan operational bounds: request timeout10 detik, maximum4 attempts per read,
minimum1 detik antar request dan satu active download worker. Retry terbatas untuk
timeout/network/5xx/429/retCode10006, dengan jitter/backoff dan response headers jika
tersedia. Invalid parameters/schema tidak di-retry. Retry-After/reset yang melebihi
budget menunda run lewat checkpoint, bukan tidur tanpa batas. HTTP403 menghentikan
run untuk review/cooldown; tidak mencoba bypass regional restriction. Bila jelas
IP-frequency ban, simpan blocked-until minimal10 menit sesuai dokumentasi Bybit.

### Range, pagination dan candle closure

Wire timestamps UTC epoch milliseconds dan range `[start,end)`; price/qty/volume
decimal strings. Timeframe map yang dipakai: 1m→1, 3m→3, 5m→5, 15m→15, 30m→30,
1h→60, 4h→240, 1D→D. Tidak mengaktifkan interval di luar catalog M2.

1. Validasi config snapshot, request/range/resource bounds dan instrumen perpetual
   USDT yang sesuai. Metadata disimpan bersama fetched-at/source provenance.
2. Capture server time sekali pada awal run. Freeze cutoff sehingga resume tidak
   tiba-tiba memasukkan candle baru. Hanya candle dengan close <= server time
   minus safety delay2 detik dan close <= requested end yang diterima.
3. Untuk setiap stream, hitung effective start/end yang aligned ke interval UTC;
   laporkan setiap clipping/empty range. Tidak diam-diam mengubah requested range.
4. Kline dipaginasi mundur dengan start tetap dan end cursor, limit1000. Filter
   range lokal tetap berlaku; cursor berikutnya oldest open timestamp minus1ms.
   Tolak non-progressing cursor dan batasi halaman; jangan loop pada page duplikat.
5. Page tervalidasi beserta cursor berikutnya disimpan dalam satu transaction.
   Crash sebelum commit tidak melompati data; setelah commit replay idempotent.
6. Funding memakai endpoint/parameter khusus, limit200 dan cursor settlement
   timestamp, bukan mengasumsikan pagination candle sama. Normalize/sort output.
7. Finalisasi quality dan hash dari stream kronologis, lalu freeze dataset.

Safety delay adalah ingestion assumption, bukan bukti latency exchange historis.
Simpan close_time, observed_at/retrieved_at dan availability_policy terpisah;
historical availability memakai closed-candle assumption, bukan mengaku waktu
publikasi candle historis diketahui. Server time unavailable membuat run tertunda,
tidak menganggap local clock sebagai authoritative cutoff.

### Validation dan data quality

Per candle: timestamp aman/aligned, source identity tepat, OHLC positif dan
low <= open/close <= high, volume/turnover nonnegative serta precision tidak
melebihi representasi DB. Mark/index tidak mempunyai volume dari endpoint-nya:
gunakan nullable fields/variant schema, bukan volume sintetis0.

Report mencakup requested/effective/observed range, expected/actual counts,
duplicates identik, conflicting revisions, invalid/out-of-order rows, missing
intervals termasuk leading/trailing gaps, excluded incomplete candles, pre-launch
coverage, retry/resume counts dan funding/metadata limitations. Gap tidak diisi.
Default quality gate strict: invalid/gap/conflict pada required candle stream
membuat dataset QUALITY_FAILED, bukan research-ready. Network interruption tetap
download incomplete, bukan diinterpretasikan sebagai akhir histori yang valid.

Metadata instrumen saat download bersifat current observation: tick/quantity step,
minimum notional, leverage limits, contract/settle/status, launch/delivery time dan
funding interval. Tidak mengklaim metadata tersebut berlaku sejak historical start.
Manifest menandai historical_metadata_validity unverified/reference_only; actual
constraints untuk simulator/live tetap perlu review pada M5/M12.

Funding dapat berubah interval historis. Simpan actual signed rate dan settlement
time; jangan mengisi event yang tidak ditemukan sebagai rate0 atau memakai satu
fundingInterval terkini untuk menyatakan seluruh histori pasti lengkap. Report
membedakan records fetched/range queried, cadence anomaly dan coverage unknown.
Fixed-rate assumption M2 tetap eksplisit dan tidak mengubah records sumber.

### Persistence, revisions dan immutable dataset

Normalized candle/funding revisions append-only. Natural identity memasukkan
source environment/category/symbol, price type/timeframe dan timestamp; identitas
revisi juga memiliki normalized content hash. Replay identik deduplicated oleh
unique constraints. Nilai berbeda pada identity yang sama menjadi revisi baru,
bukan UPDATE yang mengubah dataset lama.

Dataset membership mengacu revisi spesifik. Conflict dua nilai untuk candle sama
dalam satu run dicatat dan memblokir clean finalization; tidak otomatis memilih
nilai yang paling menguntungkan. Dataset baru boleh memuat revisi sumber terbaru,
sedangkan membership/metadata/fingerprint dataset final lama tetap immutable.
Guard DB mencegah perubahan revision rows dan dataset membership/manifests setelah
finalisasi; owner/superuser DDL tetap di luar jaminan anti-tamper seperti M2.

Download state menyimpan stream cursor, counts, status/attempt/errors, lease token
dan expiry. Satu worker aktif dibatasi lintas proses; checkpoint writes mensyaratkan
lease owner yang masih valid. Worker lama tidak boleh overwrite setelah lease
diambil alih. Resume memakai request/cutoff/source/snapshot yang sama; perubahan
descriptor memerlukan run baru. Tidak mengandalkan state hanya di memory.

Dataset status BUILDING → READY atau QUALITY_FAILED; run memiliki PENDING/RUNNING/
PAUSED/FAILED/COMPLETED. Finalization mengunci membership dari concurrent writer
sebelum streaming hash. Crash finalization dapat dilanjutkan tanpa mengubah rows
yang sudah dibekukan; READY tidak diterbitkan sebelum manifest lengkap tervalidasi.

### Fingerprint dan export

Content fingerprint SHA256 mencakup canonical requested/effective stream descriptor,
chronologically ordered normalized candle/funding content, pinned instrument
content hash dan data-format/quality-policy versions. UUID, download timestamp,
retry/page order tidak masuk content fingerprint. Provenance/quality execution
counts tetap disimpan terpisah; same content menghasilkan fingerprint sama.

Hash/export memakai paged reads/streaming, bukan memuat setahun ke satu JSON body.
Manifest memuat source, symbol/range/counts per stream, quality, content hashes,
metadata/funding caveats dan snapshot provenance. `data:export` membuat JSONL per
stream + manifest di ignored artifacts/datasets/<id>, atomic temp-file rename dan
checksum validation. DB membership immutable adalah source; file export gagal
tidak mengubah dataset. Tidak menerima arbitrary filesystem path dari API client.

## Workflow, API dan Commands

Download tidak dijalankan sebagai request HTTP panjang. API membuat persistent run;
CLI menjalankannya tanpa perlu API server foreground. Contoh commands berikut
akan dibuat dan diuji setelah approval, belum tersedia saat plan disusun.

| Route/command | Perilaku |
| --- | --- |
| POST /market-data/downloads | Create dataset/download request dari configurationSnapshotId, optional range subset dan reference streams |
| GET /market-data/downloads/:id | Status/cursors/counts/error/lease, tanpa credential |
| GET /market-data/datasets | Bounded paginated list |
| GET /market-data/datasets/:id | Manifest/status/fingerprint/provenance |
| GET /market-data/datasets/:id/quality | Quality report; incomplete report dilabeli belum final |
| GET /market-data/datasets/:id/candles | Filter stream + bounded pagination, ascending chronology |
| GET /market-data/datasets/:id/funding | Bounded chronological funding records |
| npm run data:download -- --id UUID | Run/resume persisted ingestion; optional page/time budget |
| npm run data:export -- --dataset UUID | Export immutable dataset dan verify digests |
| npm run verify:market-data | Offline unit/contract/DB/HTTP tests + M1/M2 regressions |
| npm run smoke:bybit-data | Explicit public-network bounded collection/export; evidence dipisahkan dari fixture tests |

Usulan resource bounds: satu simbol, request maksimum366 hari dan estimasi maksimum
2 juta candle rows lintas streams; default invocation budget25 pages/120 detik.
CLI budget eksplisit dapat dinaikkan hingga5000 pages/3600 detik untuk download
panjang, tetap checkpoint dan rate limiter. Budget habis → PAUSED, bukan completed.
Development migration hanya ke cluster proyek yang sudah disetujui.

## Task Breakdown dan Files Expected

| Task | Hasil / file utama yang diperkirakan |
| --- | --- |
| 3.1 REST client | apps/api/src/market-data/bybit-public.client.ts, transport/rate/retry helpers |
| 3.2 OHLCV fetch | Endpoint adapters last/required mark/index streams |
| 3.3 Pagination | Candle/funding bounded backward paginator dan non-progress guard |
| 3.4 Timestamp normalization | contracts/src/market-data/* UTC/timeframe mapping |
| 3.5 Candle validation | Structural + exact-decimal OHLC/identity/range validation |
| 3.6 Persistence | market-data repository/service, Prisma models/migration |
| 3.7 Duplicate prevention | Unique identity/content + idempotent dataset memberships |
| 3.8 Gap detection | Interval coverage scanner leading/internal/trailing gaps |
| 3.9 Incomplete handling | Frozen server cutoff/safety delay, excluded record report |
| 3.10 Retry/backoff | Typed errors, timeouts/rate limits/cooldown + bounded retry fixtures |
| 3.11 Resumable download | Coordinator, transactional page checkpoints, lease/status, CLI resume |
| 3.12 Dataset metadata | Dataset/read API, manifest/provenance/config snapshot references |
| 3.13 Quality report | Critical failures vs warnings/unknowns, completeness flags |
| 3.14 Dataset fingerprint | Streaming canonical hash, deterministic export, Python vectors |
| 3.15 Instrument metadata | Versioned observations, current/history limitation, instrument validation |
| 3.16 Funding data | Dedicated adapter/paginator, signed rates, range/cadence quality |
| 3.17 Integration test | Unit/contract, PostgreSQL/HTTP/fault/resume/export, public smoke and regressions |

Other files: MarketDataModule/controllers, contracts schemas/exports/fixtures,
Python contract tests, scripts task/CLI helpers, root manifests, optional typed env
settings (without printing/replacing secrets), readiness/schema marker tests,
docs/market-data.md, configuration/operations/testing/architecture/decisions/
progress/roadmap/README, dan docs/handoffs/milestone-03.md. Struktur boleh
disederhanakan selama ownership/invariants/task acceptance tetap utuh.

## Database Changes

Satu migration additive M3, mempertahankan migrations/data/config snapshots M1/M2.
Entitas minimal: InstrumentObservation, CandleRevision, FundingRevision, Dataset,
DatasetCandle/DatasetFunding membership, MarketDataDownload. Metadata JSONB,
decimal DB NUMERIC(38,18) dengan rejection overflow/scale, UTC timestamps,
FK/index/identity-content uniqueness dan immutable guards sesuai lifecycle.
Worker lease/checkpoint dapat digabung pada download row, tanpa job broker baru.

Tambahkan market_data_schema_version marker/readiness bila diperlukan; old markers
dan data tetap dipertahankan. Test fresh/reapply/upgrade dari M2 + schema diff.
Tidak melakukan drop/reset/rewrite finalized dataset atau migration lama. Jika
implementasi membutuhkan perubahan destruktif di luar plan, ajukan sebelum tindakan.

## Tests

- Unit: response envelope/retCode, malformed/oversized payload, precision/OHLC/
  volume/timestamps, timeframe, closed cutoff, range boundaries, price variants.
- Pagination/retry: descending/overlapping/out-of-order pages, identical duplicate
  vs conflicting revision, empty/truncated/non-progress page, timeout/5xx/429/
  retCode10006/403, retry budget dan frozen cutoff across resume.
- Quality/fingerprint: leading/internal/trailing gaps, launch range, funding
  empty/irregular cadence, metadata-history caveat; same normalized data/page order
  hash sama, revised data hash berbeda dan dataset lama tetap sama.
- PostgreSQL/HTTP: create/read/list, invalid no-write, page+cursor atomicity,
  interrupted resume equivalence, stale lease/concurrent worker rejection,
  terminal dataset/member immutability, bounded ascending reads/export digests,
  additive M2 upgrade/sentinel preservation dan zero schema diff.
- End-to-end fixtures: config snapshot → download create → fake transport pages
  → interrupt/resume → quality → frozen dataset → JSONL/manifest export → Python
  structural/hash consumer. Fake data diberi label; tidak dijadikan live evidence.
- Public smoke setelah approval: BTCUSDT, completed24 jam dalam range snapshot,
  last-trade1m/5m/15m + instrument/funding, maximum25 pages; simpan actual source/
  counts/range/quality/fingerprint. Reference-price adapters diuji fixtures dan
  small live query bila diperlukan. Bukan full-year download otomatis.
- M1/M2 regressions, build/typecheck/lint/format/contracts drift semua wajib lulus.

Offline deterministic tests tidak bergantung jaringan. Public smoke dilaporkan
terpisah; jika network/regional availability memblokirnya, laporkan scope selesai
dan blocker aktual, jangan mengaku data live terkumpul atau menyembunyikan skip.

## Acceptance Criteria

1. Historical public candles benar-benar dapat dikumpulkan dengan pagination,
   validasi dan persistence; bounded public smoke memiliki evidence aktual.
2. Read/export kronologis, timestamp/unit/price reference benar dan hanya closed
   candles; requested/effective ranges serta exclusions dilaporkan.
3. Duplicate/gap/conflict terdeteksi tanpa silent fill/overwrite; quality report
   tersedia dan incomplete/critical dataset tidak dilabeli research-ready.
4. Dataset ID, pinned revisions/manifest dan reproducible fingerprint tersedia;
   upstream correction tidak mengubah dataset final lama.
5. Instrument/funding diperoleh atau keterbatasannya dinyatakan eksplisit tanpa
   mengklaim current metadata historis atau missing funding sebagai0.
6. Checkpoint/resume/crash/lease/finalization diuji, PostgreSQL nyata dan seluruh
   regressions wajib lulus; migration additive/upgrade/schema diff terverifikasi.
7. Dokumentasi/progress/ADR/roadmap/handoff sinkron dengan test dan source aktual.

Jika mandatory evidence atau critical integration belum lulus, status report
Partially Completed/Failed Verification/Blocked sesuai kondisi; tidak otomatis
Completed hanya karena file sudah dibuat. M4 tidak dimulai otomatis.

## Risks & Tradeoffs

Revision/membership tables memakai disk lebih besar daripada candle upsert, tetapi
menjaga dataset reproducibility. Streaming/batch indexes membatasi RAM; tidak
menambah partitioning/distributed storage sebelum ada pengukuran kebutuhan.
Metadata history tidak tersedia hanya dari current instruments response; limitation
ini harus diteruskan ke simulator/evaluation. Funding completeness tidak dibuktikan
dengan asumsi interval tetap. Network/Bybit regional access dapat menjadi blocker
smoke walaupun tests offline lulus; tidak mengganti source diam-diam.

Minimal persisted download worker menambah status/lease handling, namun diperlukan
untuk restart-safe ingestion. CLI dahulu menjaga scope tanpa membangun dashboard
atau generic background training orchestration. Finalized DB source dan lazy export
menghindari klaim transaksi atomik DB–filesystem yang belum didesain.

## Referensi resmi

Diperiksa 5 November 2026; verifikasi ulang jika API berubah saat implementasi.

- [Kline](https://bybit-exchange.github.io/docs/v5/market/kline): reverse timestamp
  order, limit1000, interval identifiers, last-traded OHLCV/turnover semantics.
- [Instrument](https://bybit-exchange.github.io/docs/v5/market/instrument): cursor
  pagination, quantity/price/leverage filters, contract/settlement/funding interval.
- [Funding history](https://bybit-exchange.github.io/docs/v5/market/history-fund-rate):
  endpoint-specific start/end behavior, limit200 dan settlement rates.
- [Server time](https://bybit-exchange.github.io/docs/v5/market/time): authoritative
  clock untuk frozen candle cutoff, bukan local-clock assumption.
- [Rate limits](https://bybit-exchange.github.io/docs/v5/rate-limit): 429/retCode10006,
  reset headers dan IP-frequency403/cooldown; plan memilih budget lebih rendah.
- [Mark OHLC](https://bybit-exchange.github.io/docs/v5/market/mark-kline) dan
  [Index OHLC](https://bybit-exchange.github.io/docs/v5/market/index-kline): referensi
  harga terpisah dan payload OHLC tanpa volume trade.

## Approval Status

**Approved** melalui `lanjutkan`. Seluruh task M3 dikerjakan tanpa ACC per task.
Public GET smoke yang dibatasi di atas termasuk scope approval; tidak ada
credentials/private endpoint/order yang digunakan. M4 tidak dimulai otomatis.
