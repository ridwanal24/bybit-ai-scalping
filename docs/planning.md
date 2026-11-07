# Planning Milestone 0

Tanggal: 5 November 2026, Asia/Jakarta. Pelaksanaan planning disetujui melalui
`eksekusi milestone 0`. Hasil planning diterima melalui `oke ku approve` pada
5 November 2026. Rancangan belum merupakan fitur atau persetujuan transaksi.
Sumber utama: [PROJECT_SPEC.md](../PROJECT_SPEC.md).

## Requirement dan batas hasil

M9 diimplementasikan melalui `lanjut eksekusi M9`,7 November2026;
[plan](plans/milestone-09.md) dan [guide](evaluation.md) menetapkan preregistered
multi-seed/expanding WFO, paired baselines, fee/slippage/RR counterfactuals,
exploratory exit/feature/architecture retraining dan verified reports/curves.
Conservative research gates minimum3 seeds/2 folds/30 OOS days/30 trades per seed,
PF>=1.1/positive all-seed and stress returns/beat HOLD+EMA/no risk breach dibekukan
sebelum outcome. Frozen final holdout once-only dengan overlap checks tersedia;
public satu hari belum eligible dan tidak membuka holdout. Tidak ada model
promotion/dashboard/orders. M10 memerlukan instruksi berikutnya.

M8 diimplementasikan melalui `gas eksekusi m8`,7 November2026;
[plan](plans/milestone-08.md) dan [guide](training.md) membekukan CPU Small training,
chronological70/15/15/train-only preprocessing, masked validation/final candidate,
save-load/provenance dan bounded persistent jobs. Public smoke1024steps/2epochs/
1thread/env/max180s/3072MiB ditetapkan sebelum run, dua seed42 repeats. Holdout
tidak dievaluasi dan risk/cost/preset tidak dituning pada M8.

M7 diimplementasikan melalui `lanjutkan eksekusi M7`,7 November2026;
[plan](plans/milestone-07.md) dan [guide](rl-environment.md) membekukan shared
incremental timeline, current-information masks, net equity/initial reward,
raw Gymnasium termination/truncation dan explicit absorbing settlement adapter.
Tidak ada training M8 atau perubahan risk defaults/normalizer/source data.

Checkpoint M6 diimplementasikan7 November2026 melalui instruksi
`oke lanjutkan eksekusi Milestone 6`; [plan M6](plans/milestone-06.md) dan
[baseline guide](baselines.md) menetapkan four-policy shared simulator,
constrained perpetual Buy & Hold reference, exact net metrics/undefined reasons
dan immutable replay/comparison. Ini bounded existing public-export verification,
bukan full-year/OOS efficacy, RL atau exchange execution. Tidak mengubah defaults
risk, original config/snapshot, normalizer atau restrictions M5.

| Requirement / bagian spesifikasi | Hasil dan batas | Milestone |
| --- | --- | --- |
| 1–5, 38, 41–45: workflow, maintenance | Satu milestone per approval, progress, ADR, handoff, bukti test | Semua |
| 6–9: platform dan mode | Backend/Python/frontend, mode terisolasi, real disabled | M1–M15 |
| 10, 12–13: konfigurasi/model | Validasi silang, immutable snapshot, schema compatibility; Small awal | M2, M8–M10 |
| 11, 14: data/features | Data valid berversi, no leakage, pipeline observasi bersama | M3–M4 |
| 15–18: simulator/accounting/exit | Simulator Python tunggal, biaya dan event ordering eksplisit | M5 |
| 19–22: baseline/RL/training | Baseline dahulu, Gymnasium/MaskablePPO, CPU smoke, masked evaluation | M6–M8 |
| 23–25: evaluation/registry/gates | OOS, sensitivity, multi-seed, holdout, promosi manual | M8–M10, M14 |
| 26–31: risk/safety/orders/ownership | Risk independen, durable intent, idempotency, reconciliation | M5, M11–M14 |
| 32–33: Demo/Real | Actual Demo lifecycle; Real dry-run lalu izin dana terpisah | M13–M15 |
| 34: dashboard | Konfigurasi, job, hasil dan monitor dari backend, bukan mock live | M10–M15 |
| 35: optimization | Optuna setelah basic pipeline stabil | M16 scope terpisah |
| 36–37: storage/recovery/testing | Audit, artifact manifest, failure injection, regression | Bertahap |
| 39–40: phase/roadmap | Checkpoint end-to-end tanpa menggabungkan unit approval | [Roadmap](roadmap.md) |

