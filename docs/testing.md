# Testing dan verifikasi

## Hasil M10 — Dashboard dan audit ulang M9

7 November2026, `npm run verify:dashboard` **exit0/PASSED**. Report
`.runtime/dashboard-report.json`: UTC06:54:39.781–07:06:40.002
(WIB13:54:39–14:06:40), **546 tests tanpa skip**:
123contracts +37backend unit +348Python +31isolated PostgreSQL/HTTP integration
+7actual Playwright browser cases. Python500.83s, browser60.111s;
expected7/unexpected0/skipped0/flaky0. Build/typecheck/ESLint/Ruff/Prettier/export
drift, fresh/reapply/M1+M2 migration upgrades/data preservation/zero schema diff,
seluruh M1–M9 regressions dan allseed/cache/holdout guards lulus.

[Audit M9](audits/milestone-09.md) menutup early sealed-export range admission
dan exact four-baseline/random seed verification.4cases baru,22focused tests
passed, archived public report reader exit0; no public holdout/retraining/tuning.
M10 menambah3contract/4backend/10Python/7browser cases: browser-safe canonical/
semantic parity, no-activation request contracts, managed IDs/pages/origin/RPC,
actual background success/checkpoint/log/catalog, verified/paginated dataset/model/
embedded ledger, immutable proposal/noactivation, bad path/mode/fingerprint dan
sanitized CLI errors. Supplemental37backend tests/API rebuild/lint juga lulus
sesudah read-only mark/index stream routing diperluas.

Actual Edge156.0.4314.58 (Chromium),desktop1280×720/mobile390×844:

| Case | Actual result |
| --- | --- |
| Overview/market | Verified closed OHLC chart/table/source, backend ready, no page errors |
| Config/training | Invalid risk rejected, valid restored, DB CRUD/revision/freeze, actual64step Small SUCCEEDED/checkpoints/progress |
| Cancel/paths | Separate real job CANCELLED/history, client path rejected400 |
| Evaluation |35rows/6comparisons, allseed reasons, equity/DD/nonempty baseline trades and counterfactual selection |
| Models/proposals | Comparison/verified archive/note-ack/proposal persisted after reload, activation403/origin403 |
| Mobile | Loaded chart/form/nav screenshots, no viewport overflow390px |
| Failure/retry | Explicit network503 state, retry returns actual backend data |

Final fixture `.runtime/dashboard-fixtures/mw61tlw3_5972` berasal full M9 E2E
yang diexport sesudah verified cached replay dan sebelum tamper test. Bukan fake
report atau duplicate11training. Store12models/12successful jobs+1cancelled
(11M9models lalu UI64step training/cancel),1proposal execution_ready=false.
Source synthetic `fixture` jelas; bukan market performance evidence. No public/
fixture holdout-use atau active lease. Test ports3001/5174/55433/55435 free;
owned servers/DB/jobs closed dan devDB55432 tetap stopped. Windows owner context
dipakai untuk native SWC/DB/Edge/socket; no global browser/runtime upgrade.

Initial full attempt123contracts/37backend/347Python passed dengan1M9fixture
wall-time failure240s pada last training. Fixture suite cap dinaikkan360s saja;
research gates/risk/public900s budget tidak berubah. Synthetic cache preflight
melengkapi fixture, kemudian final full run fresh lulus. First browser preflight
3passed/1failed atas exact-label locator; combobox role selector diperbaiki,
preflight berikut7/7passed54.3s, final fresh7/7passed60.111s. QA memperbaiki
chart axis/container sizing, baseline header/sidebar scroll dan production
NODE_ENV frontend build. Screenshots desktop/mobile diperiksa visual.

Protocol/report/semantic/code identities pada [handoff](handoffs/milestone-10.md)
dan `.runtime/dashboard-evidence.json`; source matches fixture protocol dan
59protected M8core files unchanged. Evidence: `verify-dashboard-final.log`,
`dashboard-report.json`, `dashboard-browser-report.json`, `dashboard-evidence.json`,
`m10-stream-unit.log`, fixture browser.json dan empat desktop/mobile screenshots.
[Dashboard guide](dashboard.md).

## Hasil M9 — Advanced Evaluation

Tanggal:7 November2026, Asia/Jakarta. Final `npm run verify:evaluation`
PASSED pada orchestrator report. Report `.runtime/evaluation-report.json`: UTC03:49:18.845–04:00:17.303
(WIB10:49:18–11:00:17). **518 tests tanpa skip**:
120 contracts +33 backend unit +334 Python +31 isolated PostgreSQL/HTTP integration.
Build/typecheck/ESLint/Ruff/Prettier/export drift, migration fresh/reapply/M1+M2
upgrades/data preservation/zero schema diff dan seluruh M1–M8 regressions lulus.
Python334 cases selesai531.69s bersamaan dengan public smoke; tidak ada DB timeout.
Cluster test ditutup orchestrator. Native SWC/DB memakai owner context seperti
milestone sebelumnya. No new dependency/migration atau lock update.
PowerShell wrapper dengan `*>` melaporkan exit1 karena Prisma menulis informational
config message ke stderr (`NativeCommandError`); seluruh checks dan final report
PASSED. Untuk capture exit native eksplisit, simpan `$LASTEXITCODE` lalu `exit`
nilai tersebut sesudah command; jangan menafsirkan stderr config sebagai test failure.

M9 menambah3 TS/19 Python cases: prespecified gates/request budgets, exact
expanding folds/purge/locked holdout, immutable protocol/source identity, duplicate
seed/ablation/scope/threshold/budget mutations, boundary reservation, exact named
cost/RR variants dengan hard risk unchanged, explicit Medium/Large research scope,
59 protected core hashes, allseed descriptive aggregation dan pooled-trade PF,
undefined/sparse/negative/risk gate failures, eligible deterministic freeze,
once-only/failure/race/overlapping holdout consumption. Full synthetic E2E memakai
11 actual background trainings,35 rows/6 comparisons,5 exploratory retrainings,
CSV/PNG artifacts, CLI reader dan identical cached rerun tanpa training baru.
Forged financial metric tetap ditolak meskipun outer/semantic hashes ditulis ulang.
Synthetic pass/freeze fixtures bukan market evidence atau public holdout access.

