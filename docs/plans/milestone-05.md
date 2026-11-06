# Milestone Implementation Plan — M5 Trading Simulator

Tanggal: 6 November 2026, Asia/Jakarta.
Approval status: **Approved** melalui `kerjakan` setelah plan disajikan.
Execution status: **Completed**; hasil pada [handoff M5](../handoffs/milestone-05.md).
Scope seluruh task5.1–5.27 dalam satu milestone;
urutan internal di bawah tidak memerlukan approval per task.

## Current Project State

M0–M4 Completed. Baseline Git `24b0263`; working tree bersih saat pemeriksaan.
M1 menyediakan local runtimes/API/PostgreSQL, M2 configuration/snapshots/contracts,
M3 immutable market export dan M4 causal features/normalizer/ObservationBuilder.
Simulator, portfolio ledger, risk enforcement dan model belum tersedia.

Audit M1–M4 dan perbaikannya selesai: final-attempt cooldown disimpan, main candle
availability serta dependent rows dihormati. Verification terakhir yang dibaca:
6 November2026 20:01:21–20:03:10 WIB,290 tests lulus; local public-export smoke
1185 vectors x299 dan artifact identik. Ini evidence sebelumnya, bukan suite yang
dijalankan ulang saat planning M5. Detail: [testing](../testing.md),
[handoff M4](../handoffs/milestone-04.md).

## Objectives

Satu simulator historical Python dapat memproses posisi LONG/SHORT, biaya,
SL/TP/discretionary/forced exits, funding, margin dan strategy risk dengan event
ordering deterministik. Ledger, trade history dan equity dapat direkonsiliasi;
semua hasil menyatakan assumptions/restrictions, tanpa klaim futures realism penuh.
Simulator ini menjadi engine tunggal baseline M6, environment M7 dan evaluator.

## Scope

Seluruh task5.1–5.27: market/portfolio/position/intent state; exact ledger, fills,
sizing/rounding, biaya, seluruh exit modes M2, funding dan margin validation;
restricted liquidation envelope, equity/trade history, daily loss/drawdown,
cooldown/max holding, terminal settlement, deterministic runner dan integration.

Input: config/snapshot terverifikasi, final READY export M3, frozen normalizer M4,
explicit episode range, declared research policies dan scripted action callback/
action file. Simulator membangun context dari ledger dan memanggil ObservationBuilder
M4. Action baru hanya dari observation valid; forced/protective exits tetap aktif
saat observation unavailable. Scripted fixtures bukan baseline strategy atau model.

## Out of Scope

Baseline comparison/metrics suite M6, Gymnasium/action-mask API/reward optimization
M7, RL/training/jobs/model registry, dashboard, streaming feed, private API/order,
Paper/Demo/Real, production exchange risk tiers atau live liquidation engine.
Tidak mengubah snapshot/config schema v1, numeric safety limits atau data sumber.
Tidak ada download baru atau full-year benchmark otomatis.

## Dependencies

- Reuse M2 semantic validator/canonical hashes, M3 verified streaming loader/source
  provenance dan M4 indicator/normalizer/ObservationBuilder. Kedua audit fixes
  menjadi regression wajib, tidak dihapus atau dilonggarkan.
- CPython3.12.12 standard library `decimal`, dataclasses, enums dan streaming I/O;
  jsonschema4.26.0 runtime yang ada. Tidak menambah NumPy/pandas/Gym/ML dependency.
- Additive simulation schemas/fixtures di @bybit/contracts dan export drift checks;
  CLI subprocess lokal seperti M4, tanpa backend job infrastructure baru.

## Proposed Architecture

### Capability gate dan restricted operating envelope

Run request memakai `simulation_policy_version=restricted_bar_v1` dan explicit
acknowledgement bahwa results hanya synthetic historical research. Gate sebelum
run harus memeriksa config, dataset/source/range, instrument observation,
normalizer/schema dan seluruh restriction berikut:

| Aspek | Dukungan / restriction M5 |
| --- | --- |
| Market/state | Linear USDT perpetual, satu simbol, satu posisi, FLAT/LONG/SHORT |
| Execution | Config order_type=market, mode=backtest; limit/market mode lain ditolak |
| Trigger/valuation | Last-price OHLC saja; config mark/index ditolak, tidak diganti diam-diam |
| Leverage | Config max_leverage harus1; tidak silently clamp config leveraged |
| Exposure | Entry notional <= min(config cap,50% equity pre-entry), margin fraction <= min(config limit,0.5) |
| Liquidity | Full virtual fill pada modeled price; tanpa partial fills/order book atau market-impact realism |
| Fees | Market/trigger/forced fills memakai configured taker fee; maker/rebate disimpan sebagai provenance, tidak dikenakan pada market fill |
| Instrument rules | Pinned current observation sebagai declared research constraints; historical validity tetap unverified dan harus diakui |
| Funding | Declared schedule wajib; settlements harus aligned ke main-bar boundaries |
| Data continuity | Required streams/range kontigu, tanpa bridging missing intervals atau posisi lintas split |

