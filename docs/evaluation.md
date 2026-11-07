# Advanced Evaluation M9

M9 menyediakan evaluasi riset lokal yang dipraregistrasi, bukan aktivasi model.
Semua hasil membawa `execution_ready=false`. Pipeline memakai dataset M3,
features/normalizer M4, ledger/risk M5, baseline M6, environment M7 dan jobs M8.
Tidak ada dependency atau migration baru. Persetujuan: `lanjut eksekusi M9`;
[plan](plans/milestone-09.md), [handoff](handoffs/milestone-09.md).

## Protokol dan commands

```powershell
.\.tools\node\npm.cmd run verify:evaluation
.\.tools\node\npm.cmd run evaluation:register -- --request .runtime/evaluation-smoke/request.json
.\.tools\node\npm.cmd run evaluation:run -- --protocol SHA256_PROTOCOL
.\.tools\node\npm.cmd run evaluation:report -- --report SHA256_REPORT
```

Contoh request lengkap dibuat oleh
`services/quant/tests/smoke_evaluation.py`; menjalankan script tersebut melakukan
training/evaluation sungguhan pada export publik M3 yang harus sudah tersedia.
Script tidak mengunduh data. `evaluation:register` memvalidasi request melalui
[schema](../packages/contracts/schemas/evaluation-request-v1.schema.json), source
snapshot/config, dataset, scope, variants dan budget sebelum menyimpan immutable
protocol. Source snapshot boleh null hanya bila supplied configuration persis
memiliki hash source snapshot export; UUID/hash source tidak dibuat ulang.

Request menyatakan dataset/config/source/policy, range half-open, 3–5 unique
seeds, 2–4 folds, purge bars, explicit enabled feature yang dihapus untuk ablation,
timesteps/rollout/batch/epochs, per-job resources, suite wall/RSS dan jumlah/total
steps training maksimum. Primary reference wajib Small/HYBRID. Protocol menyimpan
seluruh configuration/source/split/gates/code/data identity; paths request tidak
menjadi identitas. Code berubah memerlukan protokol baru, bukan melanjutkan
training cache lama dengan code berbeda.

## Split dan experiments

Final 15% range tetap holdout M8. Separuh awal development 85% menjadi initial
train; separuh berikutnya dibagi menjadi disjoint OOS tests. Train expanding dan
berakhir sebelum purge minimal satu main bar. Semua interval half-open/grid-aligned.
Fit normalizer hanya pada train setiap fold; account/risk/position reset pada
episode test. Prehistory hanya untuk warm-up causal features. Curves antar fold
bukan satu portfolio yang dapat digabung/compound.

Untuk setiap seed/fold: train Small/HYBRID, masked OOS inference, ledger replay,
exact metrics dan empat matched baselines (HOLD, seeded random, EMA crossover,
constrained Buy & Hold). Baselines memakai exact config, normalizer, range, costs
dan restrictions model. Buy & Hold tetap reference constrained oleh risk policy.

Empat counterfactual tetap: taker fee 2x, slippage 2x, RR1.5 dan RR3. Weights dan
normalizer primary tidak berubah, tetapi masks/actions dan sizing dihitung ulang
dengan configuration stress. Conservative fee/slippage allowances ikut berubah;
ini bukan analisis fixed exposure. Counterfactual diberi
`deployment_compatible=false` karena config loader model asli tidak cocok.

Eksperimen exploratory pada last fold/reference first seed: AI_EXIT, FIXED_RR,
hapus explicit feature, Medium pi/vf[128,64], Large pi/vf[256,128,64]. Kelimanya
retrain dan refit normalizer sendiri, tanpa mengubah hard risk limits. Hasil satu
seed tidak membuktikan superioritas atau menjadi kandidat promotion. Custom
network tetap tidak dieksekusi. Flag `research_scope=advanced_evaluation_v1`
memungkinkan arsitektur/split M9; training M8 default tetap Small/70-15-15.

Untuk 3 seeds/2 folds terdapat 11 training (6 primary +5 exploratory), 35 rows
(6 primary +24 stresses +5 exploratory), serta 6 comparisons berisi 24 baseline
results. Return mean/median/sample standard deviation bersifat deskriptif;
seeds pada market path yang sama bukan independent market samples atau confidence
interval. PF per seed dihitung dari seluruh closed trade net PnL kedua folds,
bukan rata-rata PF fold. Undefined metrics tetap null dengan alasan dari M6.

## Artifacts, cache dan verification

`artifacts/evaluations/` menyimpan `protocols/`, `training-cache/`, `reviews/`,
`reports/`, `holdout-reservations/`, `selections/`, `holdout-use/` dan
`holdout-results/`. Semua runtime/artifacts ignored dari Git. Model archives M8
dan linked simulations/baselines wajib dipertahankan untuk verification.

