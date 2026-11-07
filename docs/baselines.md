# Baseline & Simulation MVP

M6 memakai export M3, frozen normalizer/observations M4 dan simulator M5 tunggal.
Tidak ada network, database, model atau exchange execution pada baseline CLI.

## Menjalankan

```powershell
.\.tools\node\npm.cmd run baseline:run -- --request .runtime/baselines-smoke/request.json
.\.tools\node\npm.cmd run verify:baselines
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_baselines.py
```

Smoke helper membuat request untuk existing public export M3 selama20 jam dari
2025-01-01 04:00 sampai2025-01-02 00:00 UTC. Tidak download atau refit. Dataset dan
normalizer lokal M3/M4 harus sudah tersedia; absence adalah error, bukan skip.
Request root CLI pertama dapat memakai request hasil smoke helper tersebut.

Request mengikuti `baseline-request-v1.schema.json`: sama dengan request simulator
tanpa `actions_file`, ditambah `strategies` (1–32 entries). Semua field tetap wajib:
version1, dataset UUID, configuration file, nullable source snapshot file,
normalizer SHA, explicit episode start/end dan seluruh acknowledgements/policy M5.
Path input relatif terhadap request; output relatif root repository.

```json
[
  {"name":"hold"},
  {"name":"random","seed":42},
  {"name":"ema_crossover"},
  {"name":"buy_hold"}
]
```

Ini nilai field `strategies`, bukan seluruh request. Unknown fields ditolak.
Seed integer0–4294967295 wajib untuk random; strategi lain tidak menerima seed.
Duplicate strategy+seed ditolak; beberapa random seed berbeda diperbolehkan.

## Semantics strategi

HOLD selalu action0. Random memakai instance `random.Random(seed)` lokal,
uniform choice dari HOLD/OPEN_LONG/OPEN_SHORT ketika flat dan entry allowed;
ketika posisi aktif, HOLD/matching close jika exit mode mengizinkan. Risk/sizing,
pending intent, latency dan final interval tetap diperiksa engine; ini bukan
Gymnasium action mask M7. Seed deterministik untuk runtime Python yang tercatat.

EMA memakai `ema_spread=(ema_fast−ema_slow)/close` dari indicator engine M4 pada
main timeframe dengan periods config. Bukan comparison terhadap normalized
observation atau HTF. Semua closed prehistory diproses; gap reset sign/target.
Zero spread tidak mengganti last nonzero sign; sign pertama bukan crossover.
Perubahan nonzero sign menyimpan target baru. Target terbaru dapat menunggu
observation valid/risk gate. Posisi lawan ditutup dahulu, kemudian flat decision
berikutnya mengusulkan entry. Target dikonsumsi saat proposal entry atau saat
posisi sudah searah. Entry rejection tidak retry, protective exit tidak reentry
tanpa crossover baru. Fixed RR menunggu protective/forced exit posisi lawan.

Buy & Hold adalah **constrained perpetual long reference**: satu entry attempt
pada valid eligible decision pertama, lalu HOLD. Rejection menghasilkan zero
trade; posisi yang sudah ditutup tidak dibuka lagi. Hard SL/TP, maximum holding,
daily/drawdown gates, risk sizing, biaya/funding dan terminal settlement berlaku.
Exposure dibatasi<=50%, leverage1; bukan spot Buy & Hold atau exposure100%.
Tidak ada baseline yang mendapat penghapusan biaya atau bypass risk.

Keputusan hanya ketika observation M4 valid, pada close di dalam episode. Candle
execution masa depan tidak masuk keputusan/ATR entry. Warm-up boleh sebelum
episode, tanpa posisi/PnL carry. Normalizer existing frozen, tidak auto-fit.

## Metrics dan comparison

Net profit memakai final equity−initial capital dan direkonsiliasi terhadap total
closed-trade net PnL. Net return adalah fraction capital awal. Trade statistics
memakai PnL net setelah entry/exit fee dan signed funding: win>0, loss<0,
breakeven masuk denominator win rate/expectancy. Average loss bertanda negatif.
Profit factor=sum positive net/sum absolute negative net. Tanpa losing trade
hasilnya null, bukan infinity. Tanpa trade win rate/averages/expectancy null.
Average holding duration adalah arithmetic mean `closed_ms−opened_ms`.

Max drawdown dihitung ulang dari equity points berurutan dan initial capital
sebagai initial peak. Equity/drawdown curves ada pada simulation `equity.jsonl`;
monitoring ini sampled, bukan tick-path. `sampled_exposure` adalah proporsi open
samples dengan posisi aktif. Intrabar exit tidak menyatakan exact duration/path;
exposure bukan time-at-market exchange atau notional percentage. Untuk risk
termination, denominator hanya samples yang benar-benar dijalankan.

Fees/funding adalah total ledger. Spread/slippage ada dalam fill price dan tidak
didebit lagi; separate attribution null dengan reason karena ledger M5 tidak
merekam seluruh reference attribution. Sharpe null karena sampling/annualization
belum ditetapkan. Semua undefined metrics membawa `value:null, reason:string`;
defined metrics memakai decimal string dan reason null. Invalid simulations
menyimpan diagnostic artifacts dan seluruh performance metrics null dengan
`invalid_simulation`, bukan masuk ranking. M6 tidak memilih winner/promosi dan
tidak mengklaim OOS performance dari smoke.

## Artifacts, verification dan exit codes

Evaluator merekam keputusan ke streaming `actions-N.jsonl`, lalu replay memakai
`simulation.artifacts.create_artifact`. Report dua pass wajib identik; ledger
replay diverifikasi mandiri oleh verifier M5. Memory bounded per stream, bukan
menyimpan full-year history dalam list. Full-year throughput belum dibenchmark.

`artifacts/baselines/<comparison_id>/` berisi comparison.json dan action scripts.
ID adalah SHA canonical comparison; simulation IDs mengikat config/data/source/
normalizer/schema/range/policy/code/runtime serta file hashes ledger M5. Seluruh
run harus punya common manifest provenance yang identik kecuali script hashes.
Strategy/seed dan script SHA tersimpan dalam comparison. Publish exclusive/rename
setelah replay/reload, existing ID diverifikasi tanpa overwrite.

`verify_comparison(path, simulations_root)` mengecek outer digest, strict schema,
unique strategies, script SHA/order/range, linked simulation checksums/ledger,
common provenance, status dan metrics dengan recomputation. Hash bukan signature.
Artifact tergantung linked simulations; pindahkan keduanya bersama untuk arsip.

CLI mencetak comparison JSON, exit0 untuk restricted completion/valid risk
termination, exit2 jika ada invalid run (diagnostics tetap disimpan), exit1 dengan
sanitized error untuk request/source/capability/artifact invalid. Return0 bukan
profit atau live-readiness gate. Unsupported market/last/1x restrictions,
researcher-declared funding schedule/last-open proxy, current metadata reference
dan artificial terminal settlement sama dengan [M5](simulation.md).
