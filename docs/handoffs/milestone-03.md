# Milestone 3 — Bybit Market Data: implementation report dan handoff

Tanggal:5 November2026, Asia/Jakarta. Final status: **Completed**.
Approval: `lanjutkan` setelah [plan M3](../plans/milestone-03.md) disajikan,
scope task3.1–3.17 dan bounded public GET smoke. M4 belum Approved.

## Implemented features dan how it works

Public-only Bybit REST client mengambil server time/instrument, historical
last-traded OHLCV, required mark/index OHLC dan signed funding. Client fixed-host,
redirect disabled, bounded response/timeout/retry/rate/cooldown, tanpa credential.
API membuat request dari config snapshot M2; CLI worker melakukan download agar
HTTP request tidak menunggu panjang. Data timestamp UTC/range `[start,end)`.

Server cutoff dan descriptor dipin; unsafe/unclosed/outside candles tidak masuk
data secara diam-diam. Backward cursor/page writes atomic. Lease token/expiry dan
global unique RUNNING index + advisory transaction lock membatasi worker lintas
proses. Pause/crash/resume tidak memajukan cursor tanpa data commit. Membership
sealed sebelum stream hash; READY/QUALITY_FAILED dataset dan COMPLETED run atomic.

Revision rows append-only, memberships pinned. Duplicate identik didedup;
conflicting values dalam run fail quality; dataset baru dapat merujuk revision
berbeda tanpa mengubah dataset lama. Final quality/fingerprint/read APIs dan
JSONL/manifest export dengan checksum tersedia. Current metadata bukan history
aturan instrumen, funding cadence tidak dianggap terbukti lengkap dari interval
sekarang, dan READY bukan approval trading.

## Completed Tasks dan Files Created/Modified

| Task | Hasil / file utama |
| --- | --- |
| 3.1 REST client | api/src/market-data/bybit-public.client.ts: six public endpoint allowlist/typed transport |
| 3.2 OHLCV fetch | last/mark/index adapters dengan volume variant eksplisit |
| 3.3 Pagination | backward timestamp cursors/limits dan instrument cursor guard |
| 3.4 Timestamp normalization | contracts/src/market-data.ts UTC/timeframe map/range |
| 3.5 Candle validation | Exact decimal/OHLC/identity/precision/volume, no silent rounding |
| 3.6 Persistence | Prisma seven new models, MarketDataService bulk transaction helpers |
| 3.7 Duplicate prevention | Revision unique identity/content, unique membership pins/counters |
| 3.8 Gap detection | CandleCoverage leading/internal/trailing scanner, compact gap list |
| 3.9 Incomplete handling | Server cutoff frozen +2-second safety delay, explicit excluded/clipped report |
| 3.10 Retry/backoff | bounded attempts/jitter/reset/cooldown, typed code-only errors |
| 3.11 Resumable download | state.ts checkpoint schemas, service token/expiry/lease, cli.ts, page/final atomicity |
| 3.12 Dataset metadata | Snapshot/source/ranges/provenance, API read/list/quality |
| 3.13 Data quality report | Critical gates vs counters/caveats, published quality schema |
| 3.14 Dataset fingerprint | Streaming canonical content digests, pinned metadata, JSONL/temp/checksum/export |
| 3.15 Instrument metadata | Normalized observations/limits/status/contract/source/history limitation |
| 3.16 Funding data | Signed settlement records, dedicated paginator and cadence/coverage report |
| 3.17 Integration test | contracts/backend/Python + PostgreSQL/HTTP/fault/export/upgrade + actual public smoke |

Other files: MarketDataModule/controller/CLI/state, AppModule/readiness and M2
configuration service export; contract index/export script/6 JSON schemas and
market vectors; API tests/fixture transport and Python tests/export checker;
root scripts/package.json, database stop timeout60 seconds, operations/config docs.
Generated client/dist/runtime/artifact files di-ignore. Dependency baru: **tidak ada**.
Remaining mandatory tasks: **tidak ada**. Agent tidak melakukan commit/push.

## Database Migrations

`202611050003_market_data` additive: instrument_observations, candle_revisions,
funding_revisions, market_datasets, dataset_candles, dataset_funding dan
market_data_downloads. Decimal NUMERIC(38,18), epoch-ms BIGINT, JSONB metadata,
FK/index/uniqueness dan immutable/seal guards. Metadata marker market_data_schema_version=1
ditambahkan; dua marker lama tetap. SQL M1/M2 dan config snapshots tidak diubah.

Fresh/reapply serta upgrade M1/M2 diuji, existing sentinels bertahan, Prisma schema
diff no difference. Migration development bybit_dev loopback55432 diterapkan dan
status up to date. .env/credential tidak diubah; PostgreSQL Laragon tidak disentuh.
DB owner/superuser DDL dapat bypass guards; belum klaim anti-tamper produksi.

## Actual public data dan artifacts

Smoke command `.tools/node/npm.cmd run smoke:bybit-data`, exit0.
Source bybit-mainnet, BTCUSDT, range2025-01-01T00:00:00Z sampai2025-01-02T00:00:00Z.
Ini historical24h dalam preset, bukan latest24h atau full-year download.

