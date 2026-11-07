# Milestone 8 — RL Training

Tanggal:7 November2026, Asia/Jakarta. Approved melalui `gas eksekusi m8`;
[implementation plan](../plans/milestone-08.md), task8.1–8.16.

## Final Status

**Completed**. Seluruh task8.1–8.16 dan6 acceptance criteria selesai. Phase3
RL Proof of Concept tercapai dalam bounded research scope. M9 belum Approved;
tidak ada model promotion atau exchange execution.

## Implemented Features dan How It Works

Range dataset explicit displit chronological70/15/15 pada main-bar grid, train/
validation rounding down dan remainder holdout. Preprocessing hanya fit train,
episodes cycle kronologis dalam train, account/risk/intent reset antar episode.
Validation memakai frozen train normalizer/account terpisah; holdout unevaluated.

CPU MaskablePPO MlpPolicy Small pi/vf[64,64] memakai configured params dan explicit
PPO epochs/resource budget. Actual parameter count dicocokkan M2. M7 GuardedEnv/
settlement adapter dan M5 timeline/ledger tetap tunggal. Invalid simulator
transition ditolak sebelum learner; setiap validation predict memakai mask.

Checkpoints sesudah optimizer update, retention bounded dan final save/load.
Final model parameters/actions/validation report harus identik sebelum/sesudah
load. Validation actions direplay via M5 artifact, exact metrics/ledger verified.
Candidate final requested update, tidak memilih best berdasarkan holdout.
Immutable model archive mandiri membawa normalizer/config/metadata/validation
actions dan entire verified ledger. Gate checksums/config/runtime/code sebelum
deserialization; candidate execution_ready=false.

Persistent hidden supervisor/worker mendukung single active store lease, UUID
locks, immutable input copies, status/progress/logs, checkpoint/cancel, wall/RSS
limits dan failure/interruption recovery. PID+creation time mencegah adopsi/kill
reused PID. Background CLI nyata; backend/DB registry/dashboard integration M10.

## Completed Tasks

| Task | Deliverable / evidence |
| --- | --- |
| 8.1 Chronological split | Aligned70/15/15, half-open/disjoint, untouched holdout |
| 8.2 Data preparation | Train-only fit, frozen normalization, prehistory warm-up, independent episodes |
| 8.3 Small architecture | pi/vf[64,64], actual47110 params public /10502 fixture |
| 8.4 MaskablePPO | CPU1 env/thread, config params, M7 masks/settlement and invalid-sample guard |
| 8.5 Smoke training | Two original-preset1024-step public jobs within pre-registered budget |
| 8.6 Validation | Deterministic masked216-step validation, M5 replay/metrics, no holdout |
| 8.7 Checkpoints | Completed optimization checkpoints/final, SHA/normalizer/config metadata, retention |
| 8.8 Metadata | Data/source/config/split/schema/risk/reward/runtime/code/Git/seed/resources identities |
| 8.9 Save/load | Integrity/compatibility before deserialization, same weights/actions/report |
| 8.10 Logs | Append-only rollout/checkpoint events, finite optimization metrics, sanitized errors |
| 8.11 Reproducibility | Python/NumPy/Torch seed/deterministic CPU; two-run parameter/action/report equality |
| 8.12 Background jobs | Hidden supervisor/worker, persistent states/lease/locks/immutable inputs |
| 8.13 Progress | Atomic phase/timesteps/rollouts/episodes/actions/RSS/metrics + final usage |
| 8.14 Cancellation | Marker/idempotency, cooperative checks, owned process-tree grace fallback |
| 8.15 Resource limits | Explicit step/epochs/threads, no rollout overshoot, wall/RSS watchdog/retention |
| 8.16 End-to-end | 496 regression tests + actual public jobs/checkpoint/reload/CLI verification |

## Files Created/Modified

- `services/quant/src/bybit_quant/training/`: preparation/runtime/guarded env,
  evaluator/engine/model verification/storage/jobs/controller CLI; main dispatch.