Explicit existing-public-data smoke dan reproducibility memakai helper
`services/quant/tests/smoke_evaluation.py`, dengan immutable protocol sebelum run.
Planned11 trainings/4224 steps, CPU1/384steps/rollout128/batch64/2epochs perjob,
max120s/3072MiB/2checkpoints; suite900s/3072MiB, max12trainings/5000totalsteps.
Primary seeds42/43/44,2 folds; four named stresses perprimary; lastfold firstseed
AI_EXIT/FIXED_RR/explicit last feature drop/Medium/Large retrain. Cache rerun bukan
independent retraining. Existing BTCUSDT1 Januari2025 UTC/M3 sealed export,
original preset/source snapshot, current metadata/declared funding restrictions;
tidak ada download atau tuning.

Split UTC: fold0 train`[00:00,10:11)`, OOS`[10:12,15:18)`; fold1
train`[00:00,15:17)`, OOS`[15:18,20:24)`;1bar purge. Untouched final holdout
`[20:24,24:00)`. Unique OOS hanya612min, jauh di bawah30hari screen requirement.
All per-fold accounts reset, bukan compounded portfolio curve. Gate minimum
30closed trades perseed/PF>=1.1/allseed+stresspositive/beatHOLD+EMA/DDcap/no risk
breach dipraregistrasi. Negative/sparse results tidak disembunyikan.

Actual public11 jobs SUCCEEDED/4224steps dan seluruh initial-vs-final parameter
hash berbeda. Job elapsed25.890–31.312s, peak sampled RSS344.988MiB. Actual params
Small47110, drop`rsi:15m`43014, Medium93702, Large236294. 35 evaluation rows dan
6 paired comparisons tanpa failed cell. Screen `insufficient_evidence`, bukan
research pass: per-seed trades21/25/25, mean fold returns−1.6910156%/−2.0312662%/
−2.06592025%, PF0; named stresses tidak positive, tidak beat HOLD/EMA dan beberapa
episodes menyentuh daily-loss latch. Original hard risk/gates tidak diubah.
Exploratory results juga loss; bukan kandidat promotion.

Protocol `3146645dd03bc69425c62b24fd41ec2947998fb1a16f54238202aafb650de2a2`;
report `6a8dbce35c5a25a40999d4963ce25017a5ddb484fb6200e3f0f65b8bcb2b4702`;
semantic SHA `3d1436527f9cecf237be80adb37c76e83fb69e90759d64c590bf303775ec2a9b`;
code `cbee12b066489686cf99af5c84cb66c4e7fa7575c1d42fe992abdbd0e5e8fb20`.
M8 protected59files/replay review lulus: original validation parameter/actions/
report/metrics identik (net−9.979526USDT). Default loader strict tetap.
Root register protocol identik dan root report CLI exit0. Freeze ditolak karena
screen tidak eligible; tidak ada public holdout marker/decisions atau promotion.
Reference equity PNG diperiksa visual: lima curves/legend/unit/OOS scope terbaca.

Public smoke selesai WIB11:09:21, total1213.474s untuk first run, independent
artifact verification/freeze denial dan cached rerun (900s budget berlaku per
runner invocation, bukan keseluruhan helper dua run). `.runtime/evaluation-smoke.json`
status passed; cached_rerun_identical=true,11 verified cache reuse/35 evaluated
rows/0 new training submissions, exact same report ID dan semantic SHA. Tidak ada
active training lease atau public holdout-use registry setelah selesai.
Direct helper memicu Matplotlib writable-cache fallback warning pada sandbox;
PowerShell redirection juga memberi wrapper exit1, sedangkan helper assertions,
terminal `smoke=passed` dan evidence JSON seluruhnya lulus. Root commands sudah
mengatur local Matplotlib cache; cache warning tidak mengubah figures/results.

Evidence: `.runtime/verify-evaluation-final.log`, `evaluation-report.json`,
`evaluation-smoke.json`, `smoke-evaluation-final.log`, `evaluation-root-*.log`,
immutable protocols/reports/cache/reviews dan linked model/simulation/baseline/job
artifacts. [Guide](evaluation.md), [handoff](handoffs/milestone-09.md).

## Hasil M8 — RL Training

Tanggal:7 November2026, Asia/Jakarta. Final `npm run verify:training` exit0 PASSED.
Report `.runtime/training-report.json`: UTC02:10:09.438–02:14:49.083
(WIB09:10:09–09:14:49). **496 tests tanpa skip**:
117 contracts +33 backend unit +315 Python +31 isolated PostgreSQL/HTTP integration.
Build/typecheck/ESLint/Ruff/Prettier/export drift, migration fresh/reapply/M1+M2
upgrades/data preservation/zero schema diff dan seluruh M1–M7 regressions lulus.
No DB timeout; test clusters ditutup oleh orchestrator. Owner context dipakai
untuk native SWC/DB sesuai pola milestone sebelumnya.

M8 menambah10 TS/25 Python cases: split alignment/rounding/half-open scopes,
train-only means/scales invariant terhadap validation/holdout mutation, unsupported
architecture/normalizer/rollout overshoot/budget rejection, real64-step optimizer
parameter changes, actual10502-param fixture network, checkpoint/retention/after-
optimization hash, exact metadata/load compatibility/checksum, mask-aware validation
replay dan two-run CPU weight/action/report reproducibility. Episode cycling tidak
melintasi validation; invalid/bankrupt transition ditolak sebelum learner, bootstrap
adapter tetap aktif. Real background success/lease/progress/publication, cancellation,
actual worker wall/RSS termination, sanitized failure, PID reuse/dead-supervisor
recovery dan concurrent Windows reader atomic progress lulus.

Initial background test mereproduksi PermissionError saat status reader membuka
progress file pada Windows; atomic replace sekarang bounded-retry20×10ms.
Actual background test dan dedicated reader regression lulus. Pinned CPU stack
Torch2.8.0+cpu/SB3+contrib2.7.0/Gym1.2.1/NumPy2.3.4/psutil7.1.0 terpasang; CUDA
tidak dipakai. `uv lock --check --offline` juga lulus setelah metadata docs update.

Pre-registered public smoke selesai09:11:24 WIB,78.808s: dua independent background
jobs, original Small preset/seed42/1024steps/rollout128/batch64/2epochs/CPU1, max
wall180s/RSS3072MiB/8 checkpoint retention. Dataset M3 existing24h; no new candles.
Split train `[00:00,16:48)`, validation `[16:48,20:24)`, untouched holdout
`[20:24,24:00)` UTC1 Januari2025. New normalizer fit783 rows hanya train.

