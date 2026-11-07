# Milestone 10 — Dashboard

Approved melalui instruksi `cek ulang ... m9 ... lanjut eksekusi m10`,7 November2026.
Audit M9 menutup early dataset-range rejection dan exact baseline set/seed checks;
22 focused tests lulus. Semua19 task tetap tersedia; archived public report dibaca
ulang tanpa membuka holdout atau retraining untuk mengubah hasilnya.

Scope seluruh task10.1–10.25, bukan M11 realtime/Paper execution. Frontend lokal
React19.3.1/ReactDOM19.3.1, TypeScript/Vite8.3.6 existing, pinned types19.3.0 dan
Playwright1.65.0 untuk real browser integration/responsive QA. Versi registry
dan [React](https://react.dev/versions), [Vite](https://vite.dev/guide/backend-integration.html),
[Playwright](https://playwright.dev/docs/browsers) diperiksa sebelum install.

## Implementation

1. `apps/web` React/Vite workspace, accessible hash routing/navigation, responsive
   research terminal: Overview, Configuration, Market data, Training, Experiments,
   Model registry. Vite same-origin `/api` proxy ke Nest loopback; build static.
2. Existing M2 configuration CRUD/validate/snapshots dipakai untuk market/features/
   risk/SLTP/RR/exit/network/training/execution. Form edits meaningful typed fields,
   validation feedback, draft revisions/conflicts, frozen snapshots. No silent
   preset/hard-risk override. Custom architecture/config tetap divalidasi M2;
   current training envelope ditampilkan dan dijaga backend M8.
3. Nest `research` API menjembatani bounded Python JSON stdin RPC tanpa shell atau
   client paths. Lists/jobs/progress/cancel/logs/checkpoints, verified model/detail,
   evaluation/detail/curves/trades/baselines, sealed local datasets/candles/quality.
   Quant artifacts tetap source of truth, DB config/snapshots tetap M2 source.
   No parallel job controller/simulator atau dependency Torch upgrade.
4. Start training dari real DB snapshot+sealed export+explicit research assumptions/
   resource caps. Frozen copies lalu M8 persistent supervisor; polling/cancel,
   terminal failure dan restart history. API request abort tidak membunuh job;
   cancel explicit. Single-worker lease/resource watchdog tetap M8.
5. Historical candles dari verified export/DB; SVG candlestick/equity/drawdown charts
   dengan accessible summaries dan exact numeric source display. Bounded paging
   untuk curves/trades/candles; no fabricated live balance/position/prices.
6. Experiment/evaluation history dan all-seed/stress/exploratory/baseline metrics;
   linked simulation trades/curves. Model comparison manual selection, no best
   seed auto-promotion. Model detail integrity/runtime/code/config compatibility.
7. Deployment UI menyimpan immutable **research deployment proposal** (target mode,
   frozen model/config/report identities, manual note, blockers); history terlihat.
   Proposal bukan active deployment atau status Validated/Paper Approved. M11–M15
   readiness dan actual exchange lifecycle belum ada, sehingga activation disabled
   dan server menolak activation/Real requests. No credentials/orders.
8. Loading/empty/error/retry states, input/error focus, mobile/desktop accessible
   navigation, async stale-response/poll cleanup, no hidden holdout execution route.

## Storage dan validation

No new DB migration: existing snapshot DB plus managed immutable quant artifacts
dan append-only local deployment proposals. Backend owns paths/limits/allowlists;
readonly detail verification mendahului penggunaan model/report. Malformed/corrupt
records explicit unavailable; no raw subprocess paths/log secrets in HTTP errors.
Local mutation origin guard; loopback-only Vite/API; no public hosting/MCP/Sites
registration karena PROJECT_SPEC mengharuskan local development dan staged remote
access review. Sites local-preview guidance dipakai, retained repo React/Vite choice.

Tests: focused M9 audit, Python RPC/start/cancel/verified readers/pagination/path and
promotion guards; Nest HTTP integration with actual Python+dedicated PostgreSQL;
Playwright real browser config CRUD/start/progress/cancel/history/evaluation/charts/
comparison/proposals/errors, desktop/mobile screenshots. Full M1–M9 regressions,
build/typecheck/lint/format/schema drift/migration regression. No new market download,
public holdout use, tuning, model activation or automatic M11.

Acceptance: all25 tasks, user configures research/controls training/views real
experiments/compares models; backend data throughout. Docs/ADR/audit/handoff updated
with actual evidence and limitations; no claims of profitable or operational model.
