# Restricted historical simulator M5

Scope mengikuti [approved plan M5](plans/milestone-05.md), disetujui `kerjakan`
pada6 November2026. Engine Python tunggal ini memproses posisi virtual dan exact
ledger, bukan mengirim order exchange. [Baseline M6](baselines.md) kini memakai
engine/runner yang sama. [Gymnasium/reward M7](rl-environment.md) memakai
incremental session yang sama; [training M8](training.md) kini memakai engine ini.

## Batas validitas yang wajib diakui

Run request harus menyertakan policy `restricted_bar_v1` dan semua acknowledgements
research/current metadata/declared funding schedule. Request ditolak bila meminta
exchange liquidation realism. Batas lainnya:

| Aspek | Implementasi M5 |
| --- | --- |
| Config | backtest, linear USDT perpetual, satu simbol/posisi |
| Fill | market full-fill saja; limit ditolak |
| Price | last OHLC untuk fill, trigger, valuation; mark/index ditolak |
| Leverage | tepat1x; tidak silently clamp config lain |
| Entry exposure | min(config max notional,50% pre-entry equity) |
| Entry margin | min(config max margin fraction,0.5)*equity |
| Funding | declared schedule, main-bar boundary saja, last open sebagai proxy price |
| Instrument | pinned current observation; historical applicability unverified |
| Liquidation | tidak dimodelkan; hanya conservative collateral envelope |

Full synthetic fill tidak membuktikan liquidity/market impact. Maintenance tiers,
mark liquidation price dan liquidation fees belum tersedia. Jika adverse extreme
yang mungkin dialami posisi menembus free collateral/safety reserve, run menjadi
`invalid` (`restricted_envelope_breached` atau `bankruptcy`). Diagnostic ledger dan
posisi yang belum ditutup tetap disimpan, tanpa invented liquidation/stop fill.
Guard extreme didahulukan dari ambiguous intrabar stop, sehingga dapat menolak
skenario ketika urutan extreme/stop tidak diketahui. Run yang lolos pun bukan
bukti tidak akan liquidated di exchange dan bukan model/live readiness.

## Ledger dan costs

Semua financial values memakai Decimal precision128. Money events memakai
quantum1e-18 USDT; credit turun, debit naik, signed realized PnL turun. Wire format
decimal string canonical. ATR risk memakai output closed-candle Indicators M4,
diubah dari repr float64 ke Decimal pada batas yang eksplisit. Ledger tidak memakai
float. Toleransi/portability ATR M4 tetap relevan pada tick boundary.

```text
gross_realized = side*quantity*(exit-entry)
unrealized = side*remaining_quantity*(reference-entry)
wallet = initial + realized - fees + funding_cashflow
equity = wallet + unrealized
initial_margin = ceil_currency(quantity*entry)   # leverage1
available_margin = equity - initial_margin - safety_reserve
```

Margin tidak didebit sebagai expense. Pending intent tidak mereservasi margin
(`reserved_margin=0`), karena hanya satu pending intent dan sizing/revalidation
dilakukan pada fill. Entry fee didebit segera; exit mengubah unrealized ke realized
sekali lalu mengenakan exit fee sekali. Reconciliation memeriksa cumulative ledger
dan closed-trade/remaining-position fees/funding.

Buy fill = reference*(1+spread_bps/20000+slippage_bps/10000), tick up; sell fill
memakai minus dan tick down. Nonpositive modeled fill ditolak. Spread/slippage
sudah tercermin dalam fill, tidak menjadi fee kedua. Semua fills market-like
memakai configured taker fee; maker/rebate tidak dipakai. Source fees tetap
synthetic research assumptions M2, bukan tarif akun nyata.

Sizing mencari maximum feasible quantity step melalui bounded binary search,
dengan risk budget, modeled stop loss/cost allowance, fee affordability,
exposure/margin dan instrument min/max constraints. Qty tidak dibulatkan ke atas.
Min available margin merupakan entry floor setelah fees/collateral/reserve;
ongoing envelope memeriksa free collateral>0. Invalid/too-small entry tidak membuat
posisi atau membayar fee. Funding/gap dapat melampaui estimated stop risk budget.