| Evidence | Hasil |
| --- | --- |
| Job duration | 32.875s /35.391s |
| Sampled peak worker RSS | 341.012 /341.098MiB |
| Training/params/checkpoints | 1024 steps /47110 params /8 checkpoints per run |
| Two-run reproducibility | Identical normalized statistics, parameter SHA, validation actions/report |
| Validation | 216 steps,6 trades, FLAT, completed_restricted |
| Gross / fees / funding | −4.317 /5.662526 /0 USDT |
| Net / return / final equity | −9.979526 /−0.009979526 /990.020474 USDT |
| Reload | Same parameters and deterministic masked validation, ledger/metrics verified |
| Root status/cancel terminal | Both exit0; terminal cancellation idempotent, no active lease |

Holdout tidak menghasilkan decisions/metrics; validation loss tidak dituning atau
dipakai memilih best checkpoint. Candidate final requested update, execution_ready
false; profit bukan acceptance gate. ZIP bytes/model IDs boleh berbeda karena
job identity/timestamps; CPU weights/actions/reports adalah boundary repeatability.

Parameter SHA `f53176318550af3eb17fe8cb15f1c45a09b39e93c66c2ff7418da4d8136ea3f9`;
code fingerprint `472b5acd801b17c326148c35affa4e62ab6a02307728f7ab3889ff405dc0af7c`.
Evidence `.runtime/verify-training-final.log`, `training-report.json`,
`training-smoke.json/log`, `training-root-status.log`, `training-root-cancel.log`,
`artifacts/training-jobs/<uuid>/`, `artifacts/models/<id>/` beserta embedded
validation ledger. [Guide](training.md), [handoff M8](handoffs/milestone-08.md).

## Hasil M7 — RL Environment

Tanggal:7 November2026, Asia/Jakarta. Final `npm run verify:environment` exit0
PASSED. Report `.runtime/environment-report.json`: UTC01:35:00.231–01:39:25.286
(WIB08:35:00–08:39:25). **461 tests tanpa skip**:
107 TypeScript contracts +33 backend unit +290 Python +31 PostgreSQL/HTTP integration.
Build/typecheck/ESLint/Ruff/Prettier/export drift, isolated migration fresh/reapply/
M1+M2 upgrades/data preservation/zero schema diff dan seluruh M1–M6 regression lulus.
No DB timeout; orchestrator menutup test clusters. Owner execution context
dipakai untuk native SWC/isolated DB sesuai pola M1–M6.

M7 menambah10 TS dan32 Python cases: Gymnasium check_env, spaces/dtype/schema,
HOLD availability, FLAT/LONG/SHORT dan3 exit modes, sizing/risk/cooldown/pending/
forced/final interval/latency masks; readonly arrays/ledger, invalid actions,
seed/reset/close lifecycle dan no position/cost carry. Direct script/environment
memiliki identical ledger dan observations; future mutation/availability sentinel,
frozen ATR vs next-open gap revalidation, exact fee arithmetic, signed funding
before close, unrealized losing HOLD, overtrading, forced holding exit, drawdown,
negative equity tanpa clipping, one-time settlement/post-settlement observation,
raw flags/bootstrap wrapper dan immutable reward trace/reload/forgery/CLI exit0/1/2
lulus. Final checker tidak menghasilkan infinite-Box warnings karena space
mencakup finite float32 range sesuai M4 contract, tanpa clipping values.

Tambahan direct legacy verification terhadap actual M6 public artifacts:
HOLD/random42/EMA/Buy & Hold masing-masing identical action scripts, events,
trades/equity JSONL bytes dan report setelah refactor DatasetSession.
Evidence `.runtime/environment-legacy-equivalence.json`, ignored stream copies
`.runtime/m7-legacy-equivalence/`. New content IDs memang berubah karena code/lock
fingerprint, bukan perubahan accounting. Terarah M5/M6 integration36 tests juga
lulus sebelum full regression.

Public-export smoke61.587s, selesai08:36:12 WIB: original M3 dataset/frozen M4
normalizer/preset, episode `[2025-01-01 04:00,2025-01-02 00:00)` UTC, explicit M5
research policies. HOLD dan NumPy masked-random seed42 masing-masing1200 steps,
1184 valid/16 warm-up decisions; dua CLI runs/agent identik, ledger replay dan
per-step reward verifier lulus. Semua `completed_restricted`, raw truncated dan
bootstrap0, final FLAT. Root npm CLI exit0 dan menghasilkan episode ID sama.

| Agent | Trades | Net USDT | Reward sum | Fees USDT | Final equity USDT |
| --- | --- | --- | --- | --- | --- |
| HOLD | 0 | 0 | 0 | 0 | 1000 |
| Masked-random NumPy seed42 | 14 | −21.6276225 | −0.0216276225 | 13.1191225 | 978.3723775 |

Funding0, no rejected proposals pada smoke masked agent; fill revalidation rejection
diuji fixture gap. Float reward sum−0.021627622500000002 sesuai Decimal total dengan
tolerance1e-12. Hasil loss dipertahankan tanpa tuning; tidak ada training/download/
normalizer refit/credentials/order. M6 Python random baseline adalah agent/RNG
berbeda; smoke ini bukan klaim performance comparison atau RL training.

Code fingerprint `a258fa632d9016573b45ebf1fcecd517488d87804799b9e3c6b841d88a616f33`.
HOLD episode `0fed0c26f5623f1ecaff2c0c3a328389d0d506531030cf0d14eefe61a4221bd2`;
random episode `4585ef20312b005db36624bf7f168384eed5f646f471167a3038b56a57043a2c`.
Evidence ignored: `.runtime/verify-environment-final.log`, `environment-report.json`,
`environment-smoke.json/log`, `environment-root-cli.log`,
`artifacts/environments/<id>/` dan linked M5 simulations. [Guide](rl-environment.md),
[handoff M7](handoffs/milestone-07.md).

## Hasil M6 — Baseline & Simulation MVP

Tanggal:7 November2026, Asia/Jakarta. Final `npm run verify:baselines` exit0
PASSED; `.runtime/baselines-report.json` UTC01:10:19.060–01:13:56.627
(WIB08:10:19–08:13:56). **419 tests lulus tanpa skip**:
97 contracts,33 backend unit,258 Python,31 PostgreSQL/HTTP integration.
Build/typecheck/ESLint/Ruff/Prettier/schema export drift dan migration
fresh/reapply/upgrades/data preservation/zero schema diff lulus. Tidak ada test
DB timeout pada final verification. Test cluster dihentikan oleh orchestrator.