Simulation MVP (M1–M6): Bybit linear USDT perpetual, BTCUSDT, closed candle 1m,
secondary 5m/15m sesuai ketersediaan, satu posisi LONG/SHORT/FLAT, historical
simulator, baseline dan laporan accounting. Tidak ada RL atau exchange execution
yang wajib berjalan pada checkpoint M6. Target histori satu tahun jika tersedia;
smoke run menggunakan subset kecil dan quality gate yang sama.

RL proof of concept M7–M8 menambah MaskablePPO MlpPolicy Small actor/critic [64,64],
seed, save/load dan valid actions. Profit bukan kriteria kelulusan teknis training.
Research platform M9–M10 menambah evaluasi lanjutan dan dashboard. Medium/Large dan
custom architecture tetap requirement konfigurasi/validasi, tetapi eksperimen
arsitektur diperluas setelah Small terbukti; tidak dihapus dari roadmap.

Paper M11 adalah akun virtual internal dengan data publik real-time. Demo M13
adalah order API pada akun Demo Bybit. Real M15 tetap target wajib dengan gate
operasional terpisah. Testnet opsional, bukan pengganti Demo.

Default penelitian dari spesifikasi: capital 1.000 USDT, risk/trade 0,5%, satu
posisi, daily loss 2%, max drawdown 10%, ATR14 × 1,5, exit Hybrid. Leverage,
minimum/maksimum stop, RR numerik, fee dan slippage belum ditetapkan sebagai
default final. Nilai tersebut wajib eksplisit dan valid sebelum run; jangan
mengisi asumsi akun secara diam-diam. Martingale, averaging down, stacking,
multi-pair model, online retraining dan distributed training di luar MVP.

## Timeline simulator yang diusulkan

M5 kini merealisasikan rancangan ini dalam approved `restricted_bar_v1`;
detail yang dibekukan pada [plan M5](plans/milestone-05.md) dan
[simulation](simulation.md). Market-only/last/1x, exposure50%, declared funding
boundary schedule dan collateral envelope adalah batas eksplisit; intrabar
settlement dan exchange liquidation realism ditolak. Funding/metadata historical
validity belum terbukti. Tidak ada approval baseline/RL atau order dari M5.

Rancangan ini dibekukan dan diuji pada M5 untuk supported restricted policy sebelum RL. Timestamp candle adalah
open time; candle meliputi `[t, t + interval)`. `available_at` sekurang-kurangnya
close time; simulasi harus memakai metadata latency bila dikonfigurasi. Higher
timeframe hanya boleh dipakai sesudah candle tersebut tersedia.

1. Pada close bar k, proses seluruh event bar k dan nilai equity pada harga
   referensi yang tersedia. Bangun observation tanpa data bar k+1.
2. Agent mengusulkan action; mask dan risk menolak action yang tidak sah. Intent
   mengacu observation timestamp, snapshot dan intended execution time.
3. Market intent paling awal fill pada open bar k+1, dengan adverse spread/slippage.
   Ini asumsi bar model berlatensi nol, bukan bukti fill live pada harga open.
   Latency tambahan menggeser fill ke kesempatan berikutnya; dilarang backfill.
4. Pending exit dan trigger gap untuk posisi lama diselesaikan konservatif: stop
   yang telah terlewati pada open didahulukan, lalu exit yang masih relevan.
   Exit/stop duplikat tidak menghasilkan fill kedua.
5. Entry divalidasi ulang terhadap equity, stop, rounding, margin dan instrument
   constraints pada harga fill; entry gagal tidak membuka posisi. Stop harus
   langsung melekat pada posisi virtual yang berhasil dibuka.
6. Funding pada timestamp yang diketahui dibukukan ke posisi yang ada tepat
   sebelum timestamp itu. Pada batas yang sama, funding posisi lama diproses
   sebelum close/open baru. Ini konvensi simulasi, wajib diuji dan dibandingkan
   dengan semantics exchange pada milestone integrasi.
7. Proses intrabar SL/TP posisi aktif. Jika keduanya tersentuh dan urutannya tidak
   diketahui, SL lebih dahulu. Gap stop memakai open yang lebih buruk ditambah
   biaya; TP tidak mendapat price improvement tanpa data pendukung. Trigger
   memakai seri harga yang dikonfigurasi; mark/last tidak dipertukarkan.
