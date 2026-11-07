# Milestone 10 — Dashboard

Tanggal:7 November2026, Asia/Jakarta. Approved melalui instruksi audit ulang M9
lalu lanjut M10. [Plan](../plans/milestone-10.md), seluruh task10.1–10.25.

## Final Status

**Completed**. Seluruh25tasks dan5 acceptance criteria lulus. Tidak ada approval
atau implementasi M11 realtime/Paper/Demo/Real execution. Proposal bukan aktivasi.

## Audit M9 sebelum M10

[Audit](../audits/milestone-09.md) menemukan dan menutup dua gaps: early rejection
range di luar sealed export sebelum holdout reservation, dan exact four-baseline
strategy set/random seed pada independent report verifier. Empat regression cases
baru,22 focused tests passed, public archived report reader exit0. Semua19task M9
tetap tersedia; hasil publik tidak diubah/tuning, holdout tetap tidak dipakai.
User instruction yang sama mengotorisasi M10 sesudah gaps selesai tanpa ACC pertask.

## Implemented Features dan How It Works

`apps/web` menyediakan6 local React/Vite pages: Overview, Configuration, Market
data, Training, Experiments, Model registry. Hash routing, responsive layout,
accessible inputs/actions, backend loading/empty/error/retry states. Brand lokal
Stratum adalah UI research proyek yang sama, bukan service/trading account lain.
Data sebenarnya dari Nest M2 snapshots/PostgreSQL dan verified M3–M9 artifacts;
tidak ada mock live prices/balance/positions atau hidden external service.

Configuration form mencakup market/features/periods/window/risk/SLTP/RR/exit/
execution assumptions/network/training. Existing M2 semantic validation, draft
revision conflict handling dan immutable snapshots tetap authoritative. Browser
contracts memisahkan pure canonical JSON dari Node crypto; SHA hashing tetap
server-owned tanpa perubahan identity semantics. Configuration edits invalidate
selected local snapshot; save/freeze explicit sebelum training.

Nest ResearchModule memvalidasi IDs/body/pagination/origin, mengambil frozen DB
configuration/source snapshot serta sealed dataset metadata, lalu memakai fixed
Python module argv dan JSON stdin. Bounded120s/16MiB/no shell/no client paths,
hidden child dan sanitized errors. Python adapter menggunakan M8 persistent jobs,
M9 reports/M6 comparisons/M5 ledger verifiers; tidak membuat simulator/controller
lain. Jobs tetap hidup setelah HTTP/browser ditutup; cancel explicit/idempotent.

Candlestick charts memakai closed historical export rows. Metrics/equity/DD/
trades memakai verified simulation ledger; baseline rows dapat di-inspect ke
ledger tersendiri. Curves1000points/page dengan explicit load-more, trades50/page,
candles120/page. SVG mengikuti container width agar axis terbaca pada mobile;
Number hanya chart coordinates/display, exact financial values tetap strings.
All folds adalah independent accounts, bukan continuous compounded portfolio.

Registry menampilkan indexed summaries, independent archive review/current code
dan runtime compatibility serta manual2–4model comparison. Different evaluation
scopes diberi warning; tidak ada best-seed auto-selection. Deployment UI menyimpan
immutable checksummed proposal target backtest dengan note/ack/frozen identities/
blockers. Model tidak promoted/active. Paper/Demo/Real targets unavailable;
backend `/research/activate` menolak403 walau tombol client dilewati.

## Completed Tasks

