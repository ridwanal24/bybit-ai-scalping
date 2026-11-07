# Milestone 9 — Advanced Evaluation

Tanggal:7 November2026, Asia/Jakarta. Approved melalui `lanjut eksekusi M9`.
Scope task9.1–9.19; tidak mencakup dashboard M10, model activation atau orders.

## Frozen design sebelum evaluation keputusan

1. Preregister immutable protocol/config/source/split/seed/variants/budget sebelum
   train/evaluate. Preserve M8 15% final holdout. Expanding walk-forward pada85%
   development: initial half development untuk train, remaining half dibagi
   nonoverlapping OOS folds,1 main-bar purge sebelum tiap test. Prehistory untuk
   features saja, train-only fit/independent account setiap fold/model.
2. Primary base strategy3 seeds minimum/2 folds. All seeds dihitung, bukan best
   seed. Report mean/median/std descriptive returns per seed dan worst per-episode
   drawdown, bukan confidence interval atau invented continuous portfolio curve.
3. HOLD/random per seed/EMA/Buy & Hold constrained memakai same fold/risk/costs/
   normalizer. Reuse M6 comparison/artifacts. M5 ledger curves dan exact metrics.
4. Frozen2x fee,2x slippage dan RR1.5/3 counterfactuals pada primary models semua
   seeds/folds; label incompatible-for-deployment, tanpa menyamarkan perubahan
   behavior sebagai compatible model. Fee/slip allowances ikut conservative sizing.
5. AI_EXIT/FIXED_RR vs base HYBRID, explicit feature drop, Medium[128,64] dan
   Large[256,128,64] vs Small: retrain/fit per variant. Exploratory variants pada
   last fold/reference seed saja, tidak diberi evidence multi-seed atau promotion.
   M8 research_scope flag membuka architecture/fold execution khusus M9; defaults
   M8 Small/70-15-15 tetap, config v1 tidak diubah.
6. Existing M8 loader strict tetap. Optional M8 compatibility attestation hanya
   known M8 code fingerprint dengan exact protected inference/simulator/features/
   runtime/contract hashes yang dicatat sebelum M9 edits, plus checksum/runtime/
   config gates dan identical original-validation actions/report/metrics replay.
   New simulation ID berbeda karena code hash. Bukan blanket live compatibility.
7. Immutable evaluation report/checksummed referenced models/normalizers/ledgers/
   comparisons/curves/protocol, semantic deterministic rerun memakai verified
   model cache. Failure/invalid/undefined tetap explicit; no profitable-results filter.
8. Final holdout workflow: freeze one base candidate/protocol/report after research
   screen passes; atomic once-only consumption keyed dataset+range, record started
   before reading holdout and complete/failed afterwards. Reuse/failed attempt
   counted consumed. No public holdout execution unless eligible; synthetic fixtures
   test one-shot mechanics. No automatic registry promotion/live activation.

## Preregistered research screen v1

Screen hanya eligibility untuk manual review/frozen holdout, bukan Validated/live.
Minimum3 seeds,2 disjoint OOS folds, unique OOS span>=30days, minimum30 closed
trades per seed across its folds. Semua primary/2x-fee/2x-slip/RR stress episodes
valid, no risk termination, net return positive per seed, worst drawdown<=config
cap; per-seed profit factor>=1.1, base mean return beats matched HOLD dan EMA.
Undefined PF/other required evidence fails screen (reason explicit), bukan infinity.
Exploratory variants tidak eligible; holdout must independently pass validity,
positive net return/DD cap/min30 trades/PF>=1.1 sesudah frozen selection.
Gate/result records exact thresholds/reasons before outcome; user risk hard limits
tidak dilonggarkan. Negative/zero/sparse/short samples tidak dipromosikan.

## Actual bounded public smoke budget

Existing BTCUSDT24h export/original config, source verified from matching original
config hash. Seeds42/43/44,2 folds, train384/rollout128/batch64/epochs2, CPU1 thread/
env, suite900s/RSS3072MiB, per-job120s, max12 new trainings/5000 total train steps,
2 checkpoint retention. Planned11 trainings:6 primary +2 exits +1 feature drop
(last enabled market feature) +2 architectures. Four stress variants per primary
episode. Deterministic rerun may reuse only checksum/runtime/code/fold/config-
verified model cache; never report cache use as retraining. No new candles/download.
24h cannot meet30day evidence gate; actual result remains technical smoke.

## Tests/acceptance

Split ordering/purge/no overlap/no holdout leakage, stats/undefined/curves/reconcile,
baseline matching/all-seed aggregation, exact stress changes/retrain-required
variants, cache/protocol/report tamper gates, research scope/model compatibility,
holdout once-only/failure/race, deterministic fixture+public E2E, M1–M8 regression.
All9.1–9.19 completed with actual evidence; no claim full-year efficacy/production
readiness. Reports are bounded immutable local research artifacts; jobs reuse M8
supervisor/cancel/resource controls. Backend/DB registry/dashboard remains M10.
