# Feature engineering dan observation M4

Implementasi mengikuti [plan M4](plans/milestone-04.md), disetujui melalui `lanjut`
pada 6 November 2026. Python memiliki perhitungan fitur, alignment, normalizer dan
ObservationBuilder; simulator, risk enforcement, model dan live feed belum dibuat.

## Alur dan integritas input

`Dataset` memeriksa manifest/schema M3, fingerprint, exact file set, checksums,
counts, stream identity, ascending timestamps, OHLC, contiguous coverage dan quality.
File path harus tetap di direktori dataset; duplicate keys/nonfinite JSON,
oversized line, gap/conflict/invalid report dan corrupt file ditolak. Candle files
dibaca streaming dan checksum diperiksa kembali setiap pass. File export perlu
dijaga immutable selama digunakan. Checksums mendeteksi perubahan; bukan signature
atau perlindungan terhadap admin yang mengganti seluruh artifact dan hash-nya.

Config diverifikasi secara structural dan semantic dengan rules M2. Decimal
configuration memakai arithmetic exact dengan precision80. Canonical hash sama
dengan TypeScript, termasuk JSON integer `1.0`, decimal-equivalent fields dan opaque
artifact ID yang tidak boleh dinormalisasi sebagai angka. Shared generated
conformance vectors mencakup negative semantic branches dan structural failures.

Hash config input yang sama dengan provenance dataset membuktikan snapshot content
yang dipakai. Untuk feature variant, sediakan snapshot asal lewat optional
`--source-snapshot FILE`: JSON API `{id,configHash,payload,...}` atau portable
envelope `{id,config_hash,configuration}`.
ID/hash/config serta market/range snapshot asal harus cocok dengan dataset. Config
variant mempunyai hash terpisah; symbol/range/required streams tetap divalidasi.
Loader tidak mengubah config/dataset asal. Snapshot provenance tidak berarti
approval model atau execution readiness.

## Formula dan warm-up

Authority formula v1: [feature catalog](../packages/contracts/fixtures/feature-catalog.json)
dan [approved plan](plans/milestone-04.md). Semua 23 IDs katalog M2 tersedia,
termasuk parameter periods yang dapat dikonfigurasi.

- Returns: log, percentage dan rolling lag return.
- Candle: signed body/range, upper/lower wick, range/close dan close location.
  Zero-range menghasilkan body/wicks0, close location0.5.
- Trend: EMA fast/slow/long distance, spread dan fast EMA slope. EMA memakai SMA
  seed setelah period candle, lalu alpha2/(period+1).
- RSI memakai Wilder average gain/loss setelah period perubahan close; flat50,
  gain-only100, loss-only0. MACD line/signal/histogram memakai raw price units;
  signal baru di-seed dari valid MACD lines.
- ATR memakai Wilder true range dengan previous close wajib tersedia; ATR fraction
  dibagi close. Volatility adalah population std log returns, tanpa annualization.
- Volume change memakai previous volume; relative volume memakai mean periode
  sebelumnya; volume MA ratio memakai mean yang termasuk current. Denominator
  volume nol membuat fitur unavailable.

Float64 digunakan di perhitungan; harga sumber tetap decimal strings sampai
konversi yang eksplisit. Ledger/accounting nantinya mempunyai aturan sendiri.
Nonfinite/invalid hasil ditolak; warm-up tidak diisi nol. Period sangat besar
tidak melakukan preallocation sebesar period: state tumbuh sesuai data masuk.
Rolling windows bounded oleh config; kinerja full-year belum dibenchmark.

Decision historical adalah close main candle. HTF join mengambil candle terbaru
dengan availability <= decision, dan close HTF harus sesuai boundary terakhir
yang diharapkan. Boundary sama boleh dipakai setelah closed; candle yang sedang
berjalan tidak masuk. Missing expected HTF berarti stale; gap mereset indikator
dan observation window. Tidak ada backfill/interpolasi melewati gap.

Historical availability tetap asumsi closed-candle M3. `Indicators.push` menerima
availability aktual dari field candle atau argument eksplisit. Main dan HTF
memakai metadata tersebut; tanpa metadata, default tetap close candle.
Jika main candle tersedia sesudah close, fitur pada decision close berstatus
`stale` dengan values unavailable. Baris berikutnya yang masih bergantung pada
candle terlambat itu juga unavailable sampai seluruh dependensi telah tersedia.
Normalizer melewati baris tersebut dan ObservationBuilder mereset window;
window harus kembali lengkap sebelum observation valid. Timestamp keputusan
tetap close main candle dan baris lama tidak di-backfill. Metadata availability
invalid ditolak sebelum indicator state diperbarui. Prefix replay, delayed main/
HTF, train-fit exclusion dan recovery observation diuji.
Feed transport, incremental optimization dan latency live adalah scope M11.

## Layout dan context

Schema v1 mencatat ordered features/timeframes/periods, window, context order,
scales, formula/availability versions, dtype dan content hash. Data layout:

`flatten_row_major(market[W,F]) + current_position[P] + current_risk[R]`

Preset default: `32*9+7+4=299`, dtype IEEE754 float32 little-endian. Position/risk
hanya ditambahkan sekali pada decision saat ini. Declared network dimension wajib
cocok; actual parameter guard juga diperiksa ketika declared dimension masih null.
Reordering, periods atau context scaling mengubah schema hash.

Caller memasok current context dengan `as_of_ms` sama persis dengan decision.
Context terlambat/masa depan atau missing tidak dianggap current. Fields dan
shape: [context schema](../packages/contracts/schemas/observation-context-v1.schema.json).