Envelope50%/1x adalah additional restriction simulator, bukan perubahan hard limit
trading pengguna atau model liquidation Bybit. Initial margin=entry notional/1.
Free collateral dan safety reserve diperiksa pada open, funding/fill/close dan
adverse candle extreme untuk posisi yang terekspos. Long memakai low, short high.
Jika extreme dapat menembus collateral envelope, run ditandai invalid
`restricted_envelope_breached`; simpan diagnostic ledger, jangan tampilkan sebagai
backtest futures yang berhasil atau memilih stop fill untuk menyembunyikannya.
Pemeriksaan konservatif ini dapat menolak candle ketika urutan extreme/stop tidak
diketahui. Nonpositive equity dicatat tanpa clipping dan menghentikan run.

Maintenance margin tiers, mark-price liquidation dan liquidation fee belum
dimodelkan. Request yang memerlukan realism itu ditolak. Bahkan run yang lolos
envelope bukan bukti tidak akan liquidated pada exchange dan tidak cukup untuk
promosi model/live. Ini menutup task5.18 lewat documented restrictions + stress tests.

### State, ledger dan exact arithmetic

`Simulator` memegang MarketState (available closed data), PortfolioState (wallet,
equity/margin), PositionState (side,qty,entry,SL,TP,entry time/bar), RiskState (UTC
day anchor/high-water/latches), dan pending Intent (decision/availability/due time,
action/reason/ID). Action IDs0–4 mengikuti spec; bukan implementasi Gym/mask M7.
Tidak stacking, averaging down, reversal atomik atau close lebih dari quantity aktif.

Ledger memakai local Decimal precision128, decimal strings di wire. Currency
quantum1e-18 USDT: debit dibulatkan ke atas, credit ke bawah; signed realized PnL
dibulatkan ke bawah. Rounding dicatat dalam numeric policy v1. Quantity/tick memakai
instrument step; financial value tidak memakai float. ATR berasal dari indicator
M4 yang tersedia pada decision, dikonversi lewat decimal repr secara eksplisit;
ATR conversion/version disimpan dan diuji pada tick boundaries.

Untuk side s=+1 LONG/−1 SHORT, qty q>=0:

```text
gross_realized = s*q*(exit_price-entry_price)
unrealized = s*q_remaining*(valuation_price-entry_price)
wallet = initial_capital + sum(realized) - sum(fees) + sum(funding_cashflow)
equity = wallet + unrealized
available_margin = equity - initial_margin_used - reserved_margin - safety_reserve
drawdown = max(0,(peak_equity-equity)/peak_equity)
```

Margin adalah collateral, bukan expense. Entry fee langsung didebit; closing
menghapus unrealized quantity yang sama ketika realized dibukukan. Spread/slippage
sudah berada dalam fill price, tidak didebit lagi. Funding positif berarti wallet
credit. Fees/funding/PnL/fill masing-masing menghasilkan immutable event dengan
sequence deterministik; satu intent/position close tidak boleh menghasilkan dua fills.

### Fills, sizing dan protective levels

Adverse modeled fill: buy=reference*(1+spread/20000+slippage/10000), sell=reference*
(1−spread/20000−slippage/10000); reject nonpositive result. Buy round tick up, sell
round down. Semua fills market-like memakai taker fee dan instrument min/max qty,
minimum notional serta config exposure/margin limits.

Entry intent membekukan ATR/decision provenance, bukan membaca ATR bar execution.
Pada actual next open, tentukan entry fill dan rebase protective levels dari
entry menggunakan frozen ATR*multiplier. LONG SL round ke tick di atas raw SL,
SHORT SL ke bawah; pastikan SL tetap di sisi loss dan rounded stop fraction berada
di configured min/max. Invalid distance ditolak, tidak di-clamp diam-diam.
Fixed TP: entry ± RR*rounded stop distance, dibulatkan menjauhi entry agar target
gross RR tidak berkurang. AI_EXIT tidak membuat TP dari RR.

