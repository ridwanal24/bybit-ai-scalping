# Progress proyek

Terakhir diperbarui: 7 November 2026, Asia/Jakarta.

| Aspek | Kondisi aktual |
| --- | --- |
| Current phase | Phase 2 — Simulation MVP Completed |
| Current milestone | M6 — Baseline & Simulation MVP |
| Milestone approval | Approved melalui `oke lanjutkan eksekusi Milestone 6` |
| Implementation status | Seluruh task6.1–6.8 selesai dan diverifikasi |
| Milestone status | Completed; M0–M5 tetap Completed |
| Next milestone | M7 — RL Environment; belum Approved |
| Aplikasi/database/model | Market/config API, Python features, simulator, baseline evaluator/comparison; model belum dibuat |
| Trading | Tidak ada credentials Bybit, order atau aktivasi exchange |

## Approval dan scope

M0 dilaksanakan melalui `eksekusi milestone 0`, hasil diterima `oke ku approve`.
M1 disetujui melalui `lakukan` setelah plan foundation disajikan dan telah selesai.
`oke lanjut` memulai [plan M2](plans/milestone-02.md), kemudian `gw approve`
menyetujui seluruh task 2.1–2.15. Tidak ada perluasan scope menjadi M3 atau trading.

Instruksi berikutnya `lanjut` diikuti [plan M3](plans/milestone-03.md), lalu
`lanjutkan` menyetujui pelaksanaan task3.1–3.17 termasuk bounded public GET smoke.
M4 dan exchange execution bukan scope approval M3.

Instruksi `lanjut` pada 6 November 2026 memulai penyusunan
[plan M4](plans/milestone-04.md). Plan mencakup task 4.1–4.17, Python semantic
configuration parity, 23 fitur, closed-HTF alignment, train-only normalizer dan
ObservationBuilder. Instruksi `lanjut` berikutnya menyetujui seluruh scope M4.
Implementasi memakai jsonschema runtime versi yang sudah terkunci, tanpa
migration, download baru atau perubahan snapshot/data asal.

Instruksi `lanjut ke M5` memulai penyusunan [plan M5](plans/milestone-05.md),
seluruh task5.1–5.27. Instruksi `kerjakan` menyetujui exact ledger, deterministic
bar execution, exit/risk/funding dan explicit restricted liquidation envelope.
Implementasi M5 berada dalam scope plan; tidak memberi approval M6/training/orders.

## Selesai

M6 Approved melalui `oke lanjutkan eksekusi Milestone 6`,7 November2026;
[plan M6](plans/milestone-06.md) membatasi task6.1–6.8. HOLD, seeded random,
main-EMA crossover dan constrained perpetual Buy & Hold reference memakai
simulator M5 dengan risk/costs yang sama. Evaluator merekam/replay scripts,
merekonsiliasi net metrics, dan menerbitkan immutable comparison dengan verifier.
Tidak ada dependency/migration/download/refit atau scope RL/orders baru.

M0: requirement/MVP/architecture, risiko, roadmap, keputusan dan dokumentasi dasar.
M1: Node/uv/PostgreSQL portable, Python isolated, NestJS/Prisma, migration metadata,
health/config, commands dan foundation tests.

M2: @bybit/contracts dengan strict schema dan semantic checks; decimal comparison
exact/canonical hash; full preset berversi dan compatibility classifier. API
create/read/list/update draft dengan revision check, snapshot idempotent/immutable,
DB UPDATE/DELETE/TRUNCATE guards, published schema/fixtures dan Python contract tests.
Additive migration M2 sudah diterapkan ke development bybit_dev port55432; Prisma
migrate status menyatakan schema up to date. Environment credentials tidak diubah.
Dokumen API/operasi, architecture/ADR dan handoff disinkronkan.

M3 menambahkan public-only REST client, typed market contracts, append-only revisions,
dataset memberships, global lease/checkpoints dan resume/finalization. Quality/fingerprint/
ascending reads/export dan Python validation tersedia. Additive migration M3 sudah
diterapkan ke bybit_dev55432; schema up to date, credential/.env tidak diubah.
Dataset publik BTCUSDT2025-01-01 UTC: 1440x1m, 288x5m, 96x15m, 3 funding events;
0 missing/invalid/conflicts. Metadata current observation dan cadence caveat tetap eksplisit.

M4: verified streaming export loader dan Python semantic config validator; seluruh
23-ID feature catalog, seeded indicators, closed-HTF alignment dan warm-up/gap
handling. Train-only frozen Welford normalizer, ordered observation/context schema,
actual dimension/parameter guards, finite float32 binary export dan content-addressed
artifact reload tersedia. Source snapshot verification mendukung API/portable
envelope dan feature variants; tidak ada migration atau DB write M4.

M5: restricted historical Python simulator dengan exact financial ledger,
intent/execution/risk/funding states, sizing/protections/terminal settlement dan
streaming reconciled artifacts. M4 pipeline dipakai langsung dengan ledger context.
Shared accounting/risk vectors, CLI/runner dan capability/envelope gates tersedia.
Tidak ada schema DB/dependency baru, baseline, RL atau exchange order.

## Test summary