| Task | Deliverable |
| --- | --- |
| 10.1 React/Vite | React/DOM19.3.1, types19.3.0, existing Vite8.3.6, pinned npm lock |
| 10.2 Routing | Six-page hash navigation, unknown route/skip-to-content |
| 10.3 Layout | Local research terminal, sidebar/topbar/panels/actual data |
| 10.4 Navigation | Accessible links/current page, horizontal mobile nav |
| 10.5 Overview | Actual datasets/jobs/candidates/reports, historical preview/readiness |
| 10.6 Market config | Symbol/timeframes/history fields, research-only mode |
| 10.7 Feature config | All23features per enabled timeframe, periods/window/complete JSON |
| 10.8 Risk config | Capital/trade/daily/DD/exposure/leverage/holding/cooldown/limits |
| 10.9 SL/TP/RR | Three exit modes, ATR/stop/cost allowances, fee/spread/slip inputs |
| 10.10 Network config | Small/Medium/Large/Custom, pi/vf layers/activation, envelope explicit |
| 10.11 Training config | Steps/rollout/batch/seed/episodes/learning parameters/resources |
| 10.12 Config API | Actual validate/CRUD/revisions/frozen DB snapshots |
| 10.13 Historical page | Verified exports/streams, quality/provenance/coverage/pages |
| 10.14 Candlesticks | Actual closed OHLC SVG/chart/table, UTC/timeframe scope |
| 10.15 Training controls | Real snapshot admission/start/cancel through M8 persistent jobs |
| 10.16 Progress | Two-second polling/status/events/checkpoints/RSS/terminal usage |
| 10.17 History | Persisted jobs/advanced reports/training validation histories |
| 10.18 Metrics | Actual M6 metrics/undefined reasons/allseed screen/failed gates |
| 10.19 Curves | Verified equity/DD, explicit partial pages/load-more |
| 10.20 Trades | Exact ledger side/time/quantity/price/netPnL/reason + pagination |
| 10.21 Comparison | Manual2–4models, scope warning, archived validation evidence |
| 10.22 Deployment UI | Verified review + immutable research proposal/history, activation denied |
| 10.23 Async states | Loading/empty/error/retry, abort cleanup, persistent job recovery |
| 10.24 Responsive | Desktop1280×720/mobile390×844 QA, chart width and viewport overflow |
| 10.25 Integration | Real browser/API/isolated PostgreSQL/actual quant artifact workflow |

## Files Created/Modified

- `apps/web/`: React pages/shared API/types/charts/CSS/Vite/TS config and Playwright
  actual integration tests. Root workspace/package/npm lock includes exact dependencies.
- `apps/api/src/research/`: bounded QuantBridge/controller/module; AppModule/env
  wiring and unit boundary tests. Existing M2/M3 services reused.
- `services/quant/src/bybit_quant/dashboard.py`: managed catalog/dataset/job/
  model/report/baseline/simulation/proposal operations, stdin CLI/errors.
  `test_dashboard.py`: actual background training, verified readers/paging/proposals,
  bad paths/modes/fingerprint and sanitized CLI failures.
- M9 admission/report fixes and4 regression cases; explicit test-only fixture export
  of verified full M9 matrix before its tamper test untuk browser reuse.
- Contracts dashboard start/proposal schemas, browser entry/pure canonical module,
  unchanged server hash behavior; generated schemas dan3 contract tests.
- Root build/typecheck/lint/format/verify dashboard commands, local dev launcher,
  isolated browser DB/server/owned job cleanup. No new DB migration/HTTP executor.
- README/architecture/ADR18/planning/progress/roadmap/testing/operations dan
  dashboard guide/audit/plan/handoff. Historical M8/M9 handoffs tetap historical.
  Original public source data/snapshot/preset/risk defaults/.env/credentials tidak diubah.

## Tests Executed dan actual evidence

Focused M9 audit22passed, actual M10 RPC10passed; browser preflight7/7passed
54.3s terhadap dedicated PostgreSQL55435/API3001/Vite5174 dan synthetic store,
bukan mocked backend. Edge headless156.0.4314.58, desktop1280×720/mobile390×844.
Browser membuktikan save/validate/freeze, actual64-step Small job SUCCEEDED dan
checkpoints, actual cancel terminal/history, verified M9 report/baselines/equity/
DD/nonempty random-baseline trade history, model comparison/proposal/reload,
activation/cross-origin rejection, network503/retry dan no viewport overflow.
Screenshots desktop/mobile diperiksa; final verification evidence ada pada testing.

Final `npm run verify:dashboard` **exit0/PASSED** UTC06:54:39.781–07:06:40.002
(WIB13:54:39–14:06:40),546tests tanpa skip:123contracts/37backend/348Python/
31isolated PostgreSQL-HTTP integration/7browser. Build/typecheck/ESLint/Ruff/
Prettier/export drift/fresh+reapply+M1/M2 upgrade/data preservation/zero schema
diff seluruhnya lulus. Python500.83s, browser60.111s, unexpected/skipped/flaky0.
Read-only mark/index stream routing juga lulus supplemental37backend tests;
API dibuild ulang dan focused lint lulus sebelum final browser dijalankan.

