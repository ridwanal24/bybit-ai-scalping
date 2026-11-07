# RL Training M8

CPU MaskablePPO training memakai M7 GuardedEnv/SettledEpisodeWrapper dan simulator
M5/M4 pipeline yang sama. Model tersimpan sebagai `candidate_research_only`,
execution_ready=false. M8 tidak melakukan promotion, final-holdout selection,
exchange orders, Optuna atau long training otomatis.

## Menjalankan dan memantau

```powershell
.\.tools\uv\uv.exe sync --project services/quant --locked --cache-dir .tools/uv-cache
.\.tools\node\npm.cmd run verify:training
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_training.py
.\.tools\node\npm.cmd run training:status -- --job JOB_UUID
.\.tools\node\npm.cmd run training:cancel -- --job JOB_UUID
```

Smoke helper membuat `.runtime/training-smoke/request.json`, lalu menjalankan dua
job independen dengan seed/budget sama dan membandingkan parameter, normalizer,
validation actions/report. Existing dataset M3 harus tersedia; tidak auto-download.
Untuk submit explicit request yang sudah dibuat:

```powershell
.\.tools\node\npm.cmd run training:submit -- --request .runtime/training-smoke/request.json
```

Submit mengembalikan job UUID/status tanpa menunggu training selesai. CLI status
dan cancel tidak membangun ulang contracts. Python equivalent memakai
`python -m bybit_quant training-submit|training-status|training-cancel`.
Request/input incompatibility exit1 tersanitasi. Job failure/cancellation/resource
limit terlihat melalui persistent terminal state, bukan exit submit yang sudah
mengembalikan UUID. `training-supervise`/`training-worker` adalah internal commands
dengan managed UUID, exclusive locks dan active-supervisor checks.

## Request dan budget

Strict `training-request-v1` memakai version1, dataset UUID, configuration_file,
nullable source_snapshot_file dan seluruh explicit simulation policy M5. Tambahan:
`range_start_ms`, `range_end_ms`, `ppo_epochs`, `checkpoint_every_rollouts`, resources.
Tidak menerima arbitrary Python callback, output path atau remote model URL.
File input relatif terhadap request; output di root repository. `--root` pada
Python controller dipakai isolated stores/tests, bukan arbitrary worker module.

Resources wajib: cpu_threads=1, max_wall_seconds1–3600, max_memory_mb64–8192,
max_timesteps8–1000000, max_checkpoints1–32. PPO epochs1–10 eksplisit. CPU1 env
dan configured Small network pi/vf[64,64] saja pada M8; Medium/Large/Custom tetap
valid configuration capability tetapi execution training M8 ditolak.
`n_steps`8–2048, batch membagi rollout, total_timesteps membagi rollout agar
SB3 tidak diam-diam melebihi budget. Episode length minimal2. Normalization
artifact_id harus null untuk fresh train-only fit; tidak mengganti explicit ID.

Pre-registered public smoke: original preset/seed42,1024 steps, rollout128,
batch64,2 epochs,8 checkpoint retention, CPU1 thread/env, wall180s/RSS3072MiB.
Limits berlaku per worker, termasuk preparation/imports/training/validation.
Supervisor memeriksa wall dan RSS worker+children tiap100ms; memory adalah
watchdog dengan kemungkinan overshoot singkat, bukan kernel allocation cap.
Torch intra/inter-op dan OMP/MKL/OpenBLAS threads diset1, CUDA tidak dipakai.
Tidak mengubah OS affinity/global runtimes. Parent memverifikasi/publish archive
setelah worker selesai; verification filesystem menambah sedikit overhead job.

## Data preparation dan learning

Range explicit dibagi chronological70/15/15 pada grid main candle: train/validation
bar counts dibulatkan ke bawah; remainder holdout. Tiap split minimal2 bars,
half-open/disjoint dan tidak shuffle. Normalizer baru fit dari train feature rows
saja; iterasi dihentikan di train boundary. Source integrity hashes mencakup
dataset penuh; ini tidak berarti holdout features/predictions ikut evaluation.

Train episodes berurutan sepanjang configured episode_length_bars dan dicap pada
train end; tail satu bar digabung ke episode sebelumnya. Setelah train end, cycle
ulang train. Reset membuat wallet/position/risk/intent baru; prehistory hanya
warm-up. Validation mempunyai account baru dan frozen train normalizer yang sama.
Final holdout disimpan dalam metadata dengan holdout_evaluated=false, tanpa
model decisions/metrics M8. Tidak memakai validation untuk memilih best checkpoint:
candidate adalah final requested timestep, evaluation sesudah training.

Configured learning rate/gamma/GAE/entropy/clip/seed/activation/net architecture
diteruskan ke MaskablePPO MlpPolicy, device CPU,1 env. Actual parameter count
dicocokkan M2; original preset299 inputs menghasilkan47110 parameters.
PPO epochs berasal request. SB32.7 defaults lain (vf_coef0.5, max_grad_norm0.5,
normalize_advantage=true, no target_kl/SDE) tetap version-pinned.
Python/NumPy/Torch seeds dan deterministic Torch algorithms diset eksplisit.

GuardedEnv memakai current M7 masks, explicit absorbing settlement wrapper dan
reject invalid simulator status sebelum transition diterima rollout buffer.
Predict validation selalu deterministic dengan action_masks; mask dicek lagi
sebelum step. Config reward `net-equity-delta/initial-capital-v1` dipetakan ke
runtime formula sama `net_equity_initial_v1`; fee/funding/settlement tetap ledger.
Invalid simulation membuat job FAILED, tanpa model publication.