M6 final `verify:baselines` exit0,7 November2026 08:10:19–08:13:56 WIB:
97 contracts +33 backend +258 Python +31 integration =**419 tests tanpa skip**.
Build/typecheck/lint/format/export drift, isolated PostgreSQL/HTTP, fresh/reapply/
upgrade/data preservation/schema diff dan seluruh regression M1–M5 lulus.
Sandbox SWC cache SID mismatch diselesaikan lewat existing owner context,
tanpa mengubah dependency, ACL atau production timeouts. Public-export smoke
91.921s replay/reload: HOLD0 trade/net0; random seed42 13/net−21.376356;
EMA9/net−11.7493405; Buy & Hold0/net0 (single attempt rejected stop distance).
Tidak ada tuning atas losses/zero trades. [Testing](testing.md),
[handoff M6](handoffs/milestone-06.md), [guide](baselines.md).

M5 final `verify:simulation` exit0,6 November2026 20:53:03–20:55:05 WIB:
84 contracts +33 backend +236 Python +31 integration =384 tests tanpa skip.
Static/export/migration/schema checks dan seluruh M1–M4 regressions lulus.
Local public-export scripted simulation/replay/reload lulus:1 SHORT trade,
gross−0.9205,fees0.9460445,funding0,final equity998.1334555 USDT,FLAT.
Fixture E2E membuktikan LONG+SHORT; public smoke tidak diklaim mencakup keduanya.
Runtime context kini dari ledger, normalizer frozen; tidak ada download/migration.
Evidence: [testing](testing.md), [handoff M5](handoffs/milestone-05.md).

Perbaikan audit M1–M4 atas instruksi pengguna selesai: final-attempt cooldown tetap
disimpan/dihormati saat worker restart; delayed main candle dan dependent rows
unavailable sampai tersedia. `verify:features` exit0 pada6 November2026
20:01:21–20:03:10 WIB:77 contracts +33 backend +149 Python +31 integration =290
tests tanpa skip. Static checks/export drift/migrations/schema diff lulus. Rerun
fresh menutup dua timeout500ms legacy DB tests dari run awal tanpa mengubah timeout.
Local historical smoke menghasilkan artifact identik; kedua temuan audit ditutup.

Initial M4 verification:

M4: `npm run verify:features` exit0, 6 November2026 19:40:10–19:42:04 WIB.
77 contract +30 backend unit +142 Python +30 integration =279 tests lulus tanpa
skip. Build/typecheck/lint/format/export drift, isolated PostgreSQL/HTTP,
fresh/reapply/M1+M2 upgrades/data preservation dan zero schema diff lulus.
Python semantic parity, 23-ID independent indicator vectors, HTF/prefix/no-leakage,
train-only normalization, context/shape/corruption/artifact E2E lulus.
Public M3 export local-only smoke:495 fit rows,1185 vectors x299,255 warm-up
unavailable,720 half-open heldout decisions. CLI replay/artifact checks identik;
context synthetic FLAT, tidak ada download baru. Evidence: [testing](testing.md).

Historical M3 verification:

`npm run verify:market-data` exit0: 70 contract, 30 unit backend, 5 Python,
30 integration tests (135 total) plus orchestration assertions. Final report
5 November2026 21:58:26–22:00:10 WIB. Build/typecheck/lint/format/export drift,
fresh/reapply/upgrade M1/M2, data preservation/zero schema diff, worker/atomicity/
immutability/funding-cadence tests dan M1/M2 regressions lulus tanpa skip.
Public smoke/export selesai22:01:28 WIB; actual export juga lolos Python checker.
Evidence dan command tambahan: [testing](testing.md).

## Remaining tasks dan known issues

Tidak ada task wajib M6 tersisa. M7 memerlukan plan/approval baru; training
belum dimulai. Python semantic cross-field parity tersedia dan actual observation
shape/artifact divalidasi. Actual model/tensor library tetap scope M7/M8.
Configuration valid tidak membuktikan exchange support atau trading readiness.
DB owner/superuser tetap dapat bypass trigger lewat DDL; production privileges
belum menjadi kemampuan foundation/configuration lokal.

Portable bootstrap Windows x64. Native cache/socket tests dijalankan dengan context
pemilik workspace melalui eskalasi environment karena SID sandbox berbeda.
Dev watch memantau dist, sehingga source changes perlu build ulang. Cluster test
stopped dipertahankan untuk diagnosis dan memakai disk. Pemeriksaan M4 `db:status`
menunjukkan DB dev55432 stopped; M4 offline tidak menyalakannya. Smoke API dan
cluster test berhenti. PostgreSQL Laragon tidak dipakai
atau dihentikan. Backup restore/least privilege/auth remote dan RL resource budget
masih milestone terkait, bukan klaim kelayakan produksi.

R03 ditangani dengan revisions/quality/closure/retry/resume dan evidence publik,
tetapi historical metadata validity serta funding cadence completeness tetap
dibawa sebagai restriction di M5. Public smoke24 jam bukan benchmark full-year.
R06/R07 telah direkam sebagai config dan semantic rules sesuai plan M2; execution
semantics historical kini diuji M5; live conformance tetap M11. R05 ditutup untuk
restricted market/last/1x/50% envelope, bukan full exchange liquidation. R03–R16 lainnya mengikuti deadline pada
[planning](planning.md).

M4 source layout membutuhkan repo contract artifacts; standalone worker packaging
tetap M8/M11. Pure Python throughput full-year/live latency belum dibenchmark.
Source hash membuktikan integritas, bukan signature. Caller context/risk budget
divalidasi dan restricted historical risk enforcement M5 tersedia; live risk belum.

Handoff terbaru: [milestone-06.md](handoffs/milestone-06.md).
**Waiting for Next Milestone Instruction.**
