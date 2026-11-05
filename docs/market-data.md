# Historical market data M3

M3 menggunakan public REST Bybit tanpa API key. Mainnet public data source adalah
`bybit-mainnet`; injected transport test diberi source `fixture`. Target mode pada
configuration (backtest/paper/demo/real) tidak mengganti source atau mengaktifkan
order. Private API, WebSocket, trading dan feature calculation belum termasuk M3.

## Source dan kontrak

Client memakai fixed host https://api.bybit.com dan allowlist GET server time,
instruments-info, kline, mark-price-kline, index-price-kline dan funding/history.
Tidak mengikuti redirect, tidak menerima arbitrary URL atau mengirim credential.
API result/retCode, category/symbol dan payload size divalidasi sebelum ingestion.

Kontrak berada di @bybit/contracts dan generated schemas di
[candle schema](../packages/contracts/schemas/market-candle-v1.schema.json),
[manifest](../packages/contracts/schemas/dataset-manifest-v1.schema.json) dan
[quality](../packages/contracts/schemas/market-quality-v1.schema.json).
Candle price/volume/turnover adalah decimal strings, timestamp UTC epoch milliseconds.
Last-traded candle mempunyai volume/turnover; mark/index OHLC memakai null, bukan
volume0 buatan. Decimal scale maksimum18, integer20 digit sesuai NUMERIC(38,18);
overflow/invalid/OHLC inconsistency ditolak, bukan dibulatkan diam-diam.

Timeframe catalog: 1m/3m/5m/15m/30m/1h/4h/1D. API interval map 1/3/5/15/30/60/240/D.
Data tersedia untuk satu symbol linear USDT perpetual per dataset; instrumen harus
sesuai metadata/status yang didukung. Current instruments endpoint bukan history
aturan exchange; quote/quantity/leverage/funding interval yang diambil sekarang
tidak diklaim berlaku pada seluruh periode historical.

## Membuat dan menjalankan download

Buat config dan snapshot melalui workflow M2, lalu POST /market-data/downloads:

```json
{
  "configurationSnapshotId": "UUID_SNAPSHOT",
  "startMs": 1735689600000,
  "endMs": 1735776000000,
  "references": []
}
```

startMs/endMs boleh dihilangkan bersama-sama untuk memakai range snapshot.
Subset harus berada dalam range snapshot; descriptor baru tidak mengubah snapshot.
Last-price stream dibuat untuk main+secondary timeframes. Mark/index opsional pada
main timeframe, atau ditambahkan otomatis bila stop reference config memerlukannya.
Semua request descriptor menyimpan snapshot ID/hash dan source secara eksplisit.

POST mengembalikan download_id, dataset_id, status dan source; belum melakukan
network download. Jalankan CLI dari root agar request HTTP tidak menunggu lama:

```powershell
.\.tools\node\npm.cmd run data:download -- --id UUID_DOWNLOAD
.\.tools\node\npm.cmd run data:download -- --id UUID_DOWNLOAD --max-pages 1000 --max-seconds 1800
.\.tools\node\npm.cmd run data:export -- --dataset UUID_DATASET
```

Default page/time budget25 pages/120 detik, maksimum5000/3600. Budget diperiksa
antar halaman; satu read/retry/transaction yang sedang berjalan diselesaikan
dengan timeout-nya. Request range maksimum366 hari dan estimasi2 juta candle rows.
Budget habis menghasilkan PAUSED; jalankan lagi ID yang sama. Tidak dianggap
selesai hanya karena invocation berhenti. Global worker lease120 detik membatasi
satu downloader lintas proses. Worker lama tidak dapat commit checkpoint setelah
token/expiry tidak valid. Crash proses pulih setelah lease berakhir, tanpa reset data.

## Closure, pagination dan checkpoint

Server time dipin pada initialization dan tidak berubah setelah resume. Safety
delay2 detik; hanya candles dengan close <= cutoff-delay dan requested end
diterima. Requested range `[start,end)` dan effective aligned ranges dicatat
terpisah, termasuk clipping/empty streams. observed_at adalah waktu data diambil;
availability_policy closed_candle_assumption_v1 tidak mengklaim actual historical
publication latency diketahui.

Kline API descending dipaginasi mundur: end cursor menjadi oldest timestamp-1ms,
start tetap, limit1000. Funding memakai endpoint/limit200 dengan settlement cursor.
Local range filters, non-progress checks dan bounded response size mencegah loop
atau data di luar request masuk diam-diam. Records page dan cursor berikutnya
ditulis dalam transaction yang sama; failure rollback keduanya.

Client timeout10 detik, maksimal4 attempts, minimum1 detik antar public requests.
Timeout/network/5xx/429/10006 dapat retry dengan jitter/backoff. Rate reset panjang
menyebabkan pause/cooldown, bukan indefinite sleep. HTTP403 pause minimal10 menit
dan perlu diagnosis; tidak mengganti host atau mencoba bypass regional restriction.
Permanent invalid page/instrument membutuhkan review/new request. Errors API tidak
memuat raw body SQL/DB connection string.

## Status, quality dan fingerprint