Report directory berisi report.json/md, primary equity/drawdown curves.csv,
equity.png/drawdown.png untuk last-fold reference model dan empat baselines,
per-row masked actions serta content-addressed manifest. JSON membawa seluruh
M6 metrics (net return/PnL, drawdown, PF, expectancy, win/trade statistics dan
undefined reasons), linked verified artifacts, complete experiment matrix,
failures dan exact screen reasons. Markdown memuat model dan baseline tables.

Reader memeriksa schema/checksums/semantic digest, matrix completeness/duplicates,
referenced metadata/config/splits/normalizers/weights, simulation replay metrics,
matched baseline scopes, action hashes, exact CSV dan recomputed screen.
Reader tidak mendeserialisasi ZIP models. Report dapat dibaca setelah code update;
run/freeze/holdout memerlukan current protocol/code. Local hashes adalah integrity
checks, bukan signature atau perlindungan terhadap owner yang mengedit registry.

Rerun boleh memakai cache hanya setelah model archive/config/fold/data/code/policy
diverifikasi. Cache reuse dicatat pada logs, bukan disebut training replication.
Deterministic masked rerun harus menghasilkan semantic SHA dan report ID sama.
M8 tetap memiliki bukti dua training independen; M9 smoke tidak menggantikannya.
Job cancellation/lease/wall/RSS/checkpoint semantics tetap mengikuti
[training](training.md). Suite limits diperiksa pada operation boundaries;
per-job watchdog membatasi child worker. Ini sampled limits, bukan kernel quota.

Optional legacy review hanya menerima known M8 fingerprint
`472b5acd801b17c326148c35affa4e62ab6a02307728f7ab3889ff405dc0af7c`, runtime/data
cocok, 59 protected core files identik dengan
[review rule](../packages/contracts/fixtures/research-compatibility.json), serta
identical original-validation parameter/action/report/metrics replay. Cert
menyimpan old/current identities. Default model loader tetap menolak code mismatch;
review bukan izin deploy atau migrasi semua model lama.

## Research screen dan final holdout

Gates `research_screen_v1` dibekukan sebelum hasil:

- Minimal 3 seeds, 2 folds, 30 hari unique OOS dan 30 closed trades per seed.
- Positive mean OOS return setiap seed; finite PF per seed >=1.1.
- Setiap seed mengalahkan matched HOLD dan EMA mean return.
- Positive mean return setiap seed pada masing-masing named stress.
- Semua required experiments valid, DD dalam config cap, tanpa daily/DD breach.

Tidak memilih best seed/variant/checkpoint sesudah melihat hasil. Failures,
undefined PF, data pendek, missing results atau risk termination memberi alasan
eksplisit. Status `insufficient_evidence` dapat mencakup alasan kerugian juga;
status ini tidak menyatakan model menguntungkan. `research_screen_pass` hanya
memungkinkan frozen holdout/manual research review; registry promotion/live safety
memerlukan milestone berikutnya.

```powershell
.\.tools\node\npm.cmd run evaluation:freeze -- --report SHA256_REPORT
.\.tools\node\npm.cmd run evaluation:holdout -- --selection SHA256_SELECTION
```

Freeze memilih primary last fold pada **first preregistered seed**, bukan return
terbaik, lalu mengunci model/weights/config/normalizer/range/code/gates/report.
Register menyimpan batas holdout untuk source/symbol/timeframe/source range dan
menolak perubahan batas maupun konflik dengan prior model metadata pada dataset
yang sama. Data fingerprint baru tidak mereset batas source period yang sama.

Sebelum prediction pertama, exclusive local reservation menulis/fsync `started`.
Semua overlapping holdout use untuk source/symbol/timeframe yang sama ditolak,
termasuk across protocol dan revisi train-data fingerprint. Operation failure atau
crash tetap consumed; tidak ada retry yang menyamarkan akses sebelumnya.
Reservation lock hanya mencakup admission, bukan seluruh inference. Stale lock
setelah crash memerlukan manual audit; jangan menghapus marker untuk rerun.
Tidak ada database/distributed lock pada M9.

Final holdout wajib valid, positive return, >=30 trades, finite PF>=1.1, DD<=config
dan tanpa risk breach. Result tetap `execution_ready=false`; tidak ada otomatis
Validated/active status. Smoke publik satu hari tidak memenuhi research screen,
sehingga freeze ditolak dan holdout tidak dievaluasi. Fixtures menguji pass,
deterministic selection, once-only, overlap, failure dan race tanpa membuka
holdout publik.
