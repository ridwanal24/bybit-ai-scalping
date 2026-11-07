# Catatan keputusan

Tanggal semua entri: 5 November 2026, Asia/Jakarta. **Baseline spesifikasi** berarti
requirement yang sudah diberikan pengguna. **Usulan M0** berarti pilihan desain
dalam deliverable planning yang diterima melalui `oke ku approve` pada 5 November
2026; detail deferred tetap harus diselesaikan sebelum gate terkait. Penerimaan
planning bukan izin eksekusi live. **Deferred** memiliki deadline dalam
[risk register](planning.md).

## ADR-01 — Milestone sebagai unit approval

- Status: baseline spesifikasi; pelaksanaan M0 Approved.
- Konteks: proyek panjang memerlukan scope dan handoff yang dapat diaudit.
- Keputusan: satu milestone per siklus. Pesan pengguna `eksekusi milestone 0`
  menyetujui plan M0 dalam chat ini, mencakup delapan dokumen yang direncanakan.
- Alternatif: persetujuan per task atau implementasi seluruh roadmap sekaligus.
- Alasan/tradeoff: scope terkendali tanpa interupsi per task; memerlukan review
  dan dokumentasi tiap milestone.
- Konsekuensi: tidak menjalankan M1, credential, database, training atau order.
  Approval plan M0 dan penerimaan hasil planning dicatat sebagai dua kejadian
  berbeda. Hasil diterima melalui `oke ku approve` pada 5 November 2026;
  acceptance akhir M0 terpenuhi dan status Completed.

## ADR-02 — Ownership historical dan live

- Status: baseline simulator Python tunggal; detail Paper/conformance usulan M0.
- Konteks: simulator ganda dapat menghasilkan PnL training/backtest berbeda.
- Keputusan: Python simulator bersama untuk baseline, Gymnasium dan evaluation.
  ObservationBuilder Python juga dipakai inference real-time. Paper menggunakan
  accounting Python; NestJS memegang operational state/order lifecycle. NestJS
  risk live independen dari inference dengan shared fixtures/conformance tests.
- Alternatif: simulator TypeScript kedua; seluruh proteksi live hanya Python.
- Alasan/tradeoff: satu sumber accounting dan proteksi operasional independen;
  tetap ada dua implementasi risk yang perlu verifikasi semantic equivalence.
- Konsekuensi: conformance wajib M11 dan tidak boleh memberi model hak bypass.

## ADR-03 — Transport batch lokal dahulu

- Status: usulan M0; inference transport Deferred ke M11.
- Konteks: single-machine CPU, dataset besar, pekerjaan training lama.
- Keputusan: subprocess CLI tanpa shell, JSON Lines protocol, artifact references,
  persistent backend job status dan cancellation. Satu worker aktif awal.
- Alternatif: FastAPI untuk semua job; Redis/Celery/broker sejak foundation.
- Alasan/tradeoff: dependency sedikit dan failure isolation proses; memerlukan
  supervisor, schema messages, restart/cancellation handling yang eksplisit.
- Konsekuensi: jangan spawn proses per tick untuk live; ukur persistent inference
  sebelum M11. Batas CPU/RAM/time final setelah inventaris resource dan benchmark.

## ADR-04 — Snapshot dan wire format berversi

- Status: baseline immutable/reproducibility; format desimal usulan M0.
- Konteks: data/config berubah, dua bahasa berbeda dan artifact di filesystem.
- Keputusan: schema bersama, decimal strings untuk uang/quantity, UTC millis,
  finite tensors, canonical hash, immutable dataset export/config snapshot,
  artifact checksum/manifest serta code/dependency/seed metadata.
- Alternatif: JSON float untuk semua uang; run membaca config/data mutable.
- Alasan/tradeoff: audit dan pengulangan run lebih jelas; konversi/validator dan
  lifecycle DB–filesystem perlu implementasi serta tests.
- Konsekuensi: jangan deduksi compatibility dari shape saja atau mengubah dataset
  run lama lewat perbaikan candle global. Tool validator/ORM Deferred M1/M2.

## ADR-05 — Eksekusi bar dan reward sederhana

- Status: closed candle/no leakage/SL baseline; detail timeline dan reward usulan M0.
- Konteks: OHLC tidak menunjukkan urutan intrabar atau memastikan fill live.
- Keputusan: keputusan sesudah close, fill paling awal next open, adverse costs,
  SL-first jika ambigu, funding berdasarkan event timestamp, terminal settlement
  dilabeli. Reward delta net equity dibagi initial capital positif, tanpa shaping.