Download PENDING/RUNNING/PAUSED/FAILED/COMPLETED berbeda dari status dataset
BUILDING/READY/QUALITY_FAILED. COMPLETED berarti ingestion/finalization selesai;
quality dapat tetap gagal. Dataset disegel sebelum hashing, dan completion run +
final manifest dipersist secara atomic. Crash setelah seal dapat melanjutkan
finalization tanpa refetch. BUILDING belum dapat dipakai sebagai finalized data.

Quality report memuat per-stream expected/count/missing dan leading/internal/
trailing gaps; gap detail dibatasi100 segments dengan total missing tetap exact.
Counters mencakup invalid, duplicate identik, conflicts, out-of-order, outside range,
incomplete, retry dan resume. Gaps tidak diisi atau dianggap flat candle.
Invalid/conflicting/missing/empty required candle stream menyebabkan QUALITY_FAILED.

Funding actual signed rates disimpan; tidak ada missing-event zero fill. Report
menyebut queried range, event counts, anomaly dibanding current funding interval
dan historical cadence unverified. Interval sekarang tidak membuktikan cadence
setahun lalu. Metadata selalu current_observation_reference_only. Keduanya menjadi
restriction yang diteruskan ke simulator/evaluation; READY bukan live readiness.

Revision rows append-only. Dataset membership merujuk revision tertentu; upstream
correction membuat revisi/dataset baru, tidak mengubah data dataset lama. Identical
records didedup memakai natural identity/content hash. Conflict dalam satu run
tidak memilih nilai terbaik; dataset tersebut gagal quality gate.

Content fingerprint SHA256 meliputi source/symbol/ranges, sorted stream descriptors/
digests, actual funding digest, instrument content hash dan format/quality policy
versions. Page order, retry counts, IDs dan download timestamps tidak masuk hash.
Snapshot provenance disimpan terpisah agar config perubahan non-market tidak
mengubah identity data yang persis sama.

## Membaca dan export

| Route | Hasil |
| --- | --- |
| GET /market-data/downloads/:id | Status/checkpoint/counters/error/cooldown dan lease expiry; token tidak diekspos |
| GET /market-data/datasets | Bounded list, limit/offset |
| GET /market-data/datasets/:id | Dataset descriptor, status/manifest/quality/fingerprint |
| GET /market-data/datasets/:id/quality | Final report atau explicit final:false |
| GET /market-data/datasets/:id/candles?stream=last:1m&limit=100&afterMs=... | Ascending records dan next_after_ms |
| GET /market-data/datasets/:id/funding?limit=100&afterMs=... | Ascending signed settlement records |

Limit1–1000, list offset0–1000000. Data row endpoints memerlukan final dataset;
QUALITY_FAILED tetap dapat dibaca untuk diagnosis dan selalu dilabeli statusnya.
Invalid input400, missing404, busy/cooldown/not-final/integrity409, storage503.

`data:export` menulis JSONL per stream, funding.jsonl, instrument.json dan manifest.json
di ignored artifacts/datasets/<id>. Writes menggunakan unique temporary files,
checksum reread dan rename; manifest ditulis terakhir. Export bukan transaksi
DB–filesystem. Jika file creation gagal, immutable DB dataset tetap menjadi source
dan export dapat diulang. Tidak ada overwrite data dataset lain berdasarkan path client.

manifest.json membungkus canonical content manifest, fingerprint, snapshot provenance,
quality dan files/count/SHA256. Stream/funding file digest sama dengan digest pada
content manifest. Instrument content hash memakai canonical JSON tanpa newline;
file checksum meliputi newline file. Test Python memeriksa schema, digest, counts
dan urutan tanpa menerapkan ulang engine bisnis quant.

## Verification dan public smoke

```powershell
.\.tools\node\npm.cmd run verify:market-data
.\.tools\node\npm.cmd run smoke:bybit-data
```

Offline verification memakai fixture transport berlabel dan PostgreSQL nyata,
termasuk resume/lease/fault/immutability/upgrade/export. Public smoke terpisah,
memakai development DB proyek dan24 jam BTCUSDT dari preset M2 (2025-01-01 UTC),
last1m/5m/15m, funding dan instrument. Maximum25 pages/120 detik. Tidak memulai
full-year download otomatis. Evidence runtime: .runtime/bybit-smoke.json.
Jika live data belum lolos, report milestone tidak boleh menyamakan fixture tests
dengan bukti actual download.

Published contract source berubah sengaja → jalankan contracts:export, review diff,
lalu verification; build biasa melakukan drift check. Metadata restore/production
privileges masih future milestone. DB owner/superuser dapat bypass guards lewat DDL;
tidak ada klaim perlindungan anti-tamper terhadap admin database.

## Referensi

[Kline](https://bybit-exchange.github.io/docs/v5/market/kline),
[Instrument](https://bybit-exchange.github.io/docs/v5/market/instrument),
[Funding](https://bybit-exchange.github.io/docs/v5/market/history-fund-rate),
[Server time](https://bybit-exchange.github.io/docs/v5/market/time),
[Rate limits](https://bybit-exchange.github.io/docs/v5/rate-limit),
[Mark](https://bybit-exchange.github.io/docs/v5/market/mark-kline),
[Index](https://bybit-exchange.github.io/docs/v5/market/index-kline).
Referensi dipelajari pada planning/implementasi5 November2026; periksa lagi ketika
API berubah. Scope dan acceptance M3: [approved plan](plans/milestone-03.md).
