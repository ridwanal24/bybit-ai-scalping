# Progress proyek

Terakhir diperbarui: 5 November 2026, Asia/Jakarta.

| Aspek | Kondisi aktual |
| --- | --- |
| Current phase | Phase 1 — Foundation & Market Data |
| Current milestone | M3 — Bybit Market Data |
| Milestone approval | Approved melalui `lanjutkan` setelah implementation plan M3 disajikan |
| Implementation status | Seluruh task 3.1–3.17 selesai dan diverifikasi |
| Milestone status | Completed; M0–M2 tetap Completed |
| Next milestone | M4 — Feature Engineering; Planned, belum Approved |
| Aplikasi/database/model | Market/config API dan PostgreSQL migration M3 siap; dataset publik tersedia, model belum dibuat |
| Trading | Tidak ada credentials Bybit, order atau aktivasi |

## Approval dan scope

M0 dilaksanakan melalui `eksekusi milestone 0`, hasil diterima `oke ku approve`.
M1 disetujui melalui `lakukan` setelah plan foundation disajikan dan telah selesai.
`oke lanjut` memulai [plan M2](plans/milestone-02.md), kemudian `gw approve`
menyetujui seluruh task 2.1–2.15. Tidak ada perluasan scope menjadi M3 atau trading.

Instruksi berikutnya `lanjut` diikuti [plan M3](plans/milestone-03.md), lalu
`lanjutkan` menyetujui pelaksanaan task3.1–3.17 termasuk bounded public GET smoke.
M4 dan exchange execution bukan scope approval M3.

## Selesai

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

## Test summary

`npm run verify:market-data` exit0: 70 contract, 30 unit backend, 5 Python,
30 integration tests (135 total) plus orchestration assertions. Final report
5 November2026 21:58:26–22:00:10 WIB. Build/typecheck/lint/format/export drift,
fresh/reapply/upgrade M1/M2, data preservation/zero schema diff, worker/atomicity/
immutability/funding-cadence tests dan M1/M2 regressions lulus tanpa skip.
Public smoke/export selesai22:01:28 WIB; actual export juga lolos Python checker.
Evidence dan command tambahan: [testing](testing.md).

## Remaining tasks dan known issues

Tidak ada task wajib M3 tersisa. M4 memerlukan implementation plan dan approval
terpisah; feature calculation/training belum dimulai.
Structural schema shared tidak mewakili seluruh semantic cross-field
rules: Python runtime semantic parity/conformance tetap gate M4/M5. Parameter
estimate memakai declared shape; actual tensor/artifact/model belum tersedia.
Configuration valid tidak membuktikan exchange support atau trading readiness.
DB owner/superuser tetap dapat bypass trigger lewat DDL; production privileges
belum menjadi kemampuan foundation/configuration lokal.

Portable bootstrap Windows x64. Native cache/socket tests dijalankan dengan context
pemilik workspace melalui eskalasi environment karena SID sandbox berbeda.
Dev watch memantau dist, sehingga source changes perlu build ulang. Cluster test
stopped dipertahankan untuk diagnosis dan memakai disk. DB dev tetap running di
loopback55432; smoke API dan cluster test berhenti. PostgreSQL Laragon tidak dipakai
atau dihentikan. Backup restore/least privilege/auth remote dan RL resource budget
masih milestone terkait, bukan klaim kelayakan produksi.

R03 ditangani dengan revisions/quality/closure/retry/resume dan evidence publik,
tetapi historical metadata validity serta funding cadence completeness tetap
dibawa sebagai restriction ke M5. Public smoke24 jam bukan benchmark full-year.
R06/R07 telah direkam sebagai config dan semantic rules sesuai plan M2; execution
semantics tetap diuji M5/M11. R03–R16 lainnya mengikuti deadline pada
[planning](planning.md).

Handoff: [milestone-03.md](handoffs/milestone-03.md).
**Waiting for Next Milestone Instruction.**