- Alternatif: fill retroaktif pada close; optimistic TP-first; log reward awal;
  tick simulator langsung.
- Alasan/tradeoff: deterministik dan accounting mudah ditelusuri; bar approximation
  tetap tidak menangkap mikrostruktur, gap fill aktual atau liquidation lengkap.
- Konsekuensi: conservative fixtures M5, reward invariants M7. Restricted margin/
  liquidation envelope wajib disepakati sebelum M5, bukan klaim realism futures.

## ADR-06 — Risk latching dan ownership

- Status: hard safety baseline; daily anchor/reset dan breach action usulan M0.
- Konteks: unrealized losses, restart dan foreign activity dapat menyesatkan state.
- Keputusan: usulkan equity basis, daily anchor UTC persisten, drawdown high-water
  per run/deployment; breach block entry dan controlled close posisi bot. Dedicated
  account/one-way diusulkan; unknown/manual position memblokir, tanpa auto-adopt.
- Alternatif: realized-only daily loss; reset latch restart; mengambil alih semua
  posisi pada simbol.
- Alasan/tradeoff: kerugian terbuka tidak tersembunyi; lebih ketat dan memerlukan
  keputusan reset/manual review serta account ownership yang dapat dibuktikan.
- Konsekuensi: finalisasi R06/R07 sebelum M2/M5 dan R13 sebelum Demo. Default
  numeric spec tidak diubah; M0 belum menetapkan hard limits baru untuk live.

## ADR-07 — Ledger order dan fail-safe

- Status: baseline ACK≠fill/no blind retry; persistence detail usulan M0.
- Konteks: timeout tidak membuktikan create order gagal; fills bisa parsial.
- Keputusan: durable intent sebelum submit, unique client ID, execution dedupe,
  pending/unknown block entry, reconciliation sebelum retry/resume, stop tetap
  aktif sampai flat/pengganti terkonfirmasi. Emergency actions dipisahkan.
- Alternatif: retry create setiap timeout; local action dianggap posisi final.
- Alasan/tradeoff: mencegah duplicate exposure; memerlukan query recovery dan
  state machine yang menangani partial/cancel/out-of-order events.
- Konsekuensi: fault injection M12–M14 dan capability verification tiap environment.

## ADR-08 — Gates model dan Real

- Status: baseline spesifikasi; ambang statistik Deferred M9.
- Konteks: training selesai/profit satu backtest bukan bukti kelayakan live.
- Keputusan: Candidate → Validated → Paper → Demo → Real melalui bukti dan approval;
  normalization train-only, frozen model, no auto online retraining/deployment.
  Promotion criteria ditetapkan sebelum evaluasi keputusan. Real disabled by
  default, tidak autoresume, rollout dana membutuhkan izin operasional terpisah.
- Alternatif: deploy seed terbaik otomatis; auto-switch Demo ke Real.
- Alasan/tradeoff: evaluasi dan recovery dapat diaudit; promosi lebih lambat dan
  hasil negatif dapat menghentikan rollout walau executor telah siap.
- Konsekuensi: M15 dry-run dipisahkan dari izin real order. Tidak ada target profit
  atau capital rollout yang ditentukan M0.

## ADR-09 — Implementasi foundation lokal M1

- Status: diimplementasikan dalam plan M1 yang disetujui melalui `lakukan`.
- Konteks: Node global 26.13/Python 3.15 tersedia, Docker tidak ditemukan;
  PostgreSQL Laragon 14.5 ditemukan belakangan pada lokasi nonstandar.
- Keputusan: workspace-local Node 24.22.2, uv 0.13.7, CPython 3.12.12,
  PostgreSQL 17.10 portable; npm/uv cache dan runtime state lokal. Tidak mengubah
  PATH permanen, global runtime, service atau cluster Laragon.
- Backend: NestJS 12.3.3 ESM/TypeScript 5.9.3, Prisma/client/adapter 7.10.1 + pg,
  ConfigModule/Zod, Vitest 5.1.0/SWC, ESLint/Prettier. Python pytest/Ruff,
  tanpa dependency RL pada foundation.
- Alternatif: menggunakan runtime global yang belum diverifikasi kompatibel,
  instalasi Docker/system service atau memakai cluster pengguna existing.