- `packages/contracts/src/training.ts`, export/index,7 generated schemas dan
  TypeScript tests; Python `test_training.py` dan `smoke_training.py`.
- `pyproject.toml`/`uv.lock`: official CPU Torch2.8.0+cpu, SB3/contrib2.7.0,
  psutil7.1.0 dan pinned resolved transitives, existing Gym1.2.1/NumPy2.3.4.
  Actual Windows CPU import/train/load proven; no CUDA packages/global Python change.
- Root training submit/status/cancel/verify scripts, local Matplotlib cache env;
  README/architecture/ADR16/planning/operations/progress/roadmap/testing and guides.
  No DB migration, config schema v1 rewrite, source data/preset/credentials/.env change.

## Tests Executed

Final `.tools/node/npm.cmd run verify:training` exit0 PASSED,
7 November2026 09:10:09–09:14:49 WIB. Report `.runtime/training-report.json`
UTC02:10:09.438–02:14:49.083.

- **496 tests tanpa skip**:117 contracts +33 backend unit +315 Python
  +31 isolated PostgreSQL/HTTP integration. M8 adds10 TS/25 Python cases.
- Split/future mutation/train-only statistics; unsupported architecture/normalizer/
  rounding/budget; actual parameter update/count, checkpoints/retention, seeded
  repeat/save-load/compatibility/checksum; mask-aware validation/replay lulus.
- Invalid sample/bootstrap/chronological episode cycling; real background success/
  lease/status/progress/publication/cancel/wall/RSS/failure; PID reuse/dead-supervisor
  recovery dan actual concurrent Windows reader atomic-file regression lulus.
- Build/typecheck/ESLint/Ruff/Prettier/schema export, migration fresh/reapply/M1+M2
  upgrade/data preservation/zero schema diff dan all M1–M7 regressions lulus.
- No final DB timeout; owner context untuk SWC/DB seperti M1–M7. Test clusters
  ditutup orchestrator. `uv lock --check --offline` lulus.

Initial Windows background test mereproduksi PermissionError saat status reader
membuka old progress file; bounded atomic replace retry20×10ms memperbaikinya.
Full/dedicated reader regression lulus. Raw errors/paths tidak masuk job events.

## Bounded Public-Export Smoke

Existing dataset `3717d128-5be2-433f-90dc-ac21d3c35b54`, fingerprint
`229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa`.
Original Small preset/costs/stops/risk/schedule, seed42,1024timesteps, rollout128,
batch64,2epochs,1 CPU thread/env,180s/3072MiB budget,8 checkpoints. Budget ditetapkan
sebelum run; no candle download atau tuning atas outcomes.

| Split | UTC1 Januari2025 range | Bars |
| --- | --- | --- |
| Train | [00:00,16:48) | 1008 |
| Validation | [16:48,20:24) | 216 |
| Untouched final holdout | [20:24,24:00) | 216 |

New train normalizer fit783 rows:
`ba6f6e893f854492d6afedd4c9a5c744bafd67a3105e89e04b2ad9d97e75c222`.
Existing M4 normalizer tidak diubah. Actual public net has299 inputs/47110 params.
Both jobs SUCCEEDED, checkpoint8 each, same preprocessing/weights/validation
actions/report, reload verified. Smoke selesai09:11:24 WIB,78.808s total.

| Run | Job UUID | Candidate model ID | Elapsed / sampled peak RSS |
| --- | --- | --- | --- |
| 1 | `672f6390-3b0c-4214-a1c4-22652583996e` | `b99a2434ebc90505f454da79eb18ee4673b15f86ddacd4b9b923a1a742609d6d` | 32.875s /341.012MiB |
| 2 | `f1b5877f-9d51-4fb1-89d1-568b081f9c79` | `7dce633bd80cfe367ad3d62377e05468a1133e024415f2743ce694b7c387a3ac` | 35.391s /341.098MiB |