M6 menambah13 TypeScript dan22 Python cases: strict seed/strategy/request,
HOLD/single-attempt Buy & Hold, seeded state-aware random, EMA cross/close-then-
entry/Fixed RR/risk gate/gap, independent net metric example/breakeven/undefined,
four-policy fixture trades/replay/reload, future mutation prefix, different seeds,
duplicate rejection, mixed-policy provenance dan metric/script tamper detection,
invalid SHORT shock diagnostics serta CLI exit0/1/2/replay/redaction.

Initial sandbox attempt gagal saat native SWC memvalidasi pemilik cache (SID
sandbox berbeda); final full verification berjalan dengan owner context seperti
M1–M5. Tidak ada penggantian native dependency, pelemahan ACL atau timeout.
Initial invalid fixture memakai LONG downside yang tidak menembus collateral
1x/50%; corrected SHORT upside shock membuktikan diagnostic invalid branch.

Explicit public-export smoke selesai08:09:52 WIB,91.921s, dua CLI runs dengan
byte-identical output dan independent reload. Existing data/normalizer M3/M4,
episode20h, preset/risk/costs asli, seed42 dibekukan sebelum outcomes. Semua
hasil `completed_restricted`; tidak ada download, refit, tuning atau order.
Root `npm run baseline:run -- --request .runtime/baselines-smoke/request.json`
juga exit0 dengan comparison ID identik; log `.runtime/baselines-root-cli.log`.

| Strategi | Trades | Net USDT | Fees USDT | Funding USDT |
| --- | --- | --- | --- | --- |
| HOLD | 0 | 0 | 0 | 0 |
| Random seed42 | 13 | −21.376356 | 12.177356 | 0 |
| EMA crossover | 9 | −11.7493405 | 8.4768405 | 0 |
| Buy & Hold constrained reference | 0 | 0 | 0 | 0 |

Reference single entry ditolak `stop_distance_outside_limits`; bukan filled
Buy & Hold yang breakeven. Random348/EMA44 entry proposals ditolak dengan reason
yang sama; hasil dan preset dipertahankan. Fixture membuktikan reference actual
trade dan full pipeline; public zero-trade tidak ditutup-tutupi. Negative smoke
tidak berarti technical failure atau readiness/profitability gate.

Comparison `d4f107dc48082e2b315c64e06218317e73d6d51eba157d38279fec358ad08d15`;
code fingerprint `291e4e3c70af1f382b54b9ed9a89aabe46d429875e89368539b28ca1d147a373`.
Evidence ignored: `.runtime/verify-baselines-final.log`, `baselines-report.json`,
`baselines-smoke.json`, `baselines-smoke.log`, `artifacts/baselines/<id>/` dan
linked `artifacts/simulations/<id>/`. Detail scope/limitations:
[guide](baselines.md), [handoff M6](handoffs/milestone-06.md).

## Hasil M5 — Trading Simulator

Tanggal:6 November2026, Asia/Jakarta. Final
`.tools/node/npm.cmd run verify:simulation` exit0 PASSED. Report
`.runtime/simulation-report.json`: UTC13:53:03.020–13:55:05.696
(WIB20:53:03–20:55:05). **384 tests lulus tanpa skip**.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| TypeScript contracts | 84 passed (77 M2–M4 +7 simulation contract cases) |
| Backend unit | 33 passed, termasuk final-attempt cooldown audit |
| Python | 236 passed (149 sebelumnya +87 simulator cases) |
| PostgreSQL/HTTP integration | 31 passed, seluruh M1–M4 regressions |
| Build/typecheck/lint/Ruff/Prettier/export drift | Lulus |
| Fresh/reapply/M1+M2 upgrades, data preservation/zero schema diff | Lulus |
| Scripted fixture M3→M4→simulator→artifact→reload | LONG+SHORT virtual trades, deterministic replay dan reconciliation lulus |
| Callback context / no future / delays | Ledger-generated current state, frozen ATR, prefix/delayed main gating dan next-open latency tests lulus |
| Risk/funding/exits | UTC/day/DD latches, all exit modes, gap/double touch, declared schedules/intrabar rejection, terminal/envelope/bankruptcy tests lulus |
| Large policy JSON document | 1000 declared segments, report>64KiB, reload lulus dengan document bound2MiB |
| CLI | Valid exit0/replay, diagnostic invalid exit2, malformed request exit1 tersanitasi |

Run verification sebelumnya exit0 dengan383 cases; sesudah menemukan/fix parser
report document besar, final suite384 di atas mencakup regression baru dan source
terakhir. Tidak ada final DB timeout M5 dan tidak ada production timeout change.
Temporary/cluster test memakai pola M1–M4. Tidak ada migration/dependency baru.

Explicit local-only smoke `services/quant/tests/smoke_simulation.py` selesai
WIB20:56:34,14.285s; memakai existing public M3 BTCUSDT24h export dan frozen M4
normalizer, tanpa download/fit baru. Episode04:00–24:00 UTC1 Januari2025,
declared8h funding/current metadata/last-open proxy acknowledgements.
CLI dua kali+reload dan root `npm run simulation:run -- --request ...` exit0
menghasilkan artifact identik:
`4e2ac0e1d0dd2e7bff0f63b6b2ecc6454bf1ef20e0cb2b3d10abac6e2b3f3fa8`.

Hasil:1 SHORT qty0.005,hard_sl; gross−0.9205,fees0.9460445,funding0,
net−1.8665445,final wallet/equity998.1334555 USDT,FLAT.1184 valid observations,
16 warm-up unavailable,2430 events/2401 equity rows.7 entries rejected karena stop
distance dan8 closes mismatch. Script times/sides predetermined, tidak di-tune
untuk profit. LONG+SHORT dibuktikan fixture, bukan public smoke single-trade ini.
Public funding records tervalidasi terhadap declared schedule tetapi tidak ada
posisi terekspos settlement; signed cashflows dibuktikan deterministic fixtures.