SL memakai frozen ATR decision, direbase dari actual next-open entry fill. LONG
SL tick ke atas dan SHORT SL ke bawah, lalu stop distance divalidasi lagi terhadap
min/max config. TP menjauhi entry untuk target gross RR. Actual realized gross RR
dan net RR setelah biaya/funding dilaporkan terpisah. AI_EXIT tidak menghasilkan
TP/target RR implicit meskipun field RR config masih terisi.

## Event ordering dan risk

Decision memakai closed data/valid M4 observation. Intent hanya dapat fill pada
open berikutnya yang timestamp-nya>=decision+execution_latency_ms. Default0
merupakan assumption zero latency bar model; close k dan open k+1 boleh memiliki
UTC timestamp sama. Open yang sudah lewat tidak di-backfill.

Pada boundary/open:

1. Mark posisi lama pada open, reset UTC daily anchor sebelum funding bila hari berganti.
2. Funding dibebankan ke posisi yang sudah ada tepat sebelum boundary; posisi baru belum membayar.
3. Risk/envelope gate, gap SL lalu gap TP capped target, kemudian forced/pending exit.
4. Pending entry due divalidasi ulang; tidak stacking/reversal atau reentry otomatis setelah close di boundary itu.

Intrabar: adverse envelope check, lalu hard SL/TP. Double touch selalu SL dulu.
Gap stop memakai worse open; TP gap tidak mendapat improvement. Existing gap TP
juga mendahului discretionary close untuk mencegah optimistic tie pada open.
Actual trigger time intrabar tidak diketahui: bookkeeping memakai bar close dengan
phase `intrabar`. Pada timestamp close/open sama, urutan journal membedakan
intrabar position yang telah closed dari posisi lama yang masih membayar funding.
Tidak mengklaim guessed tick execution time.

Pada close: mark equity, update sampled high-water/day loss, cek max holding,
buat ledger context dan M4 observation. High/low tidak dipakai menaikkan peak
seolah path diketahui. Forced exit karena close breach dijadwalkan ke open
berikutnya; protective exits tetap aktif ketika observation unavailable.

Daily loss mengacu UTC day-start equity termasuk unrealized/fees; breach>=limit
melatch block entries sampai rollover. Recovery tidak membuka latch. Remaining
budget=max(0,anchor*daily_limit−max(0,anchor−equity)); budget numerik dapat pulih,
tetapi trading_allowed tetap false ketika latch aktif. Drawdown memakai run
high-water, tidak reset antar hari; breach menutup posisi secara controlled lalu
termination. Max holding memicu forced close; cooldown dihitung dari exit bar.
External cashflow/foreign position injection tidak didukung.

HOLD selalu diterima. OPEN_LONG/SHORT hanya ketika FLAT, valid observation dan
risk/cooldown mengizinkan. CLOSE_LONG/SHORT harus cocok dengan posisi dan hanya
AI_EXIT/HYBRID; FIXED_RR menolak discretionary close, tetapi forced exit tetap
aktif. Duplicate/out-of-order/invalid scripted decisions ditolak atau tercatat
sebagai rejection, tanpa portfolio mutation.

## Funding, episode dan observation

Policy menyatakan contiguous UTC schedule segments untuk seluruh requested dataset
range. Historical mode memverifikasi exact timestamps terhadap actual source
records; missing/extra event gagal gate, tidak zero-fill. Declared schedule bukan
bukti exchange history. Fixed_rate memakai rate M2 dan schedule eksplisit,
terpisah dari historical records. Settlement yang tidak aligned main boundary
ditolak, tidak dipindah ke akhir bar atau diinterpolasi.