Risk budget=pre-entry equity*risk_per_trade. Cari quantity step terbesar yang
memenuhi budget setelah rounded distance dan biaya worst modeled stop exit.
Per-unit risk memakai stop distance + max(modeled round-trip fee,configured fee
allowance) + max(modeled stop adverse price move,configured slippage allowance).
Ini conservative sizing estimate, bukan actual fee debit kedua. Quantity floor
ke step, lalu cek ulang fee, free collateral/min margin, notional, instrument
constraints dan envelope. Gunakan closed-form caps/monotonic reduction, bukan
unbounded loop tiap step. Below minimum atau tidak feasible → rejected intent.
Funding/gap tetap dapat membuat realized loss melebihi estimated stop budget.

### Event timeline v1

Candle `[open,close)`. Observation pada close k hanya memakai data available<=close k.
Intent fill paling awal pada open bar k+1 dengan open timestamp>=decision availability
+run execution_latency_ms. Default latency0 adalah declared bar assumption; equal
close/open boundary boleh, late data tidak memperoleh retroactive open fill.

Urutan setiap main-bar boundary/open:

1. Mark posisi lama memakai current open; jika UTC date berganti, anchor equity
   baru diambil sebelum funding timestamp itu. Reset daily latch saja; drawdown
   latch/high-water tidak direset. Anchor pertama memakai initial equity yang valid.
2. Funding pada boundary dibukukan ke posisi yang ada tepat sebelum timestamp;
   posisi yang baru akan dibuka belum membayar event tersebut.
3. Risk/margin gate dan existing gap stop diproses; stop yang telah terlewati
   memakai adverse open fill. Pending close yang masih relevan berikutnya.
4. Entry intent due divalidasi ulang dengan current portfolio/price/stop/margin;
   jika posisi sudah ditutup di boundary itu, tidak ada otomatis reentry/reversal.
5. Selama bar, periksa SL/TP dari OHLC. Bila keduanya tersentuh, SL dahulu.
   TP gap tidak mendapat improvement: reference tetap TP, dengan adverse costs.
6. Pada close, mark portfolio, reconcile ledger/equity, update sampled high-water/
   daily loss/max holding, lalu buat context dan observation M4. Forced close
   dijadwalkan untuk kesempatan eksekusi berikutnya, bukan backdated close.

Open/close/funding/fill valuation memakai informasi pada tahap tersebut. High-water
tidak dinaikkan memakai intrabar high/low seolah urutannya diketahui. Adverse
extreme hanya untuk trigger/envelope, bukan fitur/entry sizing sebelumnya. Seluruh
ambiguity/tie policy masuk report. Duplicate close/protection intent dibatalkan
ketika posisi sudah FLAT; exit precedence mencegah double fee/PnL.

### Funding dan metadata limitations

M3 memberikan actual signed rate/timestamp, bukan historical funding mark price
atau bukti lengkap jadwal. Run policy menyertakan declared UTC schedule segments
`{start_ms,end_ms,interval_ms,anchor_ms}`. Historical mode wajib exact event coverage
terhadap declared schedule; missing/extra event gagal gate, tidak zero-fill.
Schedule tetap berlabel researcher-declared, bukan exchange-verified historical
cadence. Bounded public smoke memakai deklarasi8 jam khusus periode itu dan
acknowledgement restriction; tidak mengasumsikan interval terkini benar setahun.

Funding cashflow=−s*q*boundary last open*rate, dengan last sebagai explicit proxy
valuation, bukan mengaku funding mark exchange. Fixed_rate mode juga memerlukan
declared schedule dan memakai rate config. Intrabar settlement yang tidak aligned
ke main boundary ditolak sebelum run, bukan dipindah ke close atau diberi harga
interpolasi. Timeframe/request yang tidak memenuhi ini unsupported untuk M5.
Schedule/proxy/restriction fingerprint disimpan, sehingga assumptions berbeda
menghasilkan run identity berbeda.
Cashflow episode hanya memproses funding dalam `[episode_start,episode_end)`;
terminal settlement di end tidak mengambil event funding milik interval berikutnya.

### Risk, exit modes dan terminal policy

- Daily loss memakai equity termasuk unrealized/costs dan UTC day anchor M2.
  Breach>=limit melatch block entry untuk hari itu dan menjadwalkan controlled
  close. Remaining daily budget=max(0,day_start_equity*daily_limit−max(0,day_start−equity)).
- Drawdown memakai sampled run high-water; breach melatch seluruh run, menjadwalkan
  close lalu termination. UTC rollover tidak menghapus latch ini. Tidak ada reset
  diam-diam; external cashflow/foreign position input ditolak.
- Max holding menjadwalkan forced exit; cooldown bars dihitung sejak exit sampai
  elapsed bars memenuhi configured cooldown. Revalidate semuanya di execution.