- Alasan/tradeoff: setup dapat diulang tanpa menimpa mesin pengguna; unduhan
  cukup besar dan bootstrap saat ini spesifik Windows x64. Native cache/socket
  memerlukan context pemilik workspace untuk verification dalam environment ini.
- Konsekuensi: package/runtime locks dan limited npm install-script policy
  dikomit sebagai source nanti; artifact/secret tetap ignored. Registry `latest`
  Prisma sempat menunjuk 8 RC, tetapi implementasi tetap pada jalur 7 plan.
- Database: satu tabel app_metadata + marker schema, migration versioned.
  Liveness independen, readiness menguji marker DB dengan timeout dan error
  tersanitasi. Runtime/script/transaction/HTTP integration lulus, bukan hanya mock.
- Provenance: Node dan uv dibanding checksum upstream; PostgreSQL checksum
  pertama dihitung dari unduhan HTTPS EDB dan dipin untuk berikutnya. Tidak
  mengklaim checksum PostgreSQL pertama berasal dari independent upstream digest.

## ADR-10 — Configuration contracts, revisions dan snapshots M2

- Status: diimplementasikan dalam [plan M2](plans/milestone-02.md), Approved
  melalui `gw approve`; seluruh acceptance dan regression tests lulus.
- Konteks: konfigurasi berubah selama penelitian tetapi hasil lama harus dapat
  ditelusuri, dan TypeScript/Python tidak boleh memiliki wire schema berbeda.
- Keputusan: `@bybit/contracts` menjadi source Zod schema/semantic rules, dengan
  generated JSON Schema dan shared structural/hash fixtures. Tambahan Python
  dev dependency jsonschema4.26.0 dipin uv.lock; runtime/ORM M1 tidak di-upgrade.
- Alternatives: dua schema manual, mutable config yang dirujuk eksperimen,
  float comparison untuk risk, atau snapshot yang hanya readonly di controller.
- Alasan/tradeoff: satu structural contract, exact decimal dan immutable DB DML
  guards membantu reproducibility; JSON Schema tidak membawa seluruh cross-field
  semantics, sehingga Python runtime semantic conformance tetap gate M4/M5.
- Canonical/hash: normalize hanya field decimal yang dideklarasikan, sort keys,
  preserve arrays dan opaque artifact IDs; SHA256 UTF-8. Name/UUID/timestamps di
  luar config hash. Invalid unknown keys/precision/types ditolak sebelum persistence.
- Persistence: draft full replacement + expectedRevision CAS. Snapshot memakai
  row lock dan unique source/revision, retry idempotent; old snapshot tidak berubah
  sesudah draft edit. DB triggers menolak UPDATE/DELETE/TRUNCATE; superuser/owner
  DDL bisa bypass dan belum dianggap anti-tamper admin.
- Compatibility: exact config/schema/behavior comparison, bukan promosi model.
  Market/features/network/exit/SL/RR/training berubah memerlukan retraining/evaluation;
  risk/cost/mode berubah memerlukan re-evaluation/behavior review. Semua tetap
  not_assessed untuk model approval/execution readiness tanpa artifact/bukti.
- R06/R07: synthetic research preset dan equity/UTC/latch semantics disimpan sesuai
  plan yang disetujui, bukan tarif Bybit atau hard limit live. Engine baru M5/M11.
- Consequences: migration M2 additive dengan dua tabel + metadata marker,
  constraint names dipetakan eksplisit ke Prisma. Fresh/reapply/M1 upgrade dan
  zero schema diff teruji, development schema up to date; tidak mengubah M1 SQL.
- Evidence: 52 contract + 16 unit backend + 4 Python + 14 integration tests, plus
  built process/migration E2E. Source/artifact drift dan static checks lulus.

## ADR-11 — Resumable public ingestion dan pinned dataset M3

- Status: implemented dalam [plan M3](plans/milestone-03.md), Approved melalui
  `lanjutkan`; offline verification dan bounded public smoke lulus.
- Konteks: Bybit pages descending, rows bisa overlap/revised, download panjang
  bisa crash dan current instrument rules belum membuktikan historical validity.
- Keputusan: built-in fetch public GET fixed-host/no redirects/credential, bounded
  retries/rate/cooldown. Server cutoff dipin, UTC intervals dan last/mark/index
  variant dipisahkan. Candle/funding/instrument schemas dan Python vectors tracked.