8. Pada close, mark portfolio, hitung biaya/equity, periksa holding/risk limits,
   catat events, lalu reward dan observation berikutnya. Limit yang terdeteksi
   pada close tidak memicu fill retroaktif; forced exit dijadwalkan ke next
   available execution dan entry baru diblokir.

Urutan aktual menggunakan timestamp event: funding intrabar tidak dipindah ke
akhir bar; posisi yang sudah ditutup sebelum settlement tidak dikenai funding.
Jika urutan settlement dan trigger intrabar tidak dapat diketahui dari OHLC,
gunakan skenario konservatif dan tandai ambiguity pada laporan. Dataset tidak
memadai untuk trigger reference yang diminta harus ditolak atau run diberi batas
validitas yang eksplisit, bukan disamakan dengan last price.

Episode tidak melintasi split. Entry pada interval terakhir dilarang. Untuk posisi
tersisa, gunakan terminal settlement pada harga close terakhir yang tersedia,
adverse exit cost, dan label `terminal_settlement` (asumsi evaluasi, bukan fill
historical yang terbukti); biaya masuk equity dan reward terakhir. Alternatif
reserve liquidation bar hanya boleh dalam split yang sama. Risk breach/bankruptcy
adalah termination; batas panjang/sumber data adalah truncation, dengan settlement
policy dan bootstrap semantics yang diuji pada M7. Data gap tidak disambung
seolah-olah market kontinu; reject/segment dan catat alasan.

## Accounting dan reward

Konvensi linear USDT: `s = +1` LONG, `s = -1` SHORT; `q >= 0`; harga entry rata-rata
`pe`; harga mark `pm`. Funding credit positif, debit negatif.

```text
gross_realized_on_close = s * q_closed * (exit_price - pe)
unrealized = s * q_remaining * (pm - pe)
wallet = initial_capital + cumulative_gross_realized
         - cumulative_fees + cumulative_funding_cashflow
equity = wallet + unrealized
available_margin = equity - initial_margin_used - reserved_margin - safety_buffer
peak_equity = max(previous_peak, equity)
drawdown = (peak_equity - equity) / peak_equity, untuk peak_equity > 0
```

Slippage/spread sudah tercermin dalam fill price; jangan didebit lagi sebagai fee.
Biaya tersebut boleh dilaporkan terpisah sebagai attribution dibanding reference.
Margin adalah collateral terikat, bukan expense. Fee entry langsung mengurangi
wallet. Fee exit didebit sekali. Realisasi PnL disertai pengurangan unrealized
quantity yang sama agar tidak double count. Partial fills menghitung weighted
entry dan fee per execution; total closed quantity tidak boleh melebihi posisi.

Reward awal yang diusulkan: `r_t = (E_next - E_previous) / E_initial`, dengan
`E_initial > 0`, tanpa risk shaping awal. Ini perubahan equity yang dinormalisasi
capital episode, bukan return compounded. Jumlah reward sama dengan net return
episode setelah semua biaya/settlement. Equity nonpositif memicu terminal state;
tidak menggunakan log pada equity nonpositif atau membagi equity sebelumnya yang
bisa nol. Risk penalty tambahan membutuhkan versi reward dan validasi tersendiri.

Contoh walkthrough aritmetika (bukan hasil test aplikasi): capital 1.000, LONG
q=1 pada 100, fee entry 0,1 → wallet 999,9. Mark 105 → unrealized 5, equity
1.004,9. Exit 105 dengan fee 0,105 → wallet/equity 1.004,795, unrealized 0,
net PnL 4,795. SHORT q=1 entry 100 exit 95 dengan biaya 0,1 + 0,095 memberi
net PnL 4,805. HOLD tanpa posisi/biaya/funding menghasilkan reward 0.

Quantity sizing: budget = equity × risk fraction; cari quantity step terbesar
yang tidak melebihi budget setelah stop distance, estimasi entry/exit fee dan
adverse slippage, lalu cek minimum quantity/notional, tick size, exposure dan
margin. Round quantity ke bawah; stop/TP rounding direction harus menjaga batas
risiko dan dihitung ulang, bukan diasumsikan netral. Margin leverage tidak
mengurangi PnL loss per unit. Fee/funding aktual dapat membuat loss melewati
estimasi; stop tidak menjamin kerugian maksimal saat gap.

