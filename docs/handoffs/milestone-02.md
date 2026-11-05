# Milestone 2 — Configuration System: implementation report dan handoff

Tanggal: 5 November 2026, Asia/Jakarta. Final status: **Completed**.
Approval: `gw approve` setelah [plan M2](../plans/milestone-02.md) disajikan.
Scope seluruh task 2.1–2.15; M3, model/training dan exchange execution bukan scope.

## Implemented features dan how it works

Research configuration adalah dokumen penuh yang strict dan berversi, terpisah
dari .env server. Zod structural schema dan semantic rules menolak input invalid
sebelum write, dengan issues field/code/message. Decimal risk comparisons memakai
integer berskala dan hash memakai normalized decimal fields/sorted keys/UTF-8.
Array ordering dan opaque identifiers dipertahankan.

API membuat draft valid, membaca/list, mengganti payload lengkap memakai revision
check, lalu membekukan revision dalam snapshot. Transaksi/row lock dan unique
source/revision membuat snapshot idempotent tanpa race mencampur payload. Draft
update tidak mengubah snapshot lama; API tanpa update/delete snapshot, database
triggers menolak UPDATE/DELETE/TRUNCATE. Hash/schema diperiksa pada read.

Built-in research-small-hybrid-v1 lengkap/berversi, memakai synthetic research
assumptions dari plan, bukan tarif akun terverifikasi. Compatibility hanya menilai
konfigurasi; belum menyatakan model approved atau siap execution.

## Completed Tasks dan Files Created/Modified