- Alternatif: SDK/dependency baru, overwrite candle upsert, state memory-only,
  mengisi gap/funding kosong dengan0, atau menunggu download panjang dalam HTTP.
- Alasan/tradeoff: minimal external dependency dan reproducible data, dengan
  storage revision/membership lebih besar serta CLI/checkpoint/lease lifecycle.
- Persistence: append-only revisions, membership pinned, global single-worker
  lease/advisory lock, page records+cursor transaction. Stale token tidak commit;
  sealed membership sebelum hash; dataset/run completion atomic. Export streaming
  temp/checksum/rename, DB immutable tetap source jika file export gagal.
- Quality: strict invalid/gap/conflict/empty gate, duplicate/out-of-order counters,
  source fixture vs public eksplisit. Metadata current-only dan funding cadence
  unknown tidak dihilangkan dari report. READY bukan simulation/live readiness.
- Hash: canonical normalized content + ordered stream/funding digests + metadata
  hash dan format/policy; tidak memasukkan UUID/download time/retry count/config
  non-market. Snapshot provenance tetap tersimpan pada dataset/export envelope.
- Evidence:135 cases (70 contract,30 backend,5 Python,30 integration), fresh/
  reapply/M1+M2 upgrade tanpa schema drift, actual BTCUSDT2025-01-01 public dataset
  1824 candles+3 funding, export/Python validation dan idempotent CLI.
- Perbaikan kompatibilitas: query advisory lock mengembalikan integer, bukan void
  yang tidak dapat dideserialisasi Prisma; shutdown wait60 detik untuk Windows disk
  checkpoint, tanpa force-kill. Tidak mengubah runtime major/credential/old migrations.

## ADR-12 — Causal features, explicit context dan frozen normalizer M4

- Status: implemented sesuai [plan M4](plans/milestone-04.md), Approved melalui
  `lanjut` pada 6 November 2026. Evidence aktual pada [testing](testing.md).
- Keputusan: standard-library Python indicator/rolling state, SMA-seeded EMA,
  Wilder RSI/ATR, documented 23-ID catalog, closed-HTF backward as-of join dan
  gap/warm-up unavailable. Shared schemas/generated vectors membuktikan semantic
  configuration parity sebelum quant computation.
- Alternatif: TA library defaults, pandas joins tanpa availability contract,
  implicit zero fill, fitting semua histori atau memasukkan current context ke
  setiap historical window row. Ditolak karena seed/leakage/shape ambiguity.
- Layout: ordered market matrix row-major, lalu current position/risk sekali,
  dimension W*F+P+R (default299), finite float32 little-endian. Context memakai
  explicit caller as-of dan deterministic scaling; risk enforcement tetap M5/M11.
- Normalizer: Welford population statistics pada explicit train role/range, frozen
  artifact dengan schema/source/symbol binding. Context bukan invented fit sample.
  Canonical decimal-string statistics menghindari cross-language JSON float hash.
- Persistence: local content-addressed manifests/checksums, exclusive atomic
  publish/verify dan snapshot provenance, tanpa migration/registry baru. Config
  variant memerlukan verified source snapshot; API payload/camelCase dan portable
  envelope diterima. Source snapshot/dataset lama tidak dimutasi.
- Dependency: jsonschema4.26.0 dipromosikan dev→runtime tanpa upgrade version;
  tidak menambah NumPy/pandas/TA-Lib/ML. Tradeoff throughput pure Python belum
  dibenchmark setahun; prefix replay correctness mendahului optimasi live M11.
- Batas: historical availability/current instrument/funding caveats M3 tetap
  berlaku, hash bukan signature, default smoke context diberi label synthetic FLAT.
  Tidak membuat simulasi, model, order atau klaim predictive performance.

## ADR-13 — Exact ledger dan restricted deterministic simulator M5

- Status: implemented sesuai [plan M5](plans/milestone-05.md), Approved melalui
  `kerjakan`. Satu historical Python engine dipakai kembali oleh M6/M7, tanpa
  trading/backend accounting kedua atau dependency baru.
- Financials: Decimal precision128, currency quantum1e-18/adverse rounding,
  margin collateral bukan expense, one-time fees/realization dan signed funding.
  Config/data/schedule/normalizer/source versions masuk immutable artifact.