Full liquidation model belum tersedia. Keputusan approved M5: reject run yang
memerlukan exchange liquidation realism, leverage selain1, order selain market
atau reference selain last. Entry exposure/margin dibatasi50% equity, biaya/risk
tetap divalidasi. Adverse collateral breach menghasilkan diagnostic invalid run,
bukan invented liquidation fill. Stress tests dan restrictions dibawa ke artifact;
hasil restricted tidak cukup untuk promosi Real. Funding memakai declared boundary
schedule + last-open proxy; intrabar settlements ditolak.

## Strategy risk dan exit

Risk Python untuk historical dan risk NestJS untuk live memiliki specification
serta fixtures bersama; conformance gate wajib sebelum Paper/Demo. Model tidak
dapat menonaktifkan hard SL, exposure cap, daily loss atau max drawdown.

Usulan daily loss: equity termasuk unrealized dan biaya, anchor equity pertama
yang valid pada/setelah 00:00 UTC, disimpan persisten. `loss_fraction =
(day_start_equity - equity) / day_start_equity`; ambang >= limit melatch block
entry dan menjadwalkan close posisi milik bot. External cashflow tidak didukung
MVP: deposit/withdrawal selama run menyebabkan block dan review anchor, bukan
perubahan performa strategi. Reset hari tidak menghapus drawdown/emergency latch.

Drawdown memakai high-water equity sejak awal run/deployment. Pada breach,
block entry + controlled reduce-only close posisi bot; pembukaan kembali
memerlukan review/reset eksplisit. Risk close tetap membutuhkan account/ownership
valid; bila koneksi gagal, pertahankan stop, block, alert dan rekonsiliasi.
Timezone reset UTC adalah usulan desain untuk review, bukan hard safety limit
yang telah diimplementasikan. Batas risiko numerik tetap sesuai spesifikasi.

| State / mode | HOLD | OPEN_LONG/SHORT | Discretionary close |
| --- | --- | --- | --- |
| FLAT | Valid | Jika risk/safety mengizinkan | Invalid |
| LONG | Valid | Invalid | CLOSE_LONG pada AI Exit/Hybrid |
| SHORT | Valid | Invalid | CLOSE_SHORT pada AI Exit/Hybrid |
| Fixed RR | Valid | Sesuai state dan gate | Invalid; forced exits tetap aktif |

Actions tetap 0 HOLD, 1 OPEN_LONG, 2 OPEN_SHORT, 3 CLOSE_LONG, 4 CLOSE_SHORT.
Mask `true` berarti valid. AI Exit: hard SL, tanpa fixed TP implisit dari RR.
Fixed RR: SL + TP, tanpa AI discretionary close. Hybrid: SL + TP + early exit.
HOLD selalu tersedia; mask bukan pengganti pemeriksaan risk sebelum order.

## Operational safety dan order lifecycle

| Kondisi | Respons yang dirancang |
| --- | --- |
| Candle stale/gap, warm-up kurang, observation invalid, inference timeout | Block entry; proteksi posisi tetap bekerja |
| REST timeout atau status order unknown | Jangan retry create membabi buta; query client ID/order/executions, rekonsiliasi |
| WS disconnected, clock drift, DB unavailable | Block entry; backfill/account sync dan durable audit sebelum resume |
| Partial fill | Catat tiap execution, lindungi filled quantity, kelola remainder tanpa entry duplikat |
| Missing stop | Block entry, coba pulihkan dengan state terverifikasi; controlled reduce-only close bila proteksi gagal; alert |
| Unknown/manual position atau mismatch | RECONCILING/BLOCKED; jangan ambil alih atau flatten posisi manual |
| Restart | Load state, query exchange, reconciliation, cek stop/model/data/activation; Real tetap nonaktif |

Threshold stale/timeout/clock drift ditentukan dengan latency budget M11/M12;
tidak menebak angka untuk akun live di M0. Jika write state gagal setelah submit,
state dianggap unknown walau respons HTTP sukses. Proteksi exchange yang sudah
ada tidak dicabut saat inference atau database gagal.

Order intent disimpan sebelum submission, memiliki unique client ID dalam
namespace environment/account/deployment. Satu active intent per operasi/simbol
MVP. Lease/lock dan unique constraints mencegah dua worker submit entry bersamaan.
Transport retry aman hanya untuk read; create retry memerlukan bukti order
sebelumnya tidak ada sesuai capability exchange, bukan sekadar timeout lokal.

```text
Position: FLAT | LONG | SHORT
Operational: READY -> PENDING_ENTRY/PENDING_EXIT -> RECONCILING -> READY
             setiap state -> BLOCKED/EMERGENCY
Order: INTENT -> SUBMITTING -> ACKNOWLEDGED -> PARTIALLY_FILLED -> FILLED
       -> REJECTED/CANCELLED/EXPIRED; timeout -> UNKNOWN -> reconciliation
```

