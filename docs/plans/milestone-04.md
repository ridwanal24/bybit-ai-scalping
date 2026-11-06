# Milestone Implementation Plan — M4 Feature Engineering

Tanggal: 6 November 2026, Asia/Jakarta.
Approval status: **Approved** melalui `lanjut` setelah plan disajikan.
Execution status: **Completed**. Seluruh task 4.1–4.17 selesai;
hasil aktual pada [handoff M4](../handoffs/milestone-04.md).

## Current Project State

M0–M3 Completed. Baseline Git `a5a32f3`; working tree bersih saat pemeriksaan.
M3 menyediakan immutable configuration snapshots, dataset revisions, quality gate,
fingerprint dan chronological JSONL export. Python baru memiliki health command,
structural schema/hash tests dan checker export; belum ada perhitungan fitur.

Verification terakhir yang tercatat pada [handoff M3](../handoffs/milestone-03.md):
135 tests lulus, migration/schema checks lulus, public BTCUSDT 1 Januari 2025 UTC
menghasilkan 1440 candle 1m, 288 candle 5m, 96 candle 15m dan 3 funding events.
Ini evidence terdahulu, bukan test yang dijalankan ulang saat menyusun plan ini.

M2 sudah mendefinisikan 23 feature IDs, 7 position inputs, 4 risk inputs, periods,
ordered enabled features dan observation window. Semuanya harus dihormati oleh
runtime Python. Structural JSON Schema saja belum mencakup semantic cross-field
rules M2; parity ini diselesaikan sebelum configuration dipakai menghitung fitur.

## Objectives

Satu pipeline Python menghasilkan fitur dan observation berversi dari data candle
tertutup dengan nilai, urutan, shape dan waktu ketersediaan yang teruji. Normalizer
dipasang sebagai immutable artifact hasil fit pada rentang train eksplisit saja.
Consumer berikutnya dapat memakai pipeline yang sama tanpa menghitung ulang
indikator atau menafsirkan state position/risk dengan aturan berbeda.

## Scope

Seluruh task 4.1–4.17, seluruh 23 feature IDs katalog v1, configurable periods,
main/secondary timeframe, warm-up, strict dataset/config validation, feature schema,
train-only normalization, context position/risk dan ObservationBuilder.
CLI offline menggunakan snapshot/config terverifikasi dan export M3; dataset asal
tidak dimutasi. Artifact hasil riset berada di ignored `artifacts/features/`.

Implementasi pertama dipakai historical/batch dan prefix replay. Public Python
interfaces menerima closed-candle events dan as-of context agar M11 dapat memakai
algoritma yang sama. Kesetaraan batch/prefix diuji; koneksi feed dan optimasi
incremental live tetap pada M11.

## Out of Scope

Simulator, portfolio accounting, risk engine yang mengambil keputusan trading,
action masking, Gymnasium, training/model, automatic experiment split M8, WebSocket,
dashboard, worker protocol M8/M11, private API atau order exchange. Tidak melakukan
download baru, fitting pada validation/test/live, migration DB, perubahan safety
limits, perubahan snapshot lama atau full-year performance claim.

## Dependencies

- M2: configuration validator, canonical hash, catalog/periods dan snapshot export.
- M3: final READY dataset, manifest/file checksums, source/availability policy dan
  chronological last-trade streams. QUALITY_FAILED atau BUILDING ditolak.
- Gunakan CPython 3.12.12 dan standard library untuk arithmetic float64, Decimal
  parsing, streaming, hashing, rolling state dan float32 conversion. Tidak perlu
  NumPy, pandas, TA-Lib atau library ML untuk scope ini.
- Jadikan `jsonschema` dependency runtime karena schema akan divalidasi oleh CLI,
  bukan tests saja. Pertahankan versi terkunci yang ada (4.26.0) dan transitives;
  update pyproject/uv.lock tanpa upgrade dependency lain. Node stack tetap.

## Proposed Architecture

### Contracts dan semantic configuration parity

Tambahkan contracts untuk feature catalog/formula version, ordered feature schema,
normalizer manifest, position/risk context, observation result dan artifact manifest.
Export JSON Schema + conformance fixtures melalui pipeline M2/M3 yang ada.
Configuration v1 dan compatibility classifier lama tetap kompatibel; observation
contract memiliki version sendiri dan hash explicit.

Python memvalidasi struktur serta seluruh semantic checks yang relevan dari
`validateConfiguration`, dengan Decimal/exact comparison untuk field konfigurasi.
Golden cases generated dari validator TypeScript memuat valid/invalid dan semantic
issue field/code; negative vectors mencakup semua cabang semantic checks. Python
harus menolak bool sebagai integer, unsafe timestamps, unknown fields dan
nonfinite JSON. Hash canonical configuration tetap identik dengan M2.