| Task | Hasil / file utama |
| --- | --- |
| 2.1 Market config | contracts/src/schema.ts/validation.ts: exchange/category/symbol/timeframes/range/mode |
| 2.2 Risk config | Capital/fractions/leverage/exposure/margin, satu posisi, equity/UTC/latch semantics |
| 2.3 SL/TP/RR | Hard SL/ATR/bounds/cost allowances/trigger reference dan numeric decimal RR |
| 2.4 Exit mode | AI_EXIT/FIXED_RR/HYBRID flags dengan cross-field rules |
| 2.5 Execution config | Explicit costs, spread/slippage, funding, order/timeout/reference |
| 2.6 Feature config | Ordered catalog/periods/timeframes, state/risk inputs, normalization/window |
| 2.7 Network config | Presets/custom, layers/activation/dimension dan parameter estimate guard |
| 2.8 Training config | MaskablePPO/CPU, hyperparameters/seed/reward/windows, single-env rollout rules |
| 2.9 Type/range validation | Strict objects, bounded integer/decimal precision/payload dan scalar types |
| 2.10 Cross-field validation | Risk ordering, allowances, periods, feature duplicates/HTF, exit, network/rollout/window |
| 2.11 Persistence | API research-configurations/*, DatabaseModule dan Prisma ResearchConfiguration |
| 2.12 Immutable snapshots | ConfigSnapshot model/migration/triggers, canonical.ts, locked/idempotent transaction |
| 2.13 Presets | contracts/src/presets.ts dan generated presets/research-small-hybrid-v1.json |
| 2.14 Compatibility rules | contracts/src/compatibility.ts + API snapshot reference comparison |
| 2.15 Integration tests | API configurations.integration.ts, contracts test, shared Python fixtures, runner migration upgrade |

Task tersisa: tidak ada dalam scope wajib M2. Files lain: root/API/contracts
package manifests/locks, contract build/test/export configs dan artifact JSON,
services/quant/pyproject.toml/uv.lock/tests, scripts/tasks.mjs dan formatter scope.
DatabaseService/readiness dan AppModule memakai shared DatabaseModule agar pool
tidak diduplikasi. .env dan credential DB tidak diubah.

## Architecture/contract changes dan dependency baru

`@bybit/contracts` adalah package workspace baru, source Zod4.6.7 yang sama dengan
foundation. Generated JSON Schema Draft2020-12, fixtures dan preset tracked;
build melakukan export:check, bukan mengubahnya diam-diam. Python jsonschema4.26.0
hanya dev structural consumer. Python standard library memverifikasi raw config
canonical/hash vectors; tidak membuat schema bisnis kedua.

Lockfile Python menambah attrs26.1.0, jsonschema-specifications2025.9.1,
referencing0.37.0, rpds-py2026.9.1, typing-extensions4.16.0. Runtime/backend/ORM
major dan npm install-script policy M1 tidak diubah. Worker/ML belum diinstal.

Endpoint baru:

- POST /configurations/validate; GET /configuration-presets.
- POST/GET /configurations; GET/PUT /configurations/:id.
- POST /configurations/:id/snapshots; GET /configuration-snapshots/:id.
- POST /configurations/compatibility.

Request bodies dan units: [configuration](../configuration.md). Examples:
[operations](../operations.md). 400 invalid, 404 missing, 409 stale/integrity,
503 storage unavailable. API tetap loopback; tidak ada activation endpoint.

## Database Migrations

`202611050002_configuration` additive: research_configurations dan
configuration_snapshots, constraints/index/FK dan immutable triggers. Metadata
configuration_schema_version=1 ditambahkan; foundation_schema_version=1 dan data
M1 dipertahankan. Readiness memeriksa keduanya. Migration M1 tidak diedit.
Schema diff Prisma terhadap upgrade DB: zero. Migration kemudian diterapkan pada
development bybit_dev di127.0.0.1:55432; migrate status up to date. Tidak ada
reset/drop/deletion existing data atau operasi pada PostgreSQL Laragon.

## Tests executed dan acceptance verification

Final command `.tools/node/npm.cmd run verify:configuration`, exit0 PASSED.
UTC 2026-11-05T13:46:49.156Z–13:48:06.783Z; WIB20:46:49–20:48:06.
52 contract + 16 backend unit + 4 Python + 14 PostgreSQL/HTTP integration =
86 test cases, ditambah E2E smoke/migration assertions. No mandatory skips.

| Acceptance | Bukti | Status |
| --- | --- | --- |
| Semua kelompok config validate/persist/read | Preset workflow dan API/DB integration | Terpenuhi |
| Invalid type/range/cross-field rejected/no-write | Unit/contract matrix + invalid create/update/revision assertions | Terpenuhi |
| Preset lengkap, berversi, asumsi/unit jelas | Export:check, preset validation, API/JSON dan docs | Terpenuhi |
| Snapshot immutable/hash/draft independence | DB triggers/API no-write, CAS/race/idempotency tests, canonical vectors | Terpenuhi |
| Shared structural schema + conservative compatibility | Python schema/raw hash fixtures + report not_assessed | Terpenuhi |
| Critical tests/regression dan additive upgrade | Full suite, M1 sentinel preservation, Prisma no difference, built API/Python smoke | Terpenuhi |
| Documentation/progress/roadmap/handoff | Dokumen disinkronkan dengan hasil aktual | Terpenuhi |

Full evidence dan batas: [testing](../testing.md). Native cache/socket tests memakai
context pemilik workspace melalui eskalasi environment seperti M1. DB test nyata,
bukan mock pengganti. Cluster test dan smoke API sudah stop; dev DB tetap running.

## Known issues dan technical debt

- JSON Schema export tidak membawa semua semantic rules; Python runtime semantic
  conformance sebelum quant M4/M5 tetap wajib. Schema validity bukan trading readiness.
- Exchange capabilities, dataset/funding, actual tensor shape/normalization,
  margin/liquidation dan model approval masih pending milestone terkait.
- Snapshot triggers mencegah ordinary DML, tetapi DB owner/superuser dapat bypass
  lewat DDL. Least-privilege produksi/backup restore bukan capability M2.
- Comparison config tidak mempromosikan model atau mengubah deployment aktif.
- Local bootstrap Windows x64; source change perlu rebuild untuk dev dist watcher.
  Test clusters stopped retained untuk diagnosis; tidak ada automated purge.
- Tidak ada blocker acceptance M2 yang tersisa.

## Documentation Updated

README, configuration, operations, architecture, decisions (ADR-10), testing,
roadmap, progress, approved plan dan handoff ini. PROJECT_SPEC.md tidak diubah.
Agent tidak melakukan commit/push.

## How to run dan sesi berikutnya

```powershell
.\.tools\node\npm.cmd run build
.\.tools\node\npm.cmd run db:migrate
.\.tools\node\npm.cmd run dev:api
```

API default127.0.0.1:3000. Gunakan GET /configuration-presets untuk contoh payload;
workflow lengkap ada pada operations. Verification: `npm run verify:configuration`.
Untuk contract changes yang disengaja: `npm run contracts:export` lalu review diff.

Next milestone **M3 — Bybit Market Data**, informasi saja. Sesi berikutnya baca
spec/progress/roadmap/architecture/decisions/handoff ini, periksa Git dan tests.
Siapkan M3 plan/approval sebelum implementasi; verifikasi official API docs dan
data capabilities saat integrasi. M2 tidak memberi izin credentials/order.

**Waiting for Next Milestone Instruction.**