Ini model konseptual; ACK bukan fill, CANCELLED dapat memiliki partial executions.
Event duplikat/out-of-order diproses idempotent memakai execution/event ID dan
rekonsiliasi cumulative quantity. Stop yang bertanding dengan close tidak boleh
membalik posisi; reduce-only dan verifikasi exposure wajib. Tetapkan taksonomi
status/terminal transition per adapter pada M12 dengan fixtures exchange.

Bedakan Stop New Entries, Cancel Pending Entries, Disable Strategy dan Emergency
Flatten. Emergency flatten hanya posisi bot yang kepemilikannya terverifikasi;
stop dipertahankan sampai flat dikonfirmasi atau pengganti terkonfirmasi. Perintah
emergency harus diaudit; permintaan bukan bukti account sudah flat.

Usulan ownership: dedicated bot account/subaccount, one-way single symbol.
Startup mengidentifikasi order/position/executions tak dikenal. Prefix client ID
saja tidak cukup membuktikan kepemilikan aggregated position. Foreign activity
menyebabkan block dan review manual. Tidak ada auto-adopt posisi manual.

## Kontrak konseptual dan reproducibility

Semua payload memuat `schema_version` dan correlation/identity yang sesuai. Detail
field wajib dan validasi diimplementasikan bertahap, bukan mengunci API lengkap M0.

| Kontrak | Isi minimum dan invariant | Gate |
| --- | --- | --- |
| Candle | source/category/symbol/interval, open/close/available time, OHLCV, closed; OHLC valid, key unik | M3 |
| FeatureVector | schema ID, ordered names, as-of/available time, finite values, warm-up validity | M4 |
| Observation | model/schema, window, shape/dtype, normalization ID, position/risk context, as-of | M4/M7 |
| AgentAction | action 0–4, observation time/hash, model ID, mask, decision ID | M7/M11 |
| TradingConfiguration | market, risk, exit, costs, features, network, train; snapshot/hash immutable | M2 |
| ModelMetadata | data/split, features/actions, preprocessing, network, seed, code/dependency versions | M8 |
| RiskDecision | allowed/blocked, reason codes, evaluated account/version/config, sized quantity | M5/M11 |
| OrderIntent | environment/account/deployment, client ID, side/qty/type, reduce-only, stop/TP, reference time | M11/M12 |
| OrderStatus | client/exchange ID, lifecycle, cumulative filled, updated time, raw source provenance | M12 |
| PositionState | owner/account/environment/symbol, side/qty/average, margin, stop, reconciliation version | M5/M12 |
| Execution | unique execution ID, order, time, qty/price/fee/currency, liquidity | M12 |
| EvaluationResult | run/model/baseline, split/range, assumptions, metrics with undefined reasons, report artifact | M6/M9 |

Metadata compatibility mencakup pair/timeframe, feature ordering/window/dtype,
normalization artifact, action schema, SL/RR/exit/risk, network dan training
snapshot. Perubahan schema/shape menyebabkan reject load. Perubahan behavior
memerlukan backtest ulang dan mungkin retraining; model tidak otomatis compatible
karena shape sama. Perubahan simulator/reward membuat evaluasi lama perlu review.

Dataset fingerprint, manifest, code commit (dan dirty-tree marker/hash bila ada),
lockfiles, runtime versions, hardware/thread settings dan seed disimpan. Repeatability
CPU diuji pada lingkungan yang dipin; seed saja bukan jaminan identik lintas mesin.
Split default 70/15/15 kronologis. Warm-up boleh menggunakan data masa lalu sebelum
split, tanpa fitting ulang dan tanpa membawa posisi/PnL lintas split. Purge/embargo
ditentukan dari feature horizon/label/episode overlap. Final holdout tidak dipakai
untuk tuning; reuse menuntut holdout baru atau pengungkapan eksplisit.

Promosi Candidate → Validated → Paper Approved → Demo Approved → Real Approved
memerlukan bukti bertahap, approval manual dan audit. Numeric gate belum ada pada
M0; M9 kini membekukan research screen dan independent final holdout gates sebelum
hasil, lihat [evaluation](evaluation.md). Hasil negatif tetap disimpan dan public
smoke belum eligible. Real juga memerlukan M14 readiness dan izin dana terpisah.