### Dataset loader dan waktu keputusan

Promosikan checker export M3 menjadi reusable runtime loader; tests menggunakannya
tanpa menyimpan dua implementasi. Verifikasi fingerprint, file hashes/counts,
identity/source/symbol/timeframe, urutan unik, OHLC/volume dan coverage. Nama file
dari manifest harus confined ke direktori dataset; tolak path traversal, file
tak sesuai dan oversized records. Funding/mark/index tidak menjadi fitur volume.

Dataset snapshot provenance diverifikasi. Config feature variant boleh memakai
dataset yang sama bila symbol, main/required secondary streams, range dan sumber
kompatibel; simpan hash config input dan snapshot asal secara terpisah. Jangan
memerlukan hash penuh identik hanya untuk feature ablation, atau mengubah snapshot
asal. Warm-up terbatas pada data yang benar-benar tersedia di export.

Decision timestamp adalah close main candle. Untuk setiap row historis, pilih
HTF terbaru dengan `available_at_ms <= decision_ms`; historical policy mengikuti
closed-candle assumption M3. Kesamaan boundary diizinkan bila kedua candle sudah
tersedia. Live caller kelak wajib memasok availability aktual, bukan menganggap
timestamp close menjamin candle sudah diterima.

Join tidak memakai candle HTF yang masih berjalan, nearest-future join, backfill
awal atau interpolasi. HTF yang seharusnya sudah tersedia tetapi hilang dianggap
stale/invalid. Mutasi/penambahan candle masa depan tidak boleh mengubah prefix
features/observations. Gap/reset membutuhkan warm-up kontigu baru; tidak forward
fill melewati gap. Timestamp context tidak boleh lebih baru dari decision.

### Formula catalog v1

Seluruh formula didokumentasikan dan diekspor sebagai metadata berversi; gunakan
period dari config, bukan hanya default preset.

| Feature IDs | Definisi yang akan diimplementasikan |
| --- | --- |
| log_return, percentage_return | ln(Ct/Cprev), Ct/Cprev−1 |
| body_ratio, upper_wick_ratio, lower_wick_ratio | Signed (C−O)/range; (H−max(O,C))/range; (min(O,C)−L)/range |
| range_fraction, close_location | (H−L)/C; (C−L)/(H−L), zero-range body/wicks=0 dan location=0.5 |
| rolling_return | Ct/C(t−rolling_return_period)−1 |
| ema_fast_distance, ema_slow_distance, ema_long_distance | C/EMA(period)−1 |
| ema_spread, ema_slope | (EMAfast−EMAslow)/C; EMAfast(t)/EMAfast(t−1)−1 |
| rsi | Wilder average gain/loss; hasil 0–100, flat=50, gain-only=100, loss-only=0 |
| macd_line, macd_signal, macd_histogram | Raw-price EMAfast−EMAslow, EMA signal atas raw line, line−signal |
| atr, atr_fraction | Wilder smoothed true range; ATR/C |
| volatility | Population standard deviation log returns dalam rolling period; tanpa annualization |
| volume_change | Vt/Vprev−1; denominator nol menghasilkan unavailable |
| relative_volume | Vt / mean volume periode sebelumnya, current dikecualikan |
| volume_ma_ratio | Vt / mean volume rolling yang mencakup current |

EMA memakai SMA seed setelah period candle, lalu alpha=2/(period+1). Wilder RSI
memerlukan period perubahan close; ATR seed mean period true ranges dengan
previous close tersedia. MACD signal baru warm setelah cukup valid MACD lines.
Seed, first-valid index, window inclusion dan zero-denominator policy dikunci oleh
fixtures hitung manual, bukan mengikuti default library secara implisit.

Internal float64 dipakai untuk fitur; sumber decimal/financial config tetap exact
sampai batas konversi yang eksplisit. Tolak hasil nonfinite/overflow, jangan silently
clip atau zero-fill warm-up. Toleransi numerik golden vectors dinyatakan per jenis
hasil; ledger/accounting bukan tanggung jawab float pipeline ini.

### Observation layout dan context

Market matrix `[W,F]` mengikuti urutan `features.enabled` persis, row tertua ke
terbaru. Flatten row-major lalu append current position inputs dan current risk
inputs sesuai urutan array config. Dimension = `W*F + P + R`. Preset sekarang:
32*9+7+4 = **299**. Context tidak direplikasi ke masa lalu dalam window.

Schema mencatat ordered names/timeframes, formula/period versions, W/F/P/R,
layout/dtype float32, context scaling, timestamp policy dan hash. Jika declared
`network.input_dimension` tersedia harus cocok dengan actual dimension; guard
parameter budget juga diperiksa terhadap actual shape ketika deklarasi null.
Reordering atau period/normalization changes mengubah compatibility identity.

