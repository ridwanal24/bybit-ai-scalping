# Milestone 8 — RL Training

Tanggal:7 November2026, Asia/Jakarta. Approved melalui `gas eksekusi m8`.
Scope seluruh task8.1–8.16; berhenti sebelum M9, tidak ada exchange orders.

## Implementation plan

1. Explicit dataset range displit aligned chronological70/15/15; rounding train
   dan validation ke bawah, remainder holdout. Semua split nonempty/disjoint.
   Frozen normalizer baru fit hanya train, prehistory hanya warm-up, episodes
   tidak melintasi split. Holdout tidak dipakai evaluator/tuning M8.
2. Pin CPU Torch2.8.0+cpu dari official CPU index, SB3/sb3-contrib2.7.0,
   psutil7.1.0 bersama Gymnasium1.2.1/NumPy2.3.4, lock hashes; actual Windows
   integration diuji. Tidak memakai CUDA, distributed/online training atau Optuna.
3. MaskablePPO MlpPolicy Small pi/vf[64,64], configured activation/hyperparameters,
   one environment, seeded Python/NumPy/Torch, deterministic CPU algorithms.
   Actual parameter count harus sesuai M2 guard. Medium/Large/Custom ditolak
   M8 execution (configuration support tidak dihapus).
4. Train wrapper memakai M7 SettledEpisodeWrapper dan fail on invalid episode
   sebelum learner menerima sample. Every predict/evaluation memakai masks;
   validation terpisah dengan frozen preprocessing dan exact M5 metrics/ledger.
5. Checkpoints setiap configured rollout interval; bounded retained files,
   final model save/load dengan checksum/metadata/compatibility gates sebelum
   deserialization. Compare parameters dan deterministic validation decisions
   sebelum/sesudah load. Candidate final checkpoint, tanpa automatic promotion
   atau memilih/tuning berdasarkan final holdout.
6. Immutable model artifact: model/normalizer/config/split/schema/action/reward/
   simulator/funding/risk assumptions, data/snapshot/code/Git/lock/runtime/seed/
   hardware/threads, validation report, parameter/action hashes dan checksums.
   CPU rerun diuji weights/actions/results; ZIP bytes/IDs tidak wajib identik.
7. Local persistent job controller/CLI: submit/start background hidden process,
   status/progress/logs/checkpoints/cancel, supervisor watchdog wall/RSS,
   interruption/failure states. Single active job lease; UUID-only command
   access; immutable submitted request/config/source snapshots. Status/progress
   atomic files + append-only logs, no shell arbitrary module execution.
   Backend/DB model registry/dashboard tetap M10; tidak perlu migration M8.
8. Resource request eksplisit: steps/epochs/threads/wall/RSS/checkpoint retention;
   reject PPO rounding overshoot, CPU1 thread/n_env1. Supervisor mematikan hanya
   owned worker process tree bila timeout/RSS melebihi batas. Polling memory
   bukan hard OS allocation cap; bounded overshoot dicatat. Cancel cooperative
   lalu bounded kill fallback. Failed/cancelled/limited job tidak menerbitkan model.
9. Contracts request/job/progress/model metadata, offline commands, unit/integration
   tests split/no leakage, training/masking/checkpoint/compatibility/reproducibility,
   cancellation/limits/invalid episodes, actual background CLI lifecycle.
10. Full M1–M7 regression dan fixed public smoke + documentation/handoff.

## Pre-registered actual public smoke budget

Existing BTCUSDT public24h M3 export, original Small preset (1024 steps,128 rollout,
batch64,seed42), PPO epochs2,1 CPU thread,1 env, max wall180s, max RSS3072MiB,
at most8 checkpoints. No new download candles/refit outside train; preprocessing
fit train-only diperbolehkan scope M8. Train70%/validation15%/untouched holdout15%.
Tidak mengubah stops/costs/risk untuk memaksa profit/trades. Unit/fixture training
64–128 steps menggunakan explicit synthetic snapshots/budgets lebih kecil.

## Acceptance dan risks

Model dapat trained/save/load/predict valid actions, validation mask-aware berjalan,
background progress/cancellation/resource limits teruji. Profit bukan technical gate.
No model jika invalid simulation. No claim full-year throughput/OOS robustness atau
production/live readiness. Exact compatibility strict agar behavior changes reject.
Resource watchdog mencakup préparation/train/validation dan imports; CPU budget
enforced wall/RSS/policy bukan CPU affinity. Checkpoints disimpan, auto-resume tidak
diaktifkan tanpa optimizer/RNG/episode conformance (bukan task resume M8).

Official sources diperiksa7 November2026:
[MaskablePPO](https://sb3-contrib.readthedocs.io/en/master/modules/ppo_mask.html),
[SB3-Contrib2.7.0](https://pypi.org/project/sb3-contrib/2.7.0/),
[PyTorch CPU installation](https://pytorch.org/get-started/locally/).
Versi dipilih sebagai compatibility baseline, bukan latest claim.