- Event contract: closed decision, earliest eligible next open, funding old
  position sebelum gap protections/close/new entry; gap SL lalu capped gap TP
  mendahului discretionary exit. Intrabar ambiguous SL-first, book pada close
  dengan phase eksplisit, tanpa guessed exact tick time atau retroactive fills.
- Alternative: optimistic OHLC fills, floating financial ledger, full Bybit
  liquidation tiers/limit order model saat data mark/tier/history belum tersedia.
  Dipilih research envelope yang bisa diuji dengan honest unsupported gates.
- Restriction: market/last/1x, one position, entry notional/margin<=50% equity,
  declared aligned funding schedule, last-open funding proxy, current metadata
  acknowledgement. Adverse collateral/bankruptcy invalid tanpa fake exit.
- Risk: UTC anchor sebelum boundary funding, daily latch tidak cleared oleh
  recovery, sampled high-water DD latch lintas hari, forced next-open/holding/
  cooldown dan terminal settlement. External cashflow/foreign state ditolak.
- Shared fixtures/schema: independent LONG/SHORT profit/loss dan UTC risk latch
  vectors; NestJS live risk equivalence tetap gate M11, bukan klaim lulus M5.
- Publication: streaming JSONL + report/descriptor documents, checksum and ledger
  verification sebelum rename, existing content ID hanya verify. Actual runtime
  version/architecture/code/contract/lock fingerprints disimpan. Report documents
  memiliki limit2MiB terpisah dari per-record JSONL64KiB.
- Consequence: no production readiness/profit claim, unsupported configs ditolak,
  full-year throughput/backup/registry/resume/jobs masih milestone terkait.

## ADR-14 — Causal baselines, shared replay dan constrained reference M6

- Status: implemented,7 November2026; [plan M6](plans/milestone-06.md) Approved
  melalui `oke lanjutkan eksekusi Milestone 6`.
- Semua policy memakai runner M5, M4 valid observations/current ledger context,
  same costs/risk/sizing/next-open/funding. Random local seeded Python instance;
  EMA berasal dari main-timeframe M4 fast/slow periods, bukan normalized values.
- Alternative: simulator vectorized kedua atau reference exposure100% tanpa
  stops. Dipilih shared execution agar accounting/constraints bisa dibandingkan.
  Buy & Hold dilabeli constrained perpetual single-attempt long reference;
  bukan spot benchmark. Protection/forced exit tetap aktif, no reentry.
- Evaluator streaming merekam script, replay melalui publisher/verifier M5,
  menuntut report identik lalu mengikat strategy/seed/script/linked simulation
  di immutable comparison. Verifier mengecek common provenance dan recompute
  metrics, tidak hanya trusting outer hash. Tidak ada dependency/migration.
- Metrics memakai exact net accounting dan sampled equity/open exposure. Undefined
  memakai null+reason; invalid run tidak diberi performance metrics. Separate
  slippage attribution/Sharpe belum tersedia, alasannya eksplisit. Tidak ada
  ranking/promotion gate atau klaim OOS/live readiness.
- Consequence: dua simulator passes plus verification meningkatkan biaya CPU/I/O.
  Memory streaming bounded; full-year throughput belum dibuktikan. Standalone
  archive harus membawa linked simulation artifacts. M7 tidak otomatis dimulai.

## ADR-15 — Incremental shared timeline dan settled Gymnasium episodes M7

- Status: implemented,7 November2026, instruksi `lanjutkan eksekusi M7`,
  [plan M7](plans/milestone-07.md). Scope7.1–7.11, bukan training M8.
- Extract DatasetSession dipakai historical runner/M6/TradingEnv, bukan rewrite
  simulator. M4 features/normalizer/context dan M5 exact financial transitions
  tetap satu source. Existing four M6 public policies terbukti identical script,
  events/trades/equity bytes dan report setelah refactor; IDs berubah karena
  source/lock fingerprint, bukan accounting semantics.
- Gymnasium1.2.1/NumPy2.3.4 dipin/lock sebagai tested compatibility baseline.
  Alternative: memasang seluruh Torch/SB3 stack sebelum environment stabil.
  Dipilih dependency minimum; M8 memvalidasi stack learner bersama versinya.
- Mask dari known current state/reference/ATR/sizing, bukan future fill price.
  Pending/forced/availability/risk/final boundary gates + execution revalidation.
  Fresh finite float32 observations; unavailable memakai sentinel/HOLD+info.