Final fixture `.runtime/dashboard-fixtures/mw61tlw3_5972`:11actual M9 trainings,
35rows/6comparisons, lalu actual UI64step Small training SUCCEEDED dan separate
job CANCELLED. Total12model archives/12successful jobs+1cancelled;1persisted
proposal tetap execution_ready=false. No active fixture lease/public or fixture
holdout-use. Test ports3001/5174/55433/55435 free; devDB55432 stopped/unchanged.
Screenshots desktop-overview/desktop-experiments/mobile-overview/mobile-configuration
dan browser version JSON tersimpan pada fixture. `.runtime/dashboard-evidence.json`
merekonsiliasi reports/counts/identities/cleanup, bukan mocked UI state.

Final synthetic protocol `ce1bbafe94ef1ace0003cee22a95a2737d44fda6136d3344f0da92565b830e70`;
report `5b96cff13fd502fc65d2aab87a51ccf4279b1b0b1aeada10420c857beb66c152`;
semantic `f890232259783d955b2fda2e7692b8db6ea1ca6c9134f417a2a83df274bd8577`;
current code `579dd92aee1d45da937c15914d0f7f0860cd05bee908e2a17e534791a23bd031`.
Protocol code matches current source,59protected M8 core files tetap identik.

Initial full regression:123 contracts/37backend dan347 Python cases lulus,
satu M9 full fixture gagal wall-time240s pada last training. Fixture budget saja
diubah360s untuk hardware timing margin, bukan gates/data/public budget. Cached
synthetic preflight melengkapi fixture tanpa membuka public holdout. First browser
preflight menemukan exact-label selector; accessible combobox locator diperbaiki.
QA juga memperbaiki container-based chart scale/table header/sidebar scrolling dan
memastikan frontend build selalu NODE_ENV=production (371kB bundle, bukan dev build).

## Acceptance Criteria Verification

| Criterion | Evidence |
| --- | --- |
| User mengonfigurasi penelitian | Actual field edits/invalid+valid validation/CRUD/revision/freeze workflow |
| Training dikontrol | Actual start/SUCCEEDED/checkpoints dan independent cancel/CANCELLED |
| Hasil eksperimen terlihat | Verified report/allseed/gates/baselines/curves/trades dan validation tab |
| Model dapat dibandingkan | Actual2–4archive summaries dengan scope/parameter/return/PF/DD evidence |
| Data sebenarnya dari backend | Browser actual API+PostgreSQL+real trained synthetic archives, no fake live values |

## Known Issues, Technical Debt dan Remaining Tasks

Remaining mandatory tasks: tidak ada. Research limitations: local artifact/index
registry dan filesystem integrity bukan distributed/signed authorization. Large
reports cukup mahal untuk verify;120s RPC cap/explicit loading/paging berlaku.
Only Small default training endpoint; Medium/Large memakai existing M9 CLI/scope.
Declared8h funding proxy UI adalah explicit research assumption, bukan exchange
history certification. Source/instrument/funding restrictions M5 tetap berlaku.
No ingestion UI/remote login/actual runtime activation/new data or full-year efficacy
claim. Production packaging, remote auth/recovery dan Paper/Demo/Real lifecycle
tetap milestones berikutnya. No profitability/promotion claim; M9 public report
tetap insufficient_evidence dan public final holdout tidak dievaluasi.

## How to Run dan Next Milestone

Sesudah setup, `npm run dev:dashboard`, buka `http://127.0.0.1:5173`.
API3000/Vite5173/project DB55432; stop owned servers Ctrl+C, DB via `db:stop`.
Full verification: `npm run verify:dashboard`. [Guide](../dashboard.md).
Runtime evidence: `.runtime/dashboard-report.json`, `verify-dashboard-final.log`,
`dashboard-browser-report.json`, `.runtime/dashboard-fixtures/<id>/` screenshots.
Jangan memakai synthetic fixture sebagai market performance evidence.

M11 — Paper Trading hanya next information; memerlukan instruksi baru. Baca
PROJECT_SPEC/progress/architecture/roadmap, M8–M10 guides dan handoff ini. Bangun
real-time feed/inference/virtual account persistence/risk/recovery dengan actual
tests, tanpa exchange order atau melewati frozen model compatibility/readiness.

**Waiting for Next Milestone Instruction.**