| Evidence | Nilai aktual |
| --- | --- |
| Dataset ID | 3717d128-5be2-433f-90dc-ac21d3c35b54 |
| Download ID | e4abb443-bc88-42cb-bdea-30b2d9139d65 |
| Last-traded1m/5m/15m | 1440 /288 /96 candles (1824 total) |
| Funding | 3 actual records, tidak zero fill |
| Quality | READY/candles_usable true, missing/invalid/conflict0; execution_ready false |
| Pages/retries | 5 data pages /0 retries |
| Fingerprint | 229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa |
| Finished | 5 November2026 UTC15:01:28.216Z /WIB22:01:28 |
| Runtime evidence | .runtime/bybit-smoke.json |
| Export directory | artifacts/datasets/3717d128-5be2-433f-90dc-ac21d3c35b54/ |

Export mempunyai last-1m.jsonl, last-5m.jsonl, last-15m.jsonl, funding.jsonl,
instrument.json dan manifest.json. File digests diverifikasi ulang dan actual
directory lulus Python schema/hash/chronology checker (files5, manifest terpisah).
CLI data:download pada completed ID idempotent, data:export ulang fingerprint/
digests sama, kedua command exit0. Runtime/artifact tidak masuk Git; perlu
dipertahankan bersama DB jika ingin membawa pinned data ke mesin lain.

## Tests Executed dan Acceptance Verification

Final offline `.tools/node/npm.cmd run verify:market-data` exit0 PASSED.
UTC14:58:26.357–15:00:10.168 pada5 November2026; WIB21:58:26–22:00:10.
70 contract +30 backend unit +5 Python +30 integration =135 automated cases.
Build/typecheck/lint/format/export drift, migrations/schema diff dan E2E smoke
assertions termasuk; public source evidence terpisah seperti tabel di atas.

| Acceptance plan | Evidence | Status |
| --- | --- | --- |
| Historical data collected/persisted | Actual BTCUSDT1824 candles +3 funding +instrument | Terpenuhi |
| Chronology/units/closed ranges | UTC contract+coverage tests, HTTP reads, exported Python checker, frozen cutoff | Terpenuhi |
| Duplicate/gap/conflict quality | deterministic fixtures/fault cases; actual0 missing/invalid/conflicts | Terpenuhi |
| Dataset identity/revisions/fingerprint | old revision independence, DML guards, stable resumed/export hashes | Terpenuhi |
| Instrument/funding + caveats | actual observations/events, current-history/cadence limitations persisted | Terpenuhi |
| Resume/concurrency/DB/regressions/migration | stale/busy/revoke/takeover, rollback cursor, sealed restart, upgrade/data/schema tests | Terpenuhi |
| Documentation/progress/handoff | README/market-data/operations/config/architecture/ADR11/testing/roadmap/progress/plan | Terpenuhi |

Tidak ada mandatory skip; PostgreSQL nyata untuk integration, fixture-labeled HTTP
untuk deterministic tests. Public mainnet smoke tidak memakai mock. Native cache/
socket memerlukan approved escalated owner context seperti M1/M2. Test clusters
dan smoke API sudah berhenti; development DB tetap running. Full evidence:
[testing](../testing.md).

## Known Issues dan Technical Debt

- Current instrument metadata tidak membuktikan historical tick/leverage/funding
  rules; data availability_policy adalah closed-candle assumption, bukan actual
  historical publication latency. Restrictions diteruskan ke M4/M5.
- Funding events fetched tidak menjamin historical cadence completeness; anomaly
  vs current interval hanya diagnostic, tidak diisi0. Mark/index tested fixtures,
  default public smoke hanya last-trade streams karena config default reference last.
- Full-year support dibatasi366 hari/2 juta rows dan invocation budgets; actual
  full-year performance/download belum dijalankan. Tidak mengklaim benchmark itu.
- Revision/membership storage dan retained test clusters memakai disk; automatic
  purge/backup-restore/least-privilege produksi masih future scope.
- One worker default; request/time budget dievaluasi per halaman. CLI data commands
  build source lebih dulu. Windows x64 portable/development dist-watch limits M1 tetap.
- Tidak ada blocker M3 tersisa. Belum ada features/simulator/training atau orders.

## Keputusan dan perbaikan penting

Single-source public GET/no SDK, current metadata caveats, immutable revisions dan
streaming hashes dipilih sesuai plan. Query pg_advisory_xact_lock kini mengembalikan
integer agar Prisma tidak deserialize void. Disk checkpoint Windows melewati
timeout30 detik pada run awal, helper stop wait60 detik; final cleanup lulus tanpa
force-kill. Dataset/run completion atomic dan diagnostic invalid-page counts
dipertahankan tanpa memajukan cursor. Tidak mengubah requirement PROJECT_SPEC.md.

## How to Run dan Sesi Berikutnya

```powershell
.\.tools\node\npm.cmd run build
.\.tools\node\npm.cmd run db:migrate
.\.tools\node\npm.cmd run dev:api
```

Create download melalui POST /market-data/downloads; execute
`npm run data:download -- --id UUID`, export `npm run data:export -- --dataset UUID`.
API/commands/error/lease/range lengkap: [market-data](../market-data.md).

Next milestone **M4 — Feature Engineering**, informasi saja. Baca spec/progress/
roadmap/architecture/decisions/handoff ini dan periksa Git/tests sebelum mulai.
Susun M4 plan dan approval scope; pastikan no leakage, HTF alignment, train-only
normalization, stable ordering, observation contract dan Python semantic parity.
M3 tidak memberi izin melanjutkan M4 otomatis atau menjalankan training/trading.

**Waiting for Next Milestone Instruction.**