Funding cashflow=−side*quantity*boundary_last_open*rate, dengan adverse currency
rounding. Harga itu proxy penelitian, bukan historical funding mark price. Event
di luar `[episode_start,episode_end)` tidak dikenakan, termasuk pada end terminal
settlement. Prehistory hanya untuk fitur/normalizer window, tanpa membawa posisi,
fee atau PnL dari episode lain.

Runner memanggil Indicators M4 setelah execution bar selesai, lalu memproses
ordered features dan context dari current ledger. ATR entry dibekukan pada decision,
bukan dibaca dari execution-bar high/low/close. Normalizer tetap frozen. Main/HTF
availability dan seluruh audit regressions M4 dipertahankan; dependent delayed
rows tidak menghasilkan entry. Context float hanya batas input model, bukan ledger.

Pada end, cancel pending intent; posisi disettle pada last close dengan adverse
cost dan reason `terminal_settlement`, tanpa memakai bar berikutnya. Entry di
interval terakhir ditolak. Data/length end adalah truncation; risk termination
dan invalid envelope dibedakan. Gymnasium/bootstrap/reward semantics tetap M7.

## CLI, artifact dan replay

```powershell
.\.tools\node\npm.cmd run simulation:run -- --request .runtime/simulation-smoke/request.json
.\.tools\node\npm.cmd run verify:simulation
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_simulation.py
```

Smoke helper terakhir hanya memakai existing dataset publik M3 dan frozen normalizer
M4, membuat request/script berlabel riset, lalu menjalankan CLI dua kali dan reload
artifact. Tidak ada download/account connection. Script memakai predetermined
alternating sides pada jam6/8/10/12/14/16/18/20 UTC dan close30 menit kemudian;
bukan baseline strategy atau model evaluation.

Request fields: [simulation request schema](../packages/contracts/schemas/simulation-request-v1.schema.json).
Config/action/source-snapshot paths relatif terhadap direktori request, atau
absolute path yang diberikan caller. Dataset hanya melalui validated UUID pada
`artifacts/datasets/`, normalizer SHA pada `artifacts/features/normalizers/`.
Config variant memerlukan verified source snapshot seperti M4. Actions JSONL
berisi `{decision_ms,action}` ascending/unique/aligned, dalam episode range;
tidak menerima user Python modules. Internal callback menerima closed observation
saja untuk fixtures/M6.

Artifacts pada `artifacts/simulations/<content_id>/`:

- `descriptor.json`: normalized config, source/snapshot/normalizer, policies,
  code/dependency fingerprint, actual runtime version/architecture dan action hash.
- `events.jsonl`: sequence/time/phase/kind/reason, amount dan resulting wallet.
- `trades.jsonl`: full-close position, entry/exit/SL/TP, fees/funding/PnL/RR.
- `equity.jsonl`: current valuation, collateral, cumulative costs/PnL dan risk latches.
- `report.json`: status/reason, exact totals, observation/rejection counts dan restrictions.
- `manifest.json`: content references, file counts/checksums dan artifact identity.

Code fingerprint mencakup runtime modules, contract schemas/fixtures, uv lock dan
toolchain; absolute input path/run time tidak masuk content descriptor. Publication
memverifikasi temporary artifact sebelum rename, manifest terakhir, existing ID
hanya boleh diverifikasi dengan content identik. Reload memeriksa hashes/schemas,
event-wallet sums, trade/fee/funding totals, position lifecycle, equity/margin dan
final report. Report/descriptor JSON mempunyai bound2MiB, terpisah dari bound64KiB
per JSONL record. Hash bukan signature atau perlindungan terhadap admin yang
mengganti seluruh artifact dan ID.

CLI exit0 untuk completed/controlled terminated restricted run; exit2 untuk
diagnostic invalid simulation dengan JSON summary/artifact ID; exit1 untuk invalid
request/input. `execution_ready` selalu false. Artifact runtime ignored Git;
registry/jobs/backup/purge belum menjadi kemampuan M5. Tidak ada migration baru.