Evidence: `.runtime/verify-simulation-final.log`, `simulation-report.json`,
`simulation-smoke.json`, `simulation-root-cli.log` dan ignored
`artifacts/simulations/<id>/`. File hashes/code fingerprint dan hasil per task:
[handoff M5](handoffs/milestone-05.md); formula/limitations: [simulation](simulation.md).

Audit akhir:23 Markdown docs/README (PROJECT_SPEC tidak diubah),136 local links
valid,0 trailing whitespace, `git diff --check` lulus.0 retained test clusters
running; `.env` tetap5 November2026 20:05:44 WIB dan ignored bersama runtime/
simulation artifacts. Tidak ada perubahan Prisma migrations. Setelah final suite
dan root CLI smoke, perubahan hanya dokumentasi.

## Perbaikan audit M1–M4 — 6 November 2026

Dua temuan audit diperbaiki atas instruksi pengguna:

- Final retry kini mempertahankan blocked-until dari Retry-After detik/HTTP-date
  atau reset timestamp. Tiga parameterized backend tests menjalankan12 kombinasi
  HTTP429/503/retCode10006 dan header pendek/panjang/date/reset. Test PostgreSQL
  tambahan memeriksa status PAUSED, cooldown tersimpan dan worker baru menolak
  resume tanpa request kelima.
- Main candle memakai embedded availability. Seluruh baris yang masih bergantung
  pada delayed candle berstatus stale dengan values unavailable sampai dependency
  tersedia; normalizer tidak fit baris itu, observation harus membangun ulang
  window valid. Tujuh Python cases tambahan menguji delay/dependent EMA rows,
  fit count, prefix/recovery, equality close dan invalid availability.

Sebelum source diperbaiki, targeted tests mereproduksi3 backend failures dan
4 Python failures. Setelah diperbaiki,149 Python dan33 backend unit tests lulus.
Reproduksi audit langsung kini menghasilkan blockedUntil707000 (sesuai expected)
dan delayed-main values[null]/reason stale, bukan fitur valid pada timestamp awal.

Local public-export smoke pada19:59:52 WIB lulus:495 fit rows,1185 vectors x299,
255 warm-up unavailable,720 heldout decisions. Normalizer/artifact/file SHA tetap
identik dengan hasil M4 awal. Tidak ada download baru, migration atau perubahan
config schema/artifact format. Context tetap synthetic FLAT.

Full-suite run awal setelah fix: dua legacy DB tests terkena query timeout500ms
(configuration create503 dan foundation metadata read). Test cooldown baru lulus.
Verification diulang pada cluster fresh dengan timeout aplikasi tetap sama.
**Final `npm run verify:features` exit0 PASSED**,20:01:21–20:03:10 WIB
(UTC13:01:21.993–13:03:10.374):77 contracts +33 backend unit +149 Python +31
PostgreSQL/HTTP integration = **290 tests tanpa skip**. Build/typecheck/lint/format,
contract export drift, fresh/reapply/M1+M2 upgrades, data preservation dan zero
schema diff lulus; cluster test dihentikan. Logs: `.runtime/fix-audit-m1-m4.log` dan
`.runtime/fix-audit-m1-m4-final.log`; report `.runtime/features-report.json`.
Audit dokumentasi:20 dokumen,110 local links valid,0 trailing whitespace dan
`git diff --check` lulus. Setelah final suite, perubahan hanya dokumentasi.

## Hasil M4 — Feature Engineering

Tanggal:6 November2026, Asia/Jakarta. Final command
`.tools/node/npm.cmd run verify:features`: exit0 PASSED. Report lokal
`.runtime/features-report.json`: UTC12:40:10.127–12:42:04.441
(WIB19:40:10–19:42:04). **279 tests lulus tanpa skip**.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Build/typecheck, ESLint/Ruff/Prettier, contracts export drift | Lulus |
| TypeScript contracts | 77 passed (70 M2/M3 +7 feature contract cases) |
| Backend unit | 30 passed |
| Python | 142 passed; semantic conformance, exact hashes, all23 independent indicator vectors, seeds/edge values, train-only/prefix invariance, context/shape, artifact/provenance/corruption E2E |
| PostgreSQL/HTTP integration | 30 passed; seluruh M1–M3 regression |
| Fresh/reapply/M1+M2 upgrades | Lulus; legacy data preserved, zero schema diff |
| Built process health/Python subprocess | Lulus; isolated cluster stopped |
| jsonschema promotion | 4.26.0 dev→runtime, package versions/transitive lock tetap; offline lock/sync lulus |
| Local public M3 export smoke | Lulus; fit/build CLI, replay dan artifact reload identik |

Smoke terakhir UTC12:40:52.589707 (WIB19:40:52),8.075s, memakai dataset publik M3
BTCUSDT2025-01-01 yang sudah ada; tidak ada download baru. Dataset
`3717d128-5be2-433f-90dc-ac21d3c35b54`, fingerprint
`229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa`.
Train range00:00–12:00UTC half-open menghasilkan495 fit rows. Build menghasilkan
1185 vectors x299 dan255 warm-up unavailable;720 heldout decisions pada
`[12:00,24:00)`. Context `synthetic_flat_context_on_public_market_data`, bukan
simulator/account state. Full build juga memuat close final pada Jan2 00:00UTC.

Normalizer `e9313eebe60972c72d972987e279757bfd3016b8faca0c3652db06c7a39bcfd9`;
artifact `7d34b20d9fb0f3ea010dcd618a93d705ccb8662a63fa5976a326d08f1bffb975`.
Binary SHA `91f098e6c647ecf4cc53647c2275c356c54f43546775684fc19d87148184a844`;
decision SHA `570a8878d39a816e8745495513976931cf9c318f7045309b3c4d8135a234751c`.
Report `.runtime/features-smoke.json`; command
`services/quant/.venv/Scripts/python.exe services/quant/tests/smoke_feature_export.py`.

Run awal gagal pada Windows pytest temp ownership SID. Workspace basetemp unik
dengan parent eksplisit memperbaikinya tanpa mengubah ACL global. Built API cold
startup terukur6.4s melewati polling lama sekitar5s; test startup budget kini30s,
health/database timeout aplikasi tetap. Test negatif snapshot kemudian diperbarui
agar mengharapkan checksum failure pada validator yang lebih awal. Final suite
di atas menguji source terakhir dan seluruh perbaikan, bukan hasil run gagal.

Detail formula, context dan limitations: [features](features.md);
[handoff M4](handoffs/milestone-04.md). Tidak ada simulator/training/trading claim.

