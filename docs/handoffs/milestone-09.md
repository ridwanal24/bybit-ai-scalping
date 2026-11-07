# Milestone 9 — Advanced Evaluation

Tanggal:7 November2026, Asia/Jakarta. Approved melalui `lanjut eksekusi M9`;
[implementation plan](../plans/milestone-09.md), task9.1–9.19.

## Final Status

**Completed** dalam bounded research scope. Advanced evaluation/report/gates dan
final holdout procedure tersedia. Data publik24h tidak memenuhi minimum evidence;
final holdout tetap terkunci, tidak ada model promotion/activation. Dashboard M10
belum Approved. [Panduan operasi](../evaluation.md).

## Implemented Features dan How It Works

Immutable protocol membekukan exact configuration/source snapshot/data/code,
3 unique seeds, expanding walk-forward folds dengan purge dan final15% holdout,
named variants, hard gates serta compute budgets sebelum training. Preprocessing
hanya fit train perfold; independent account/positions/normalizer pada tests.

Persistent M8 jobs menghasilkan6 primary Small/HYBRID models. Setiap model
dievaluasi dengan action masks, shared M5 ledger/replay/M6 metrics dan4 matched
baselines. Fee2x/slippage2x/RR1.5/RR3 counterfactual memakai frozen weights,
recompute actions/sizing dan deployment incompatible. AI_EXIT/FIXED_RR/explicit
feature drop/Medium/Large masing-masing retrain pada lastfold/reference seed.
Lima exploratory results tidak menjadi evidence multi-seed atau promotion.

Report menyertakan complete matrix, per-row metrics/actions/provenance,
JSON/Markdown, exact equity/drawdown CSV dan PNG reference model+baselines.
Independent reader memverifikasi referenced archives/simulations/comparisons,
metric/curve/screen recomputation dan tamper gates. Verified cache rerun memakai
weights yang sama, bukan independent retraining. Seeds mean/median/sample std
deskriptif; folds bukan continuous portfolio atau independent market CI.

M8 default Small/70-15-15 dan strict model loader dipertahankan. Explicit research
scope membuka Medium/Large/fold M9. Optional legacy certificate hanya known M8
code+59 protected core hashes/runtime/data+identical original validation replay.
Tidak ada blanket compatibility bypass.

Research screen minimum30 unique OOS days/30 trades perseed/PF>=1.1, allseed
positive mean returns/beat HOLD+EMA, named stresses positive, DDcap/no risk breach
dibekukan sebelum hasil. Freeze hanya setelah eligible screen, deterministically
first seed/last fold; bukan best model selection. Append-only boundary reservation
dan atomic fsync started sebelum prediction mencegah overlapping final holdout
reuse across protocols/data revisions. Fail/crash tetap consumed; local stale
lock memerlukan audit. Final holdout memiliki independent gates dan tetap
execution_ready=false. Registry promotion/manual trading safety tetap berikutnya.

## Completed Tasks

| Task | Deliverable / evidence |
| --- | --- |
| 9.1 Net PnL | Shared M6 exact net-equity/trade metrics dari verified M5 ledger |
| 9.2 Drawdown | Exact per-row/worst episode DD, CSV dan reference PNG |
| 9.3 Profit factor | Net-trade PF, per-seed pooled trades, undefined explicit |
| 9.4 Expectancy | M6 expectancy metric pada semua model/baseline results |
| 9.5 Trade statistics | Trades/win/loss/duration/direction/exposure/undefined metrics |
| 9.6 Equity curve | Primary per-fold exact CSV; reference model+4 baselines PNG |
| 9.7 Baseline comparison | 6 exact paired comparisons,24 baseline results |
| 9.8 Multi-seed | Seeds42/43/44, allseed statistics/gates, no best-seed filter |
| 9.9 WFO splits | Expanding disjoint OOS,1bar purge, preserved final15% holdout |
| 9.10 WFO runner | Protocol-first bounded persistent training, strict cache |
| 9.11 Fee sensitivity | Fixed2x fee plus conservative fee allowance,6 rows |
| 9.12 Slippage sensitivity | Fixed2x slippage/allowance,6 rows |
| 9.13 RR sensitivity | Fixed RR1.5/RR3,12 rows |
| 9.14 Exit comparison | AI_EXIT/FIXED_RR retraining vs base HYBRID |
| 9.15 Feature ablation | Explicit enabled feature removal/refit/retrain |
| 9.16 Architecture comparison | Small vs Medium[128,64]/Large[256,128,64], real training |
| 9.17 Report | Immutable verified JSON/Markdown/CSV/PNG/actions/manifest |
| 9.18 Final holdout | Eligible freeze, once-only/overlap/failure/race guards |
| 9.19 Promotion criteria | Preregistered conservative research/holdout gates, no autoactivation |