- Reward net delta equity/initial capital, Decimal128 lalu float, tanpa shaping.
  Costs, funding, losing unrealized dan settlement masuk reward sekali.
- Raw risk/bankruptcy terminated dan data boundary truncated. Independent
  settlement memutus portfolio continuation sehingga bootstrap_discount0.
  SettledEpisodeWrapper mempertahankan raw flags/reason dan truncated sambil
  terminated=true sebagai absorbing learning boundary untuk standard learner.
  Alternative: bootstrap terminal flat/reset capital atau menyamakan data boundary
  dengan risk failure; ditolak. M8 memakai adapter dan reject invalid rollouts.
- Streaming action/transition hashes + linked M5 replay/report, verifier mengecek
  setiap step equity/reward terhadap ledger. Gym API checker, deterministic/
  reward-hacking tests dan fixed local public-export smoke tersedia.
- Consequence: explicit settlement convention, diagnostic invalid episodes dan
  unavailable-observation info harus dihormati learner. Tidak ada profit/model/
  live readiness claim; full-year/learner throughput belum dibenchmark.

## ADR-16 — Bounded CPU MaskablePPO, train-scoped preprocessing dan persistent jobs M8

- Status: implemented,7 November2026, `gas eksekusi m8`;
  [plan M8](plans/milestone-08.md), task8.1–8.16.
- Chronological70/15/15 aligned splits, train-only normalization, explicit episode
  boundaries/cycling, validation with separate account, holdout unevaluated. No
  random candle shuffle/refit validation/cross-split positions.
- Small pi/vf[64,64], MaskablePPO/MlpPolicy CPU1 env/thread, configured hyperparams,
  explicit epochs/resource budget. Reject unsupported architecture or rollout
  rounding overshoot, check actual parameter count and trained parameter change.
- Pin Torch2.8.0+cpu official CPU index, SB3/contrib2.7.0 with existing Gym1.2.1/
  NumPy2.3.4. Actual Windows training/reload proven; seed/threads/deterministic
  algorithms recorded. Alternative latest stack upgrade without compatibility
  proof ditolak; no CUDA/Optuna/distributed training M8.
- Reuse M7 masks/absorbing settlement, reject invalid samples before learner.
  Custom deterministic masked validation replays into M5 artifacts/exact metrics.
  Final candidate is final requested update; no best-checkpoint selection on
  holdout or efficacy/promotion claim. Save/load repeats identical parameters/
  validation decisions/report. Metadata/checksum/config/runtime/code gate precedes
  deserialization. ZIP bytes/IDs may differ; CPU weights/actions reproducibility
  is the checked boundary, not cross-platform bitwise portability.
- Local Python persistent hidden supervisor/worker, exclusive lease/locks, atomic
  status/progress, checkpoint retention/cancellation/watchdog and failure recovery.
  Alternative database job/registry/dashboard implementation now deferred to M10;
  CLI supplies actual M8 background/progress capability without unrelated migration.
  Windows reader-vs-replace sharing race resolved with bounded atomic retry.
- Resource limits are CPU thread/env/step cap and sampled RSS/wall watchdog,
  not OS affinity/kernel memory cap. Cancellation/process kill uses verified PID+
  creation time, with2s cooperative grace. Failed/cancelled/limited jobs have no
  successful model ID. Known power-loss/admission/commit orphan recovery is manual;
  no unsafe automatic resume of RNG/optimizer/episode state.
- Model archive includes frozen config/normalizer/splits/source/runtime/seed/code/
  risk/funding/reward/schema and complete verified validation ledger. Candidate
  models remain execution_ready=false. M9 approval/promotion gates not granted.

## ADR-17 — Preregistered walk-forward research dan frozen holdout M9

- Status: implemented,7 November2026, `lanjut eksekusi M9`;
  [plan](plans/milestone-09.md), task9.1–9.19, [guide](evaluation.md).
- Immutable protocol mendahului compute: exact source/config/code/data, seeds,
  expanding folds/purge, variants, resource envelope dan numeric research gates.
  Preserve15% holdout; independent account/normalizer perfold. Alternative random
  candle split atau post-hoc seed/threshold selection ditolak.
- Primary3 seeds/2 folds; all-seed descriptive mean/median/std dan trade-pooled PF,
  paired M6 HOLD/random/EMA/constrained BuyHold pada exact scope. Curves reset
  antar fold, bukan continuous compounded portfolio atau confidence interval.