Audit dokumentasi akhir:20 Markdown docs/README (PROJECT_SPEC tidak diubah),109
local links valid,0 trailing whitespace; `git diff --check` lulus. `.env`, runtime
reports dan feature artifacts tetap ignored. Timestamp `.env` tetap5 November2026
20:05:44 WIB;0 retained test clusters running. Dev DB55432 teramati stopped dan
tidak dinyalakan M4. Setelah final suite, perubahan hanya dokumentasi.

## Hasil M3 — Bybit Market Data

Tanggal:5 November2026, Asia/Jakarta. Final offline command
`.tools/node/npm.cmd run verify:market-data`: exit0 PASSED. Report lokal
`.runtime/market-data-report.json`: UTC14:58:26.357–15:00:10.168
(WIB21:58:26–22:00:10). Tidak ada dependency/runtime version upgrade dari M2.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Build/typecheck API/contracts/tests, export drift, ESLint/Ruff/Prettier | Lulus |
| Contract tests | 70 passed (52 config +18 market normalization/coverage) |
| Backend unit | 30 passed (16 foundation +14 public transport) |
| Python tests | 5 passed; structural schema/canonical vectors + CLI regressions |
| PostgreSQL/HTTP integration | 30 passed (14 M1/M2 +16 market ingestion scenarios) |
| Fresh/reapply M1–M3 migrations | Lulus; reapply no pending migration |
| M1/M2 additive upgrades | Legacy metadata/config sentinels dipertahankan; schema diff no difference |
| Resume/atomicity | Page budget/network failure resume, frozen cutoff, injected DB insert rollback dengan cursor/revisions tidak melompat |
| Worker/terminal protection | Global busy/stale owner reject, expired lease takeover, sealed finalization restart tanpa refetch, revision/dataset/member DML guards |
| Quality/fingerprint | Duplicates/order deterministic, gap/invalid/conflicts fail gate, correction leaves old dataset unchanged, incomplete excluded |
| Funding/reference variants | Signed/empty/irregular cadence dilabeli, no zero fill; mark/index volume null |
| Export/Python fixture E2E | Schema/quality/file digests/counts/ascending chronology lulus |
| Actual development migration | M3 applied ke bybit_dev127.0.0.1:55432; migrate status up to date |
| Public smoke | exit0, actual Bybit mainnet GET, completed24h BTCUSDT2025-01-01 UTC |
| Actual public export | 1440x1m +288x5m +96x15m +3 funding +instrument; zero missing/invalid/conflict,5 pages/0 retries |
| Actual Python export checker | exit0, passed files5 |
| Actual CLI download/export | completed run read idempotent, re-export digest sama; kedua commands exit0 |
| Final documentation/source checks | 17 dokumen,82 tautan lokal valid,0 trailing whitespace; git diff --check exit0; password lokal tidak ditemukan pada103 source files;0 cluster test aktif; runtime/export ignored |

Total135 automated cases ditambah orchestration/live assertions. Offline tests
tetap fixture-based untuk external HTTP, PostgreSQL nyata untuk integration.
Public smoke terpisah dan tidak disamakan dengan fixture data. Tidak ada mandatory
skip, private API, credential exchange, order, feature computation atau training.
Native cache/socket environment memerlukan approved escalated owner context
seperti milestone sebelumnya.

Actual smoke evidence `.runtime/bybit-smoke.json`: selesai UTC15:01:28.216Z
(WIB22:01:28), source bybit-mainnet. Dataset
3717d128-5be2-433f-90dc-ac21d3c35b54, download e4abb443-bc88-42cb-bdea-30b2d9139d65.
Fingerprint229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa.
Range `[1735689600000,1735776000000)`; actual metadata observation saat download,
historical funding cadence tetap unverified meskipun3 events berhasil diambil.
Execution-ready false. Artifacts/runtime di-ignore; ringkasan evidence disimpan
di source docs dan [handoff M3](handoffs/milestone-03.md).

Kegagalan awal integration disebabkan query advisory lock mengembalikan void
unsupported oleh Prisma. Setelah query mengembalikan integer, suite lulus.
Shutdown checkpoint Windows sempat melewati timeout30 detik tetapi server benar
berhenti; helper wait menjadi60 detik dan final cleanup lulus. Tidak memperbaiki
test dengan mengendurkan invariant worker/data. Diagnostic invalid-page counters
tetap dipersist tanpa memajukan cursor; cadence case memakai batch720 candles.

## Hasil M2 — Configuration System

Tanggal: 5 November 2026, Asia/Jakarta. Final command
`.tools/node/npm.cmd run verify:configuration`: exit 0, PASSED.
Report lokal `.runtime/configuration-report.json`: UTC
2026-11-05T13:46:49.156Z–13:48:06.783Z (WIB 20:46:49–20:48:06).
Runtime/dependency M1 tetap; tambahan workspace contracts dan Python dev dependency
jsonschema4.26.0 beserta transitive packages pada uv.lock.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Contracts build dan artifact export:check | Lulus, schema/preset/fixtures tidak drift |
| TypeScript build dan typecheck API/contracts/tests | Lulus |
| ESLint/Ruff/Prettier | Lulus |
| Contract unit tests | 52 passed: groups/type/range/cross-field, decimal precision/hash, preset, compatibility |
| Backend unit regression M1 | 16 passed |
| Python tests | 4 passed: 2 health CLI + shared structural schema + raw-config canonical/hash vectors |
| PostgreSQL/HTTP integration | 14 passed: 4 foundation + 10 configuration scenarios |
| Fresh/reapply migration | M1+M2 applied, reapply no pending migration |
| Upgrade M1 -> M2 | Legacy DB dibuat lewat migration M1 asli; sentinel data dan foundation marker tetap, config marker baru tersedia |
| Prisma schema diff setelah upgrade | No difference detected, exit 0 |
| Snapshot immutability | API tidak punya update/delete, raw SQL UPDATE/DELETE/TRUNCATE ditolak, FK parent deletion ditolak |
| Concurrency | Satu CAS update menang; stale409; concurrent snapshots ID sama; snapshot/edit race tidak mencampur payload/revision |
| Invalid input/no-write | Create/update invalid400 tanpa record/revision berubah; corrupt/unsupported snapshot409 |
| Compatibility | Exact/incompatible/retraining/reevaluation report; approval/execution selalu not_assessed |
| Failure responses | Storage unreachable503 tersanitasi, validation tetap tersedia; M1 health/error regressions lulus |
| Built-process E2E | API live/ready sebelum/sesudah schema, invalid startup nonzero, Python subprocess valid |
| Development migration | Additive M2 applied ke bybit_dev127.0.0.1:55432; migrate status up to date |
| Final documentation/source verification | 14 dokumen, 60 tautan lokal valid, 0 trailing whitespace; git diff --check exit0; password lokal tidak ditemukan pada 79 source files; 0 cluster test aktif |