- AI_EXIT: hard SL + discretionary close, tanpa TP. FIXED_RR: SL+TP, discretionary
  close ditolak. HYBRID: SL+TP+discretionary close. Forced exit aktif di semua mode.
- HOLD selalu diterima. Invalid/script duplicate/out-of-order actions dilaporkan
  tanpa mutasi portfolio. Entry saat observation unavailable atau final interval
  ditolak; protections/forced exits tetap jalan.
- Episode dibatasi satu explicit range/split. Prehistory boleh warm-up features,
  bukan membawa posisi/cashflow dari episode lain. Pending intents dibatalkan pada
  akhir range; posisi tersisa disettle pada last close dengan adverse exit cost
  dan reason `terminal_settlement`, tanpa membaca bar berikutnya.
- Data/length boundary adalah truncation; risk/bankruptcy termination. Report
  memakai reason/status sendiri; Gymnasium reward/bootstrap semantics tetap M7.

M4 context berasal dari ledger current, tidak dari file synthetic FLAT. Normalizer
tetap frozen; tidak auto-fit saat simulation. Unavailable context pada terminal
nonpositive equity tidak dipaksakan menjadi vector valid.

## Task Breakdown

| Task | Deliverable / urutan internal |
| --- | --- |
| 5.1–5.3 | Typed Market/Portfolio/Position state, contracts, capability/episode policy gate |
| 5.4–5.7 | Exact long/short PnL, entry/exit ledger, invariant reconciliation |
| 5.8–5.11 | Fee/spread/slippage, tick/qty rounding, risk-aware sizing/caps/rejection |
| 5.12–5.15 | Hard SL, fixed TP, AI close, Hybrid dan conservative precedence |
| 5.16 | Declared funding schedule, boundary cashflows, intrabar/missing rejection |
| 5.17–5.18 | Initial/free margin, restricted1x/50% envelope, stress invalidation |
| 5.19–5.22 | Equity/trade history, UTC daily latch, high-water drawdown, forced exits |
| 5.23–5.24 | Episode settlement, scripted deterministic runner, frozen M4 observations |
| 5.25–5.27 | Event ordering/accounting regressions, fixture/public-export E2E, docs/handoff |

## Files Expected

- `packages/contracts/src/simulation.ts`, index/export script, simulation request/
  policy/event/trade/equity/report schemas dan shared risk/accounting fixtures/tests.
- `services/quant/src/bybit_quant/simulation/`: state, decimal policy, ledger,
  fills/sizing, risk, funding, engine/runner, artifact/report export dan CLI.
- M4 reusable dataset/features/context helpers bila perlu refactor kecil; schemas
  configuration lama dan source data tetap immutable.
- Quant unit/event/accounting/integration tests dan explicit local smoke helper.
- Root package/tasks untuk `simulation:run`, `verify:simulation`; README,
  architecture, planning/ADR, testing, operations, progress/roadmap,
  `docs/simulation.md`, `docs/handoffs/milestone-05.md`.

Proposed CLI: `npm run simulation:run -- --request FILE`. Request menyebut dataset
UUID, config/snapshot files, optional verified source snapshot untuk variants,
normalizer SHA, action file, episode range dan explicit policies/acknowledgements.
Action file berisi ascending unique decision timestamp+action ID, bukan arbitrary
Python module dari user. Python callback interface internal dipakai fixtures/M6.

Outputs di ignored `artifacts/simulations/<content_id>/`: request/provenance,
events/trades/equity JSONL, observation/rejection counts, report dan checksums.
Content ID mencakup config/dataset/normalizer/script/policies/code/numeric versions;
execution time/temporary path hanya metadata. Exclusive atomic publication dan
reload verification mengikuti M4; rejected/invalid run harus jelas bukan success.
Code fingerprint dihitung dari relevant runtime modules, contract schemas dan
lockfile hashes; bukan hanya Git HEAD. Input path diganti verified content/ID
dalam descriptor hash agar absolute path mesin tidak mengubah identity hasil.

## Database Changes

Tidak ada model/migration baru. Immutable local simulation artifacts cukup untuk
M5; run/job registry backend berada pada milestone terkait. Regression M1–M4 tetap
memakai isolated test PostgreSQL, tanpa memodifikasi development dataset/config.

## Tests

- Hand-calculated LONG100→105 dan SHORT100→95 fee examples dari planning; losses,
  flat equity, entry/exit fee sekali, unrealized→realized tanpa double count,
  margin release, signed funding, currency/tick/quantity rounding boundaries.