Position/risk context berasal dari caller yang eksplisit as-of, bukan dihitung
dari future trades atau dibuat seolah account nyata. Input menyediakan state,
mark/reference price, entry/quantity, SL/optional TP, equity/initial capital,
margin, duration bars, high-water/daily anchors dan status risiko yang diperlukan.
Validasi FLAT/LONG/SHORT consistency dan nonnegative/range/finite constraints.

Scaling context v1: side −1/0/+1; unrealized PnL / initial capital; duration /
max_holding_bars; signed distance (mark−SL)/mark dan (TP−mark)/mark; absolute
notional / initial capital; available margin / initial capital; drawdown fraction,
remaining daily budget / initial capital, trading_allowed 0/1, risk_per_trade.
FLAT memiliki nol pada field khusus posisi; TP absen pada AI_EXIT menjadi nol
dengan applicability ditentukan config. Jangan clip duration atau margin agar
pelanggaran tidak disembunyikan. Definisi input budget/anchors mengikuti semantics
M2, tetapi evaluasi breach/latched decisions tetap milik simulator/risk engine M5.

ObservationBuilder mengembalikan valid observation atau structured unavailable
reason (warm-up, gap, stale, missing context/artifact, incompatible, invalid value).
Unavailable berarti consumer harus memblokir entry baru; tidak menerbitkan vector
zero sebagai observation valid. Tidak mengizinkan exposure/order melalui CLI.

### Train-only normalizer dan artifact

Fit API memerlukan role `train` serta rentang `[train_start,train_end)` eksplisit,
dibatasi dataset. Statistik hanya dari valid market feature rows dengan decision
di rentang itu; pre-train candle boleh untuk warm-up saja. HTF values yang berulang
dihitung sesuai main decision grid. Context memakai deterministic scaling di atas,
tidak memakai invented position history sebagai sampel fit.

Gunakan streaming Welford mean/variance population, per ordered market column.
Zero variance memakai scale=1 dan flag constant; transform (x−mean)/scale, tanpa
adaptive refit/clipping. Tolak empty fit, nonfinite statistics atau mismatch
schema/source. Validation/test/live transform wajib artifact yang sama; tidak ada
fallback auto-fit. Perubahan nilai di luar train tidak mengubah statistics.

Artifact mencatat dataset fingerprint, feature schema hash, config provenance,
train range/count, algorithm/numeric version, means/scales/constant flags dan
checksums. Statistical values diserialisasi sebagai canonical decimal strings
untuk hashing lintas bahasa; binary32 output disimpan little-endian dengan file
SHA256. Content-addressed ID dan create/verify semantics mencegah overwrite
artifact berbeda. ID artifact baru dicatat terpisah ketika config snapshot masih
memiliki artifact_id=null; jika config menyebut ID, wajib exact match.

CLI menulis via temp file/rename dan manifest terakhir, dengan bounds/range/count
metadata serta unavailable counts. Streaming window/rolling state tidak menampung
seluruh histori ke RAM. Config yang valid tetapi period terlalu besar untuk data
menghasilkan warm-up unavailable, tidak mengalokasikan array sebesar period itu.

## Task Breakdown

| Task | Deliverable dan urutan kerja |
| --- | --- |
| 4.12 Feature schema | Awal: formula catalog, layout/context/artifact contracts, JSON schemas, conformance vectors |
| Prasyarat M4 | Python structural + semantic config parity, reusable verified dataset loader |
| 4.1–4.2 | Price returns dan candle features dengan explicit edge policies |
| 4.3–4.6 | Seeded EMA, Wilder RSI, MACD, ATR dan golden vectors |
| 4.7–4.8 | Rolling volatility, volume changes/relative/MA ratio |
| 4.9–4.10 | Closed-HTF as-of alignment, availability/gap/warm-up state |
| 4.11 | Train-scoped frozen zscore artifact, load/verify/transform |
| 4.13–4.14 | Validated position/risk context dan deterministic scaling |
| 4.15–4.16 | ObservationBuilder, shape/order/dtype/hash/compatibility validation |
| 4.17 | Unit/conformance/prefix/fault/E2E/regression, docs dan handoff |

## Files Expected

- `packages/contracts/src/features.ts`, `src/index.ts`, export script, schemas dan
  fixtures/tests untuk feature/observation/normalizer serta semantic conformance.
- `services/quant/src/bybit_quant/configuration.py`, `dataset.py`, `features/`
  (catalog/indicators/alignment/normalization/schema), `observation.py`,
  artifact I/O helpers dan `__main__.py` CLI subcommands.
- `services/quant/tests/test_configuration_contract.py`, `check_dataset_export.py`,
  feature/observation/artifact/integration tests dan independent golden fixtures.
- `services/quant/pyproject.toml`, `uv.lock`, root `package.json`,
  `scripts/tasks.mjs` dan bounded smoke/verification helper bila diperlukan.
