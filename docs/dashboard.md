# Dashboard riset lokal M10

React/Vite di `apps/web`, Nest API di `apps/api`, bounded Python RPC di
`bybit_quant.dashboard`. Ini research platform, bukan live trading console.
Data yang ditampilkan berasal dari PostgreSQL configuration/snapshots dan verified
quant artifacts M3–M9. Balance/position/live feed tidak dibuat-buat.

## Jalankan

```powershell
.\.tools\node\npm.cmd run dev:dashboard
```

Build contracts/API/frontend, pastikan port3000/5173 kosong, lalu jalankan API
`http://127.0.0.1:3000` dan UI `http://127.0.0.1:5173`. Project PostgreSQL55432
dinyalakan bila perlu; database lain tidak dihentikan atau direset. Ctrl+C
menghentikan servers yang dimiliki launcher; DB tetap tersedia sampai
`npm run db:stop`. Untuk proses terpisah: `db:start`, `dev:api`, `dev:web`.
Source API changes perlu build/restart; Vite frontend reload otomatis.
`npm run build` juga menghasilkan static frontend `apps/web/dist`.

Untuk menjalankan hasil build produksi lokal, hentikan dev launcher lalu jalankan
`npm run build` dan `npm run start:dashboard`. Buka `http://127.0.0.1:3000`;
Nest menyajikan built UI dan API dengan prefix `/api` pada port yang sama,
`NODE_ENV=production`, tanpa Vite server. Readiness berada pada
`http://127.0.0.1:3000/api/health/ready`. DB portable tetap55432 dan tidak otomatis
berhenti saat server ditutup. Ini production build lokal, bukan deployment publik.
Panduan dari clone tanpa tool: [README](../README.md#menjalankan-aplikasi-dari-clone-baru).

Loopback-only, same-origin Vite `/api` proxy; tidak ada CORS wildcard, public
hosting, account login atau remote deployment. Remote access memerlukan review
auth/secrets tersendiri sesuai PROJECT_SPEC. Jangan expose dev proxy ke internet.
`DASHBOARD_ROOT` adalah trusted server environment untuk isolated test artifact
store; browser tidak dapat memasok root atau file path. Default repo artifacts.

## Alur penggunaan

1. **Configuration:** pilih preset dari backend atau load saved draft. Edit
   Market, Features/periods/window, Risk, Exits/fees/slippage, Network dan Training.
   Fractions menggunakan decimal, misalnya0.005 =0.5%. Complete JSON editor
   mendukung configuration v1 penuh; invalid JSON/schema tidak mengganti form.
2. Validate memakai M2 server semantic checks. Save draft memakai expected
   revision (stale conflict tidak di-overwrite). Freeze snapshot hanya sesudah
   save; perubahan parameters membatalkan selection snapshot lokal. Snapshot
   tetap immutable dalam DB. Reload browser tidak memulihkan unsaved form.
3. **Market data:** pilih sealed local export/stream, lihat source/coverage/
   quality dan closed candles. Chart/table memakai data asli; candle pages120bars.
   Tidak ada download/ingestion baru dari UI M10. Existing M3 download/export
   API/CLI tetap tersedia. Dataset perlu tercatat di DB dan memiliki matching
   local sealed export sebelum training; catalog read tidak membutuhkan synthetic
   DB rows atau fabricated frontend data.
4. **Training:** frozen snapshot+dataset/range+explicit wall/RSS/epochs dan
   acknowledgement current metadata/declared8h funding/last-open proxy. Schedule
   ini asumsi eksplisit research; data dengan cadence lain perlu CLI policy yang
   sesuai. Start memakai persistent M8 controller; single active lease, CPU1,
   train-only preprocessing,70/15/15 dan2 checkpoint retention. Default endpoint
   tetap Small; Medium/Large lewat preregistered M9 research scope, Custom tidak
   dieksekusi. Errors/range/resource mismatch ditolak saat admission.
5. Status/progress dipoll2detik, structured recent events/checkpoint names dan
   terminal usage tersedia. Cancel explicit/idempotent dan tetap tercatat.
   Menutup browser/request tidak membatalkan persistent job. Jika acknowledgement
   jaringan hilang saat start, periksa history sebelum mencoba start lagi.
6. **Experiments:** pilih advanced report (all seeds/WFO/stresses/exploratory,
   baseline comparison/reasons/gates) atau training validation. Report detail
   menjalankan independent M9 verifier; loading dapat cukup lama karena hashing
   model archives/linked ledgers. Failure/undefined metrics tidak disembunyikan.
   Equity/DD chart bersumber ledger, trades memakai exact strings. Curve pages
   1000points (load-more explicit), trade pages50; initial curve bukan diam-diam
   diklaim seluruh episode bila masih ada pages. Antar fold account reset.
7. **Model registry:** select2–4 indexed summaries untuk side-by-side network/
   parameters/seed/dataset/scope/exit/metrics. Scope mismatch diberi warning;
   tidak ada automatic best-seed/winner selection. Review model memverifikasi
   archive dan current code/runtime compatibility sebelum proposal.
8. **Deployment proposal:** simpan target backtest research, manual note dan
   research-only acknowledgement. Immutable record membawa frozen model/config/
   normalizer/parameter/dataset/validation identities dan compatibility blockers.
   Riwayat bertahan setelah reload. Proposal **bukan** model aktif, promotion atau
   Paper approval. Paper/Demo/Real target dan activation tidak tersedia; server
   menolak activation meskipun client mengabaikan disabled button.

## Backend contract dan storage

Existing `/configuration-presets`, `/configurations` CRUD/validate/snapshots tetap
source of truth M2. Additive `/research` routes:

| Method/path | Behavior |
| --- | --- |
| GET `/catalog?offset=0&limit=100` | Paginated datasets/models/evaluation/job summaries; unavailable artifacts explicit |
| GET `/datasets/:uuid?stream=last:1m&offset=0&limit=120` | Verify sealed export dan closed candle page |
| POST `/jobs` | Strict snapshot/dataset/range/resources/policy; DB source snapshot to managed M8 admission |
| GET `/jobs/:uuid` | Persistent state/progress, last100 structured events, checkpoint names |
| POST `/jobs/:uuid/cancel` | Explicit cancellation, empty JSON body |
| GET `/models/:sha` | Verified archive, validation and current code/runtime blockers |
| GET `/evaluations/:sha` | Independent verified full M9 report |
| GET `/baselines/:sha` | Verified M6 comparison and actual metrics |
| GET `/simulations/:sha?kind=equity&offset=0&limit=1000` | Verified ledger stream (equity/trades); model_id supports embedded validation ledger |
| GET/POST `/deployment-proposals` | Immutable local research proposals/history |
| POST `/activate` | Always403; execution unavailable |

SHA/UUID IDs strict, page sizes1–1000, offset<=1million, no client path/command.
Start body memakai [dashboard-start schema](../packages/contracts/schemas/dashboard-start-v1.schema.json),
proposal memakai [proposal schema](../packages/contracts/schemas/dashboard-proposal-v1.schema.json).
Argv Python tetap: module+trusted root; operation/args JSON lewat stdin, tanpa shell.
RPC wall120s, stdout16MiB, hidden child; sanitized errors, no raw subprocess stderr
atau credentials ke browser. Mutation Origin wajib same host bila disediakan.
Existing JSON-only configuration mutations tetap same-origin tanpa CORS opt-in.

No new DB migration. Existing M2 snapshots/M3 dataset metadata tetap PostgreSQL;
M8 jobs/models/M9 evaluations tetap local managed artifacts. New
`artifacts/deployment-proposals/<uuid>.json` append-only checksummed records.
UI catalog memuat100 summaries terbaru percategory dan saved configurations20
terbaru; older records tetap tersedia melalui existing API pagination. Tidak ada
penghapusan otomatis artifact/history saat list mencapai page cap. Historical
viewer menerima verified last/mark/index streams bila tersedia dalam export;
training/execution tetap mengikuti last-price restricted policy.
Local owner dapat mengedit file: hashes bukan signatures/access control.
Index summaries structural/indexed; actual detail/use memerlukan verifier.
Archive original linked models/simulations/baselines/protocols/holdout markers
bersama-sama; current code change tidak menulis ulang archive identities.

Browser contracts memakai `@bybit/contracts/browser` untuk schema/semantic
validation/pure canonical JSON. SHA256 identities tetap server-owned; bundle tidak
memuat Node crypto polyfill. Decimal calculations/accounting tetap Python/M2,
Number hanya display/graph coordinates, bukan ledger recalculation.

## Verification

```powershell
.\.tools\node\npm.cmd run verify:dashboard
```

Full build/typecheck/lint/format/export drift/TypeScript/Python/migration/HTTP
regression, lalu Playwright terhadap actual API+dedicated PostgreSQL55435 dan
isolated synthetic artifact store. Verified M9 E2E export dipakai ulang sebelum
tamper regression, sehingga tidak menggandakan11training untuk browser setup.
Browser tests melakukan config CRUD/validation/freeze, actual training completion,
cancel/history, report/baselines/curves/trades, model comparison/proposal/reload,
blocked activation/cross-origin, network failure retry, desktop/mobile overflow
dan screenshots. Test store/servers/DB terpisah dari development dan market artifacts.

Windows QA memakai installed Microsoft Edge headless melalui pinned Playwright;
tidak mengubah browser global. Platform lain memerlukan Playwright Chromium yang
sesuai. Dependency frontend React/DOM19.3.1, types19.3.0, Vite8.3.6 dan
Playwright1.65.0 dipin npm lock; pinned CPU stack M8 tidak berubah. Browser version
aktual/hasil screenshots dicatat di evidence. Tidak ada live account, network
market download, public holdout use atau activation pada verification.

Full-year throughput, signed/distributed artifact registry, remote auth, actual
Paper/Demo/Real lifecycle dan production deployment bukan kemampuan M10.

Final verification7November2026:546tests lulus tanpa skip, termasuk7actual browser
cases pada Edge156.0.4314.58,desktop1280×720/mobile390×844. Source/public holdout
tidak diubah atau dipakai. [Evidence](testing.md), [handoff M10](handoffs/milestone-10.md).