Total 86 automated test cases ditambah orchestration smoke/migration assertions.
Tidak ada test wajib di-skip; tidak ada Bybit network call, training atau order.
Test clusters dan built smoke API dihentikan runner, development DB tetap running.
Native cache/socket membutuhkan eskalasi context pemilik workspace seperti M1.
Schema JSON/Python tests hanya structural; semantic execution parity Python belum
diklaim. PostgreSQL immutability membatasi ordinary DML, bukan admin DDL.

Satu fixture awal duplicate position input melebihi max array length sehingga
menguji structural length sebelum semantic duplication; fixture diperbaiki dengan
duplikasi dalam panjang yang valid. Sebelum final verification, nama constraint
dan updated_at default diselaraskan agar tidak ada schema drift. SQL M1 tidak diubah.

## Hasil historis M1 — Project Foundation

Tanggal: 5 November 2026, Asia/Jakarta. Runtime aktual: Node 24.22.2, CPython
3.12.12, PostgreSQL 17.10, NestJS 12.3.3, Prisma/client/adapter 7.10.1, TypeScript
5.9.3, Vitest 5.1.0, pytest 9.2.0. Dependency exact lainnya pada lockfiles.

| Command / pemeriksaan | Hasil aktual |
| --- | --- |
| `python scripts/bootstrap.py` | Exit 0; runtime portable di workspace, archive SHA256 dicatat |
| `.tools/node/node.exe scripts/tasks.mjs setup` | Exit 0; locked npm/uv deps, Python env, development DB dan migration siap |
| `.tools/node/npm.cmd run verify:foundation` | Exit 0, PASSED; terakhir 20:10:38–20:11:27 WIB |
| Prisma generate + TypeScript build/typecheck | Lulus |
| ESLint API/scripts dan Ruff check/format | Lulus |
| Prettier format check | Lulus; scope source TS/JS/JSON, tidak memindai Python runtime/cache |
| Vitest unit | 2 file, 16 tests lulus |
| Pytest | 2 tests lulus, tanpa cacheprovider agar tidak tergantung ownership cache sandbox |
| Vitest integration | 1 file, 4 tests lulus, dedicated PostgreSQL nyata |
| Migration from empty/reapply | Apply satu migration, reapply tanpa pending/duplicate marker |
| Built API sebelum migration | Actual HTTP readiness 503, liveness 200 |
| Built API setelah migration | Actual HTTP readiness/liveness 200 |
| ORM transaction | Read/write dan rollback terverifikasi, probe tidak tertinggal |
| Invalid marker dan DB unreachable | Readiness 503 tersanitasi, bounded, liveness tetap 200 |
| Invalid startup environment | Built API exit nonzero |
| Python subprocess | JSON health valid dan runtime 3.12; dari root melalui isolated executable |
| Development DB lifecycle | db:stop/status/start/migrate/status exit 0; status false lalu true |
| Cleanup | Proses built smoke API dan cluster test dihentikan runner |
| Source secret/ignore check | Generated local DB password tidak ditemukan dalam 51 source files sebelum final docs sync; .env/runtime/venv/generated client ignored |
| Final documentation/source check | 12 dokumen, 47 tautan lokal valid, 0 trailing whitespace, git diff --check exit 0; password lokal tidak ditemukan pada 52 source files; 0 cluster test aktif |

Report lokal terakhir `.runtime/foundation-report.json`: status passed, UTC
2026-11-05T13:10:38.335Z sampai 13:11:27.095Z. Report runtime di-ignore; ringkasan
hasil dipertahankan di dokumen ini dan [handoff M1](handoffs/milestone-01.md).
Tidak ada network/API Bybit, real/demo order, training atau profit test.

Verification dijalankan dengan execution context pemilik workspace melalui
eskalasi environment: socket sandbox dibatasi dan native SWC cache menolak SID
sandbox yang berbeda. Tidak ada test wajib di-skip atau diganti mock sebagai
pengganti PostgreSQL. Unit test sengaja memakai dependency fake untuk menguji
timeout/error; integration dan built API smoke menggunakan PostgreSQL nyata.

Masalah yang diperbaiki sebelum final pass: pg_ctl inherited pipe menyebabkan
runner hang Windows; test ConfigService generic type; native cache path; Ruff
explicit check=False; formatter traversal cache permission; merge config Vitest
yang sempat mengulang unit dalam suite integration. Final suite terpisah 16+2+4.

## Catatan penutupan M0 (historis)

M0 hanya dokumentasi. Saat M0 ditutup belum ada unit/integration/contract test
atau runtime aplikasi. Hasil di bawah adalah pemeriksaan dokumen, bukan
bukti aplikasi atau trading berhasil. Tanggal: 5 November 2026, Asia/Jakarta.

| Pemeriksaan | Hasil |
| --- | --- |
| Git dan inventaris awal | Working tree awal bersih; hanya PROJECT_SPEC.md dan .git; baseline commit a7cf3ef |
| Kelengkapan delapan dokumen | Lulus; 8/8 file ditemukan dengan pemeriksaan PowerShell |
| Tautan Markdown lokal | Lulus; seluruh target lokal ditemukan, 0 tautan rusak |
| Task M0 0.1–0.18 dan task M1–M16 | Lulus; 284 ID task unik spesifikasi tercantum dalam roadmap, 0 hilang |
| Whitespace diff | Lulus; `git diff --check` exit 0; pemindaian delapan file baru juga menemukan 0 trailing whitespace |
| Accounting walkthrough | Lulus pemeriksaan aritmetika PowerShell; LONG 4,795 dan SHORT 4,805 dalam toleransi 1e-9 |
| Konsistensi scope/status | Pada penutupan M0: Completed setelah penerimaan pengguna, M1 belum Approved |
| Review/penerimaan pengguna | Diterima melalui `oke ku approve`, 5 November 2026, Asia/Jakarta |