Parameter SHA before train:
`2ba889a9264db813576060164f9fcc887409b9f3a8ffbbc19de7be2c53252b90`.
Parameter SHA trained, both runs:
`f53176318550af3eb17fe8cb15f1c45a09b39e93c66c2ff7418da4d8136ea3f9`.
Validation action SHA:
`5b34f3a3bd82c42e23fac567a79f4e6cd6fd558d3767935acbacd343f523b53d`.
Validation simulation ID:
`a2fa4eb39e4c98cf2e286f5aed9674f1f4da28e33eebea0c4571f50011b7e995`.
Code/lock fingerprint:
`472b5acd801b17c326148c35affa4e62ab6a02307728f7ab3889ff405dc0af7c`.

Both validation runs:216 valid steps/6 trades, no invalid/rejected proposals,
gross−4.317, fees5.662526, funding0, net−9.979526 USDT, normalized return
−0.009979526, final FLAT equity990.020474. All costs/report/metrics reconcile.
Loss dipertahankan, bukan technical failure atau reason untuk mengganti assumptions.
Holdout tidak di-infer/evaluasi. ZIP bytes/IDs berbeda karena job identity/time;
reproducibility yang dibuktikan adalah CPU parameters/actions/results.

Root `training:status` dan terminal `training:cancel` keduanya exit0; terminal
cancel idempotent SUCCEEDED dan candidate tetap sama. Tidak ada active root lease.
Evidence ignored: `.runtime/verify-training-final.log`, `training-report.json`,
`training-smoke.json/log`, `training-root-status.log`, `training-root-cancel.log`,
`artifacts/training-jobs/<uuid>/` dan self-contained `artifacts/models/<id>/`.

## Acceptance Verification dan Remaining Tasks

Model trained, saved/reloaded, valid masked predictions, validation executed,
background progress/checkpoints/cancel/resource limits observable dan tested.
Profit tidak menjadi acceptance. Seluruh task wajib M8 selesai; tidak ada blocker.

## Known Issues / Next Constraints

- Research candidates only. M9 harus pre-register evaluation/promotion criteria,
  multi-seed/walk-forward/sensitivity/ablation dan holdout procedure sebelum
  keputusan seleksi/promosi; M8 validation bukan efficacy gate atau approval dana.
- Default loader exact config/runtime/code fingerprint; source changes dapat reject
  existing models walau shape sama. M9 perlu reviewed compatibility/re-evaluation
  atau retraining, tidak bypass checksum/risk/reward/mask/normalizer gates.
- Local filesystem jobs bukan DB transaction/HTTP registry. Hard power-loss di
  admission/commit dapat meninggalkan orphan lease/staging; perlu manual review.
  No unsafe automatic optimizer/RNG/episode resume. Controller foundation untuk M10.
- Resource watchdog sampled100ms, bukan kernel hard memory cap/CPU affinity.
  Cancellation2s grace, completion commit dapat menang atas late cancel. Final
  parent archive verification menambah overhead di luar worker lifetime.
- Full-year/large training throughput dan cross-platform bitwise reproducibility
  belum dibuktikan. Checksum bukan signature; model ZIP/Pickle hanya managed trusted
  artifacts. Medium/Large/Custom training, Optuna/distributed/online tetap scope lain.
- Restricted market/last/1x/50%, OHLC/full-fill assumptions, current metadata,
  declared funding proxy/schedule dan artificial settlement tetap bukan live realism.

## How to Run dan Next Milestone

```powershell
.\.tools\node\npm.cmd run verify:training
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_training.py
.\.tools\node\npm.cmd run training:status -- --job 672f6390-3b0c-4214-a1c4-22652583996e
```

CLI/request/resources/metadata/checkpoint/recovery:
[training guide](../training.md). M9 — Advanced Evaluation next, belum Approved.
Baca spec/progress/roadmap/handoff ini, susun plan M9. Candidate/current dataset/
normalizer/budgets di atas adalah starting evidence, bukan performance threshold.
Tidak melanjutkan M9, model promotion atau exchange execution otomatis.

**Waiting for Next Milestone Instruction.**