- Sizing across risk/fee/slip/margin/minimum/exposure caps; rejected entry tidak
  membayar fee atau membentuk posisi. Frozen ATR/qty keputusan versus gap open.
- Stop/TP single/both touch, stop gap, TP gap tanpa improvement, pending close vs
  protection, no reentry same boundary, all exit modes, invalid/duplicate actions.
- Funding before close/open pada timestamp sama, posisi baru/FLAT, signed debit/
  credit, declared schedule gaps, fixed rate dan explicit intrabar rejection.
- UTC day reset vs funding/fee, unrealized daily breach, latch setelah recovery,
  drawdown tidak reset antar hari, max holding/cooldown, external cashflow rejection.
- Unsupported leverage/limit/mark/index, invalid metadata/series/range; margin and
  adverse-envelope stress, bankruptcy tanpa clipping/fake liquidation fill.
- Prefix/future mutation: identical intents/fills sebelum future change, no entry
  memakai execution-bar ATR/close, latency/delayed main/HTF unavailable, next-open
  equality dan actual delayed availability tidak backfill harga open yang lewat.
- Terminal settlement sekali, pending cancellation, no final-interval entry,
  no cross-split portfolio/prehistory costs; ledger sum/trade/equity reconciliation
  dan byte-identical deterministic artifact rerun.
- Fixture E2E: verified M3 export → frozen M4 features/observation → scripted
  entry/exit → ledger/artifacts → reload. Cases wajib mencakup actual simulated
  LONG dan SHORT, bukan hanya run FLAT yang dianggap cukup.
- Explicit bounded local public-export smoke jika artifact M3 tersedia: preset,
  existing frozen normalizer, declared8h schedule/last-price proxy/current-metadata
  acknowledgement, scripted actions pada available decisions. Ini synthetic
  simulation di data publik, bukan baseline/model evaluation atau live fills.
- `verify:simulation`: build/typecheck/lint/format/export drift, all unit/Python/
  isolated PostgreSQL/HTTP/migration regressions M1–M4 + simulator tests; report
  `.runtime/simulation-report.json`. Existing500ms DB timeout flake dicatat bila
  berulang, bukan dihapus atau diam-diam mengubah production timeout.

## Acceptance Criteria

1. Seluruh task5.1–5.27 selesai dan enam acceptance criteria spec M5 terbukti:
   long/short accounting, costs, SL/TP ordering, no known look-ahead, deterministic
   runner dan consistent trade/equity history.
2. Financial ledger exact dan traceable; hand calculations dan reconciliation
   invariants lulus, termasuk funding/fees/terminal settlement.
3. Shared M4 pipeline dipakai dengan ledger-generated context; disabled/unavailable
   observation tidak menghasilkan entry, sementara protective exits tetap aktif.
4. Unsupported requests/envelope breach ditolak atau invalid secara eksplisit;
   current metadata, declared funding schedule dan restricted liquidation tidak
   disajikan sebagai exchange realism atau model/live readiness.
5. LONG/SHORT fixture E2E, deterministic replay, relevant regressions/static/schema
   checks lulus; docs/progress/ADR dan handoff lengkap. Berhenti sebelum M6.

## Risks & Tradeoffs

M5 besar tetapi masih satu cohesive engine; internal urutan di atas menjaga
accounting/event gate sebelum runner. Bila implementasi membutuhkan scope di luar
restrictions yang disetujui, laporkan blocker, jangan melonggarkan model diam-diam.

OHLC hanya menunjukkan range, bukan path/fill/latency. SL-first, last funding proxy,
conservative envelope dan rejected intrabar settlements mengurangi dukungan config
namun membuat keterbatasan teruji. Historical funding schedule/current instrument
rules belum menjadi bukti history exchange. Latency0/market full-fill adalah
assumptions; tidak ada klaim stop menjamin max loss atau results siap live.

Exact Decimal ledger tetap menerima float64 ATR dari feature engine; numeric
boundary dan version dicatat, platform tolerance M4 tetap relevan. Full-year
throughput belum dibuktikan; smoke dibatasi dataset lokal24h. RL/baseline efficacy
belum dinilai dan tidak menjadi target keberhasilan M5.

## Approval Status

**Approved** melalui `kerjakan`,6 November2026. Sesuai
[PROJECT_SPEC.md](../../PROJECT_SPEC.md) §2.1 dan §41, approval diberikan setelah plan. Approval
mencakup seluruh task5.1–5.27, restricted envelope/policies di atas, regression,
bounded local smoke dan dokumentasi; tidak membutuhkan ACC per task.