- README, architecture, configuration, operations, testing, decisions, progress,
  roadmap, `docs/features.md` dan `docs/handoffs/milestone-04.md`.

Proposed commands: `npm run verify:features` (offline suite + M1–M3 regression),
`npm run features:fit -- --dataset UUID --config FILE --train-start-ms N --train-end-ms N`,
`npm run features:build -- --dataset UUID --config FILE --normalizer ID --context FILE`.
Dataset UUID harus resolve di artifact root M3; tidak menerima URL arbitrary.
Build context berisi explicit chronological as-of rows; smoke memakai labeled
synthetic FLAT context, sehingga bukan klaim accounting atau live integration.

## Database Changes

Tidak ada model/migration baru. Snapshot/dataset M2/M3 tetap immutable. Artifacts
lokal + manifests cukup untuk M4; experiment/model registries tetap pada milestone
terkait. DB integration regression memakai cluster test terisolasi seperti M3.

## Tests

- Manual/reference golden vectors untuk seluruh 23 IDs; rising/falling/flat,
  zero-range/volume, period=1 bila valid, first-valid seed, overflow/invalid input.
- Generated TS/Python semantic conformance mencakup setiap cross-field rule;
  exact canonical hashes/schema export drift dan Unicode/numeric edge cases.
- HTF close equality, still-open exclusion, unavailable/stale/gaps, UTC boundaries,
  future mutation invariance dan full batch versus prefix replay.
- Fit menolak non-train role/range, out-of-train mutation invariance, zero variance,
  load round-trip, constant flags, missing/tampered/reordered/mismatched artifacts.
- Semua enabled features masuk; feature/context permutations mengubah layout/hash;
  exact 299 default dimension, alternate subsets/windows, declared/actual mismatch,
  float32 finite conversion, FLAT/LONG/SHORT, missing TP dan invalid context.
- E2E fixture export M3 → verified loader → fit/train-range → frozen transform →
  observation/artifact reload dengan stable hash/counts; corruption/path cases gagal.
- Bounded local smoke dari export publik M3 jika tersedia dan checksum valid:
  first half hari sebagai explicit fit range, second half transform-only. Ini
  exercise pipeline, bukan split/evaluation model atau klaim predictive performance.
  Jika export lokal tidak ada, laporkan smoke itu belum dilakukan, jangan download
  diam-diam; fixture E2E tetap mandatory.
- `verify:features`: build/typecheck/lint/format/export drift, seluruh TS/Python tests
  dan M1–M3 isolated PostgreSQL/HTTP/migration regressions. Report ke ignored
  `.runtime/features-report.json`; evidence aktual dicatat terpisah dari rencana.

## Acceptance Criteria

1. Semua task 4.1–4.17 selesai; seluruh 23 feature IDs benar terhadap independent
   vectors, dengan seed/warm-up/zero handling terdokumentasi.
2. Tidak ada future leakage HTF, normalization atau state context; prefix invariant
   dan train-only mutation tests lulus.
3. Ordering/dimension/dtype/schema stabil dan semua enabled inputs benar masuk;
   unavailable memblokir observation valid, tanpa silently zero-fill.
4. Immutable normalizer/artifact checksums dan config/dataset provenance dapat
   direproduksi; mismatch/corruption ditolak.
5. Python semantic configuration parity dibuktikan sebelum runtime computation.
6. Offline E2E dan M1–M3 regressions lulus; limitations/performance evidence jujur,
   docs/progress/handoff lengkap, berhenti sebelum M5.

## Risks & Tradeoffs

Seed/rolling policies dapat berbeda dari library indikator lain: formula version
dan golden vectors menjadi authority. Pure Python mengurangi dependency, tetapi
throughput full-year belum dibuktikan; ukur bounded smoke time/counts tanpa janji
latency live. Floating point berbeda platform perlu toleransi numerik dan explicit
output format; hash membuktikan artifact identity, bukan bitwise portability semua
transcendental functions di setiap platform.

Warm-up HTF mengurangi usable range dan tidak boleh diganti dengan future fill.
M3 tidak mengambil extra prehistory otomatis. Historical availability/current
instrument metadata/funding limitations M3 tetap dibawa; M4 tidak menjadikannya
bukti execution readiness. Context contract mempersiapkan M5/M11, tetapi belum
membuktikan accounting, risk enforcement atau safety exchange.

## Approval Status

**Approved** melalui `lanjut`, 6 November 2026. Sesuai
[PROJECT_SPEC.md](../../PROJECT_SPEC.md) §2.1 dan §41, approval diberikan setelah
plan disajikan. Approval mencakup seluruh task M4, dependency runtime yang dijelaskan,
tests/isolated DB regression dan bounded local smoke; tidak perlu ACC per task.
