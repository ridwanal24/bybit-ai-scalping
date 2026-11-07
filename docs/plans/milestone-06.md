# Milestone 6 — Baseline & Simulation MVP

Tanggal: 7 November 2026, Asia/Jakarta.

## Goal dan approval

Implementasikan task6.1–6.8 PROJECT_SPEC menggunakan simulator M5 tunggal.
Approved melalui instruksi `oke lanjutkan eksekusi Milestone 6`. Instruksi ini
mengizinkan implementasi, regression, local public-export smoke dan dokumentasi
M6. Tidak mencakup M7, training, download baru atau exchange orders.

## Implementation plan

1. HOLD; seeded random dengan pilihan sesuai posisi/exit mode; EMA crossover
   menggunakan EMA fast/slow M4 pada main timeframe; Buy & Hold long reference.
   Seluruh baseline melewati observation availability, frozen normalizer,
   next-open execution, hard SL, sizing, funding dan risk M5 yang sama.
2. EMA mengamati closed bars termasuk prehistory, bertindak hanya ketika
   observation valid. Crossover mengubah pending target; close posisi lawan dahulu,
   lalu entry pada keputusan berikutnya yang flat. Tidak auto-reentry setelah
   stop tanpa crossover baru. Fixed RR tidak memakai discretionary close.
3. Buy & Hold reference mencoba satu entry pada keputusan eligible pertama lalu
   HOLD; tidak menonaktifkan SL/TP/holding/risk atau memakai exposure100%.
   Ini constrained perpetual reference, bukan spot buy-and-hold benchmark.
4. Evaluator menulis deterministic decision script lewat runner M5 lalu replay
   ke artifact simulator M5. Report pass pertama dan replay wajib identik.
   Comparison mengikat strategy/seed, script SHA, simulation ID, config/data/
   normalizer/range/policy/code provenance, tidak memilih winner/promosi.
5. Decimal metrics: net PnL/return, sampled max drawdown, net-trade profit factor,
   win rate, average win/loss, expectancy, holding duration, sampled bar exposure,
   fees/funding; undefined memakai null + reason. Equity/drawdown curve memakai
   existing ledger. Sharpe ditunda dengan reason; slippage attribution terpisah
   tidak tersedia dari ledger M5, biaya sudah terkandung dalam fill.
6. Strict shared request/strategy/metrics/comparison contracts, offline CLI
   `baseline:run`, immutable comparison artifacts dan independent reload.
   Tidak ada dependency/migration atau perubahan config schema v1.
7. Test strategy semantics, exact metric examples/undefined, seeded replay,
   prefix/future boundaries, four-baseline fixture E2E, checksum/provenance
   rejection, CLI, seluruh regression M1–M5, bounded existing public-data smoke.
8. Perbarui guide, README, architecture, ADR, testing, operations, progress,
   roadmap dan handoff dengan actual evidence; berhenti sebelum M7.

## Acceptance dan batas

Historical export M3 → M4 → baseline → simulator → trades/equity/metrics/comparison
berjalan dan replay/reload deterministik. HOLD membuktikan flat zero-return;
fixture menghasilkan trades; zero-trade/negative public results tetap disimpan.
Invalid simulation tidak mendapat performance metrics atau ranking valid.
Restricted market/last/1x/50%, declared funding schedule/current metadata dan
terminal settlement M5 tetap berlaku. Full-year throughput, OOS efficacy,
multi-seed inference dan readiness live bukan klaim M6.