## Files Created/Modified

- `services/quant/src/bybit_quant/evaluation/`: protocol, variants, episodes,
  compatibility, runner, screen, reports, reservations, freeze/holdout dan CLI.
- M8 preparation/engine/jobs/model verification: optional research scope/folds;
  protected simulator/features/environment/runtime bytes tetap sama.
- `packages/contracts/src/evaluation.ts`, training/index/export,7 new generated
  schemas, additive training-request/model-metadata schemas dan compatibility
  fixture; TypeScript/Python tests, explicit public smoke helper.
- Root evaluation register/run/report/freeze/holdout/verify commands dan dispatch.
  No new dependency, uv/npm lock change, DB migration atau HTTP API.
- README/architecture/planning/ADR17/operations/progress/roadmap/testing dan guide.
  Historical milestone handoffs tidak ditulis ulang. Source dataset/config snapshot,
  original preset/hard risk defaults/.env/credentials tidak diubah.

## Verification dan actual evidence

`npm run verify:evaluation`: final orchestrator PASSED,7 November2026
WIB10:49:18–11:00:17. 518 tests tanpa skip:120 contracts/33 backend/334 Python/
31 integration, semua static/export/migration upgrades/zero schema diff checks.
PowerShell `*>` wrapper memberi exit1 atas informational Prisma stderr; report
dan seluruh checks PASSED, detail capture semantics pada [testing](../testing.md).

Public smoke menyelesaikan11 successful background jobs,4224 optimizer steps;
semua weights berubah. Perjob25.890–31.312s, sampled peak RSS344.988MiB,
di bawah frozen120s/3072MiB cap. Original Small47110params; ablation43014,
Medium93702 dan Large236294. Removed feature `rsi:15m`; hard risk tidak berubah.
Report `completed_research` dengan35 rows/6 comparisons, tanpa failed experiment.

| Seed | Trades across2folds | Mean fold return | Net-trade PF | Worst episode DD |
| --- | --- | --- | --- | --- |
| 42 | 21 | −1.6910156% | 0 | 2.0173066% |
| 43 | 25 | −2.0312662% | 0 | 2.16186515% |
| 44 | 25 | −2.06592025% | 0 | 2.07294035% |

Mean acrossseeds−1.9294006833%, median−2.0312662%, sample std0.2071733857
percentage points. Status `insufficient_evidence`:612min OOS<30days,21–25trades
perseed<30, PF0/negative returns, tidak mengalahkan HOLD/EMA, negative named
stress returns dan daily-loss breaches. DD di bawah10% tidak menghapus daily-risk
failure. Exploratory lastfold seed42 net USDT: AI_EXIT−20.173066,
FIXED_RR−20.147592, feature drop−21.6006325, Medium−20.33948, Large−16.779377.
Hasil lebih baik relatif pada satu exploratory row tidak menjadi model selection.