| Input observation | Scaling v1 |
| --- | --- |
| side | SHORT−1, FLAT0, LONG1 |
| unrealized_pnl | side*(mark−entry)*quantity / initial capital |
| duration | duration bars / max holding bars; tidak di-clip |
| distance_to_sl | (mark−SL)/mark, signed |
| distance_to_tp | (TP−mark)/mark, signed;0 jika tidak applicable |
| exposure | abs notional / initial capital |
| available_margin | available margin / initial capital |
| drawdown | (high-water equity−equity)/high-water equity |
| remaining_daily_budget | caller remaining currency budget / initial capital |
| trading_allowed | caller bool →0/1 |
| risk_fraction | configured risk per trade |

FLAT mensyaratkan quantity/entry/SL/duration0 dan TPnull. Posisi nonflat wajib
entry/quantity/SL positif dan TP bila mode FIXED_RR/HYBRID; AI_EXIT memakai TPnull.
Equity/high-water, available margin dan daily budget harus konsisten/nonnegative.
Daily_start_equity berasal dari UTC anchor caller, bukan disimpulkan dari dataset.
Caller tetap bertanggung jawab atas latched breach policy/cooldown/risk enforcement.
M4 tidak mengklaim context tersebut sudah dihitung simulator atau akun exchange.

Builder mengembalikan valid vector atau reason `warm_up`, `gap`, `stale`,
`missing_context`, `missing_artifact`, `incompatible`, `invalid_value`.
Consumer wajib memblokir entry baru bila unavailable. Float32 overflow juga
unavailable; tidak ada fallback zero vector atau auto-fit.

## Normalizer dan artifacts

Fit memerlukan role train dan explicit `[train_start_ms,train_end_ms)` dalam dataset.
Hanya valid market feature rows di rentang itu yang masuk Welford mean/population
variance. Pre-train candle boleh dipakai untuk warm-up, bukan sampel fit. HTF yang
diulang pada main grid dihitung sesuai grid tersebut. Context memakai deterministic
scaling, bukan fitting pada invented portfolio history.

Zero variance memakai scale1 + constant flag. Transform `(x−mean)/scale` tanpa
clipping/refit. Artifact mengikat schema hash/source/symbol dan menyimpan config,
dataset fingerprint, fit range/count serta mean/scale canonical decimal strings.
Dataset baru dengan source/symbol/schema sama dapat ditransform menggunakan artifact
lama; tidak memaksa dataset evaluation sama dengan dataset fit. Jika data di luar
train berubah, statistics tetap sama, tetapi dataset fingerprint/provenance dan
content ID artifact fit baru dapat berubah.

Local paths:

- `artifacts/features/normalizers/<sha256>.json` — payload normalizer, ID=payload hash.
- `artifacts/features/<artifact_id>/observations.f32` — rows*dimension*4 bytes.
- `decisions.jsonl` — satu integer decision timestamp per valid vector.
- `schema.json` dan `manifest.json` — version/layout/hash/config/dataset/source,
  snapshot provenance, context label/file SHA, unavailable counts dan file digests.

Publication menggunakan unique temporary files/directory dan manifest terakhir;
existing ID hanya boleh diverifikasi dengan content identik. Reload memeriksa
schema/content/file hashes, binary size, finite float32 values, timestamps/counts.
Artifacts ignored oleh Git; belum ada registry/backup/multi-machine deployment.

## CLI

Jalankan dari repo root setelah setup/build contracts:

```powershell
.\.tools\node\npm.cmd run features:fit -- --dataset 3717d128-5be2-433f-90dc-ac21d3c35b54 --config packages/contracts/presets/research-small-hybrid-v1.json --train-start-ms 1735689600000 --train-end-ms 1735732800000
.\.tools\node\npm.cmd run features:build -- --dataset 3717d128-5be2-433f-90dc-ac21d3c35b54 --config packages/contracts/presets/research-small-hybrid-v1.json --normalizer e9313eebe60972c72d972987e279757bfd3016b8faca0c3652db06c7a39bcfd9 --context .runtime/features-smoke/context.jsonl
.\.tools\node\npm.cmd run verify:features
```

IDs di atas merujuk artifact lokal smoke, bukan data yang di-commit. Context file
berformat JSONL: baris pertama `{"label":"explicit_caller_context"}`, lalu context
objects strict-schema yang timestamp-nya ascending/unik. Context yang tidak ada
pada decision menghasilkan unavailable. Command fit/build tidak membuat context
account otomatis. Semua context rows divalidasi, termasuk yang tidak terpakai.

Optional source snapshot diperlukan untuk config variant seperti dijelaskan di
atas. Config file boleh raw configuration atau snapshot envelope dengan `id`,
`config_hash`, `configuration` (atau API `configHash`/`payload`); checksum diperiksa. Dataset/normalizer
dipilih melalui validated UUID/SHA, tanpa arbitrary URL. CLI tidak membuka socket,
mengakses credential atau mengubah PostgreSQL.

Explicit bounded smoke jika export M3 lokal tersedia:

```powershell
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_feature_export.py
```

Script membuat context berlabel `synthetic_flat_context_on_public_market_data`,
fit separuh pertama hari, build/replay dengan frozen artifact dan report
`.runtime/features-smoke.json`. Build mencakup semua valid decisions termasuk
close final pada dataset end; report heldout memakai `[midpoint,end)`.
Ini exercise pipeline, bukan backtest, model evaluation atau bukti profit.