- Fixed2x fee/slip dan RR1.5/3 counterfactuals memakai weights sama tetapi actions/
  sizing recomputed, deployment incompatible. Exit modes/feature drop/Medium/
  Large retrain pada lastfold/reference seed saja; exploratory bukan promotion
  evidence. M8 explicit research scope memungkinkan variants, defaults tetap.
- Research screen minimum30 unique OOS days/30 trades perseed/PF>=1.1/positive
  everyseed+stress/beat HOLD+EMA/no riskbreach+DDcap. Gates tidak diturunkan agar
  smoke lulus. Public satu hari insufficient, terlepas dari outcome keuntungan.
- Frozen candidate first preregistered seed/lastfold; append-only holdout boundary
  reservation, atomic fsync started sebelum inference, overlaps across protocols
  ditolak; failures/crashes tetap consumed. Final holdout memiliki independent
  positive/PF/trade/DD/risk gates. Semua results execution_ready=false, tanpa
  otomatis registry promotion atau exchange activation. Stale lock perlu audit.
- Strict loader code mismatch tetap. Optional reviewed M8 fingerprint+59 protected
  core hashes+runtime/data/archive checks+identical original validation replay
  menghasilkan certificate, bukan blanket model compatibility.
- Verified content-addressed report JSON/Markdown/curves/PNG/actions, full matrix
  dan independent linked artifact/metric/screen verification. Verified training
  cache rerun membuktikan deterministic inference; tidak disebut independent
  training reproduction. No new dependencies/migration/HTTP job API M9.
- Consequence: repeated simulator replay/verification mahal pada CPU/I/O; full-year
  throughput dan production/distributed registry belum dibuktikan. Local filesystem
  owner masih dapat mengedit markers; signed registry/access control tetap scope
  berikutnya. R10 memiliki gate numerik; market evidence tetap belum cukup.

## ADR-18 — Local research dashboard, bounded quant bridge dan proposal-only deployment M10

- Status: implemented dan verified546tests/7actual browser,7 November2026.
  Instruksi audit ulang M9 lalu lanjut M10; [plan](plans/milestone-10.md),25tasks.
- Local React19.3.1/ReactDOM/types19.3.0 pada existing Vite8.3.6; Playwright1.65.0
  untuk actual browser QA. No charts/runtime state framework tambahan: SVG charts
  berasal actual backend rows; hash navigation sederhana mencakup6 research pages.
- Alternative mock frontend atau duplicate TypeScript training/evaluator ditolak.
  Nest validates config/source/dataset from DB, fixed Python argv/JSON stdin RPC
  calls existing M8 jobs/M9-M6-M5 readers. Bounded120s/16MiB responses/no shell,
  origin guard untukresearch mutations; no remote/CORS wildcard/secret transport.
- M2 immutable snapshots/revision handling dan M3 sealed export identity tetap
  authoritative. Browser-safe pure contract entry menghindari Node crypto pada
  bundle; server SHA/canonical semantics tidak berubah. Editable parameter forms
  plus complete validated JSON; server remains semantic authority.
- Quant artifacts tetap persistent registry/jobs/evaluation source. No speculative
  DB mirror/migration/scheduler. Readonly details independently verified; indexed
  summaries explicit. Proposal history append-only checksum/frozen identities,
  bukan active model, promotion atau operational approval. Semua activate requests
  ditolak; Paper/Demo/Real membutuhkan later readiness milestones.
- Actual backend/DB/browser tests memakai isolated store. Existing full M9 test
  exports its verified synthetic matrix before tamper test untuk reuse di browser;
  tidak menggandakan11 training. No public holdout/new market download.
- Consequence: hashing/ledger verification cukup mahal, UI loading/paging/retry
  explicit. Local-only process/artifact registry bukan signed/distributed service.
  Full-year workload/auth remote/runtime trading tetap belum diimplementasikan.

## Keputusan yang masih terbuka setelah M10

M5 menutup pilihan R05 untuk restricted research saja: lihat ADR-13;
full exchange liquidation realism tetap di luar kemampuan simulator ini.

R01–R16 pada [planning](planning.md) mencatat owner, milestone deadline dan dampak.
Sebelum milestone terkait diimplementasikan, plan harus menyelesaikan pilihan yang
memblokir acceptance-nya atau mengajukan perubahan scope eksplisit. Dokumen ini
tidak mengubah requirement penting PROJECT_SPEC.md.