Protocol `3146645dd03bc69425c62b24fd41ec2947998fb1a16f54238202aafb650de2a2`;
report `6a8dbce35c5a25a40999d4963ce25017a5ddb484fb6200e3f0f65b8bcb2b4702`;
semantic SHA `3d1436527f9cecf237be80adb37c76e83fb69e90759d64c590bf303775ec2a9b`;
code `cbee12b066489686cf99af5c84cb66c4e7fa7575c1d42fe992abdbd0e5e8fb20`.
M8 replay review certificate
`dc3e63b98a5b1c72b8a38c0275e8c488ba04d67f5472a8f5285f139f5941b1fe`
mempertahankan parameter/action/report/metrics archived validation, termasuk net
−9.979526USDT. Root register mengembalikan protocol sama; root report CLI exit0.
Freeze ditolak karena screen, tidak ada public holdout-use marker atau promotion.
Public helper selesai WIB11:09:21,1213.474s untuk dua run dan verification di
antaranya;900s cap perrunner. Cached rerun11 verified models/35 rows/0 training
submissions, report ID dan semantic SHA identik. Evidence JSON status passed;
tidak ada active lease. Wrapper exit1 pada direct smoke berasal dari Matplotlib
cache warning/redirection, bukan failed helper assertion; detail [testing](../testing.md).

Hasil final regression dan bounded public smoke dicatat pada
[testing](../testing.md); artifacts di ignored `.runtime/evaluation-report.json`,
`verify-evaluation-final.log`, `evaluation-smoke.json`, `smoke-evaluation-final.log`
dan `artifacts/evaluations/`, linked models/simulations/baselines/jobs.

## Limitations dan Next Milestone

Acceptance criteria PROJECT_SPEC:

| Criterion | Status / evidence |
| --- | --- |
| Evaluasi reproducible | Lulus: synthetic dan public cached rerun memiliki exact report ID/semantic SHA sama |
| Baseline comparison tersedia | Lulus:24 results dalam6 exact matched comparisons |
| Out-of-sample metrics tersedia | Lulus:6 primary OOS episodes,2 disjoint folds/3seeds |
| Sensitivity results tercatat | Lulus:24 named fee/slippage/RR counterfactual rows |
| Model dapat dinilai tanpa memaksakan hasil positif | Lulus: screen insufficient, kerugian/risk failures tersimpan; holdout ditolak |

Remaining mandatory tasks: tidak ada. Known issues/technical debt terbatas pada
batas riset dan local artifact registry berikut, bukan blocker acceptance M9.
Dokumentasi diperbarui: README, architecture, decisions/ADR17, operations,
planning, progress, roadmap, testing, training, evaluation guide, plan dan handoff M9.

Data hanya BTCUSDT1 Januari2025 UTC; current instrument metadata/funding schedule
dan last-open proxy/restricted market-last/1x/50% tetap berlaku. Training384steps
adalah optimizer smoke, bukan convergence atau strategi siap pakai. One-seed
exploratory variants tidak membuktikan architecture/feature/exit superiority.
Negative/sparse/undefined results disimpan dan tidak dituning agar lolos.

Full-year throughput belum dibenchmark. Suite checks pada operation boundaries
dan child wall/RSS watchdog adalah sampled resource limits. Registry filesystem
lokal bukan distributed/signed authorization system; owner dapat mengeditnya.
Archive linked artifacts/holdout markers bersama-sama, jangan reset untuk rerun.
Backend jobs/DB model registry/dashboard, operational approval dan real-time/
Paper/Demo/Real tetap M10+. Tidak ada active job/proses test yang perlu dipakai
untuk milestone berikutnya.

M10 — Dashboard memerlukan instruksi berikutnya. Baca PROJECT_SPEC.md,
README/progress/architecture/roadmap, guide dan handoff ini sebelum membuat plan.
Gunakan actual backend/config/job/evaluation artifacts, bukan mock live results;
Real tetap disabled. Tidak ada izin order dari approval M9.

**Waiting for Next Milestone Instruction.**