Pemeriksaan PowerShell dijalankan dari root repository: enumerasi delapan file,
regex task list spesifikasi `(?m)^- (\d+\.\d+)\b` dibanding ID dalam roadmap,
resolusi target Markdown relatif terhadap setiap dokumen, scan whitespace, dan
evaluasi dua contoh aritmetika. Command pemeriksaan menghasilkan exit 0.
`git diff -- PROJECT_SPEC.md` tidak menghasilkan perubahan. Karena file baru
masih untracked, `git diff --check` sendiri tidak mencakup isinya; pemindaian
file eksplisit dilakukan untuk melengkapinya. Tidak ada file di-stage atau commit.
Kecocokan task ID memverifikasi coverage nomor, bukan kebenaran implementasi.

## Strategi implementasi berikutnya

Fixtures deterministik menjadi dasar. Unit test tidak bergantung pada API Bybit;
network/account integration adalah lapisan terpisah dan diberi label lingkungan.
Semua hasil report menyebut command, environment, hasil aktual, skips dan blocker.
Test yang tidak dijalankan tidak boleh ditulis lulus. Setiap bug kritis diberi
regression scenario yang menguji behavior, bukan menyalin implementation.

| Gate | Skenario minimum | Oracle / invariant |
| --- | --- | --- |
| M1 foundation | API health, DB migration/connectivity, Python process dan command tests | Proses berjalan; DB benar-benar dijangkau, exit code/error benar |
| M2 config/contracts | Type/range, cross-field SL/exit/RR, model shape, duplicate snapshot write | Invalid ditolak, snapshot lama tidak berubah, hash stabil |
| M3 ingestion | Reverse pagination, duplicate, gap, incomplete/out-of-order OHLC, timeout/rate limit, resume | Chronological valid data, no silent fill, quality count/fingerprint sesuai fixtures |
| M4 features | Indicator reference values, warm-up, HTF boundary, perturb future data, feature toggle | Masa depan tidak mengubah observation masa lalu; active features benar-benar masuk |
| M4/M8 preprocessing | Train-only fit, changed validation/test distribution | Artifact train tidak berubah; no refit saat evaluation/live |
| M5 accounting | Long/short, partial close, fees, spread/slippage, signed funding, round/reject | Wallet+UPnL=equity, margin bukan expense, no double count, ledger conserved |
| M5 timeline | Next-bar fills, gap stop, SL/TP both hit, funding at boundary, duplicate exit | No retroactive fill; conservative priority; satu exposure ditutup sekali |
| M5 risk | Qty minimum/step, fee-aware size, margin cap, daily reset, DD latch, zero equity | Entry reject bila risk tidak valid; restart tidak menghapus latch |
| M5 terminal | Dataset end, forced exit, gap/split, nonpositive equity | Settlement dan fee terakhir masuk ledger; no cross-split position |
| M6 baseline | HOLD, seeded random, EMA, Buy & Hold di data/split/cost sama | HOLD tanpa costs return 0; comparison melaporkan exposure/constraint |
| M7 env | reset seed, step contract, masks seluruh position/exit modes, terminated/truncated | Gymnasium checker + mask-aware cases; HOLD valid; forced exits independen |
| M7 reward | Overtrade, losing hold, realized conversion, funding, terminal close | Sum reward = net equity change / initial capital; tidak reward fee avoidance palsu |
| M8 train | Bounded CPU smoke, masked eval, save/load, corrupted artifact, cancel/crash | Valid actions, same observation compatibility, job terminal state persisten |
| M9 evaluation | Multi-seed, walk-forward, sensitivity, holdout access, undefined metrics | Semua seed/failure dilaporkan; no test tuning; null+reason untuk undefined |
| M10 UI | API loading/error/empty, invalid config, job start/cancel, charts, model compare | Backend nyata; no fake live results; mode capability terlihat |
| M11 paper | Duplicate/late candle, reconnect/backfill, feature parity, inference failure, restore | Satu decision per closed candle; shared accounting; no exchange orders |
| M11 conformance | Risk sizing/reject/stop/rounding/defaults TypeScript vs Python fixtures | Decision dan quantity konsisten sesuai toleransi yang ditetapkan |
| M12 adapters | Wrong environment, credential isolation, unknown/manual position, capability mismatch | Block entry, no cross-account state, no secret dalam log |
| M12/M13 lifecycle | Lost ACK, partial fills, cancel race, WS duplicate/out-of-order, timeout | No duplicate create/exit; execution dedupe; confirmed exposure/protection |
| M13 Demo | Actual Demo open/fill/stop/TP/close + account reconciliation | IDs/executions/position/stop evidence; API ACK saja tidak cukup |
| M14 faults | DB/disk/network/worker loss, clock drift, missing stop, restart, restore backup | Entry blocked; protection preserved; recovery tidak mengambil posisi manual |
| M15 Real readiness | Dry-run with order transport disabled, activation flags, no autoresume | Tidak ada real order; readiness report dan separate money approval |

## Walkthrough planning

Contoh numerik pada [planning](planning.md) dicek ulang terhadap rumus: LONG net
4,795 dan SHORT net 4,805 untuk asumsi yang dicantumkan. Nilai ini menjadi calon
fixtures M5, belum executable regression tests. Timeline juga direview untuk
next-bar execution, ambiguity, funding, risk close dan terminal settlement.

## Acceptance M0

| Kriteria spesifikasi | Evidence |
| --- | --- |
| Ambiguities resolved atau explicitly documented | Planning R01–R16, owner/deadline |
| MVP boundaries clear | Planning checkpoint M6/M8/M10 dan out-of-scope |
| Architecture responsibilities clear | Architecture ownership dan ADR-02 |
| Critical trading risks identified | Risk register, safety/order/risk design |
| Implementation dependencies identified | Roadmap phase/dependency/gates |
| Documentation foundation established | README dan delapan dokumen planning |
| Planning reviewed and accepted | Terpenuhi: `oke ku approve`, 5 November 2026 |

Integration/contract/regression tests aplikasi tidak berlaku untuk deliverable
dokumentasi M0. M1 dan seterusnya tetap wajib memenuhi tests relevan sesuai
spesifikasi. Review akhir pengguna telah diterima; seluruh acceptance criteria M0
terpenuhi. Persetujuan ini tidak mencakup implementasi M1.