## Validation, checkpoints dan artifacts

Custom evaluator memakai masks pada setiap predict; tidak memakai base SB3
unmasked EvalCallback/evaluate_policy. Explicit validation actions direplay lewat
M5 immutable artifact dan report harus identik. M6 exact metrics dihitung dari
ledger yang direload, termasuk undefined null/reason. Tidak memaksakan profit/trades.

Checkpoint dibuat setelah completed PPO optimization pada configured rollout
interval, serta final update. `checkpoints/step-N.zip` dan JSON menyimpan SHA,
parameter hash, timesteps/config/normalizer/runtime. Retention menghapus hanya
known old files di job checkpoint directory. Optimizer disimpan oleh SB3; resume
tidak otomatis diaktifkan karena RNG/episode/rollout continuity belum dijamin.

Worker save final ZIP lalu load dan mengulangi validation. Parameter/action/report
harus sama. Model publication dilakukan supervisor sesudah successful outcome,
resource/cancel check dan independent checksum/metadata verification.
`artifacts/models/<id>/` membawa model.zip, normalizer.json, metadata.json,
validation.json/actions dan complete linked M5 validation ledger dalam subdirectory
validation/. Manifest mengikat semua file. Tidak perlu dependency pada job folder
untuk memuat model, tetapi arsipkan job juga jika membutuhkan logs/checkpoints.

Metadata mencakup config/hash, dataset/snapshot/source fingerprints, splits,
features/window/dtype/order/schema/normalizer, action/reward/environment/bootstrap,
SL/RR/risk/funding assumptions, seed/actual params/steps, code/lock/Git/dirty state,
runtime/hardware/threads/resources, job and validation identities.

`verify_model(path)` memverifikasi checksum/schema/split consistency/normalizer,
validation ledger/metrics/actions/provenance tanpa deserialization.
`load_model(path, config)` memeriksa exact config hash, current runtime/code
fingerprint, lalu memuat SB3 ZIP CPU dan memeriksa finite parameter hash. Bahkan
perubahan risk/cost/exit dengan shape sama ditolak. Source changes bisa memerlukan
explicit compatibility review/re-evaluation/retraining; jangan bypass gates.
Arsip model managed milik pengguna dipercaya; checksum bukan signature atau
sandbox untuk untrusted pickle/ZIP dari pihak lain.

Seeded CPU repeatability diuji pada pinned runtime yang sama untuk parameter,
normalizer, action traces dan validation report. Job UUID/ZIP timestamps dan
artifact IDs dapat berbeda; tidak mengklaim byte-identical ZIP/cross-platform
training. Runtime transitive hashes berada dalam uv.lock.

## Background jobs dan recovery

`artifacts/training-jobs/<uuid>/` menyimpan immutable request/config/source copy,
status.json, progress.json, events.jsonl, worker/supervisor logs, normalizer/split,
checkpoints/outcome dan managed process identities. Single active root lease
mencegah dua job pada store yang sama. Exclusive supervisor/worker locks mencegah
double-start. Hidden subprocesses tidak membuka console/window.

States: QUEUED→RUNNING→SUCCEEDED, atau CANCELLING→CANCELLED, FAILED,
RESOURCE_LIMIT, INTERRUPTED. State terminal adalah otoritas; worker phase finished
berarti staging selesai, bukan model sudah published. Cancel marker idempotent,
cooperative check setiap step/phase, fallback kill owned process tree sesudah2s.
Completion yang sudah commit dapat menang atas late cancellation request.
Cancel/fail/limit/interrupted job tidak mendapat successful model ID.

Progress memberi phase/timesteps/rollouts/episodes/valid-action count, finite
optimization metrics, RSS/wall time. Final usage memberi supervisor elapsed dan
sampled peak RSS. Progress/status atomic replace, dengan bounded retry untuk
Windows sharing race saat readers aktif; logs tidak menyimpan raw input/error
strings atau credentials. Matplotlib cache di `.runtime/matplotlib-cache`.

PID+creation time diverifikasi sebelum status recovery/kill, bukan PID saja.
Dead supervisor menandai INTERRUPTED, menghentikan known owned worker dan melepas
lease; tidak auto-resume/mengadopsi proses lain. Hard power loss/storage failure
di tengah admission/commit masih perlu review orphan files/lease; hashes bukan
filesystem transaction atau DB recovery. Python persistent controller M8 adalah
CLI foundation untuk backend/dashboard M10; tidak ada DB migration/HTTP job API M8.

## Sources dan batas validitas

Mask/predict/evaluation:
[official MaskablePPO documentation](https://sb3-contrib.readthedocs.io/en/master/modules/ppo_mask.html).
CPU wheel source: [PyTorch official installation](https://pytorch.org/get-started/locally/).
Pinned releases: [SB3-Contrib2.7.0](https://pypi.org/project/sb3-contrib/2.7.0/),
[SB3 source v2.7.0](https://github.com/DLR-RM/stable-baselines3/tree/v2.7.0).
Diperiksa7 November2026; actual Windows CPU install/training/save-load diuji.

Full-year/production resource envelope, multi-seed inference/walk-forward/
sensitivity/holdout promotion gates tetap M9+, dashboard/registry API M10.
Restricted simulator market/last/1x/50%, declared funding/current metadata,
OHLC/full-fill/terminal settlement assumptions tetap berlaku. Model trained atau
validation loss/profit bukan izin exchange execution.