## Risiko, pertanyaan terbuka dan penyelesaiannya

Owner `agent + reviewer` berarti agent menyiapkan alternatif/bukti dalam milestone
terkait, pengguna memutuskan hal material. Tidak ada blocker pelaksanaan M0.

| ID | Risiko / belum jelas | Usulan atau mitigasi | Owner; deadline |
| --- | --- | --- | --- |
| R01 | OS deployment, CPU/RAM/disk tersedia | Development Windows saat ini; satu mesin CPU, benchmark dan resource budget eksplisit | Agent + reviewer; M1/M8 |
| R02 | Runtime/ORM/schema validator compatibility | Pilih versi didukung, cek dokumentasi resmi, lock dependency; belum install M0 | Agent; M1/M2 |
| R03 | Data gap/revision/history/funding tak tersedia | Quality report, immutable export, reject/segment, jangan fabricate | Agent; M3 |
| R04 | Look-ahead dan HTF availability | Timestamp availability, train-only fitting, future perturbation tests | Agent; M4/M7 |
| R05 | OHLC ambiguity, gap, latency, liquidation | Conservative fills, stress fixtures, restricted validity envelope | Agent + reviewer; sebelum acceptance M5 |
| R06 | Fee/leverage/RR/SL limits belum final | Config wajib eksplisit; numeric defaults ditetapkan sebelum run, bukan akun live tersirat | Agent + reviewer; M2/M5 |
| R07 | Daily loss reset, external cashflow, breach action | Equity basis, UTC dan latching diusulkan; finalisasi sebelum risk implementation | Agent + reviewer; M2/M5, conformance M11 |
| R08 | Reward hacking/double counting | Net equity delta, ledger invariants, deterministic scenarios | Agent; M5/M7 |
| R09 | Resource training dan cancellation | Satu worker awal, bounded smoke, checkpoints dan failure recovery | Agent; M8 |
| R10 | Statistical overfit dan evidence belum cukup | Numeric research/holdout gates dipraregistrasi M9; public24h insufficient, perlu histori/OOS memadai sebelum promotion review | Agent + reviewer; M9 evidence lalu review berikutnya |
| R11 | Dashboard exposure/auth dan secret storage | Local-only awal; auth review sebelum remote exposure, no secrets in client/log | Agent + reviewer; M10–M12 |
| R12 | Inference transport/stale/clock/timeout thresholds | Ukur latency; persistent service hanya bila perlu, fail closed untuk entry | Agent; sebelum acceptance M11/M12 |
| R13 | Account mode, ownership, stop/capability mismatch | Dedicated account usulan; capability validation dan unknown activity block | Agent + reviewer; M12/M13 |
| R14 | Duplicate, partial fill, restart, DB/exchange divergence | Durable intent, unique IDs, execution dedupe, reconciliation/fault injection | Agent; M12–M14 |
| R15 | Backup, disk loss, artifact/DB inconsistency | Manifest/checksum, restore test dan startup block | Agent; M8/M11, wajib sebelum M13 |
| R16 | Real capital, activation/limits, incident response | Tidak diputuskan M0; readiness + separate explicit operational approval | Pengguna + agent; M14/M15 |

Keputusan berisiko tinggi yang belum terselesaikan memblokir gate terkait, bukan
diselesaikan diam-diam. M5 dan M10 cukup besar: ukur scope saat menyusun plan;
usulkan split sekali sebelum implementasi bila perlu, tanpa mengubah ID/approval
roadmap sepihak.

## Referensi eksternal

Diperiksa 5 November 2026; periksa ulang saat implementasi, bukan pin versi dari
halaman dokumentasi bergerak.

- [Bybit Demo Trading Service](https://bybit-exchange.github.io/docs/v5/demo):
  Demo memiliki batas capability; private WS Demo berbeda dari public mainnet,
  dan WS Trade tidak didukung pada dokumentasi yang diperiksa. M12/M13 harus
  menyimpan capability matrix dan bukti lingkungan aktual.
- [MaskablePPO](https://sb3-contrib.readthedocs.io/en/master/modules/ppo_mask.html):
  gunakan evaluator/callback yang mendukung masking dan kirim action mask saat
  inference. Jangan mengandalkan evaluator SB3 standar tanpa masking.
- [Gymnasium Env](https://gymnasium.farama.org/api/env/): `reset` menghasilkan
  observation/info; `step` membedakan terminated dan truncated. Wrapper M7
  harus menjaga semantics episode sesuai simulator.
