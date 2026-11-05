# Handoff M0 — Project Planning

Tanggal: 5 November 2026, Asia/Jakarta.

## Approval scope dan status

Pengguna menyetujui plan M0 melalui pesan `eksekusi milestone 0`. Approval meliputi
seluruh task 0.1–0.18 dan delapan dokumen planning. Tidak meliputi M1, credentials,
aplikasi, dependency installation, migration, data download, training atau order.

Final status laporan: **Completed**. Penyusunan deliverable dan verifikasi dokumen
selesai; pengguna menerima hasil melalui pesan `oke ku approve` pada 5 November
2026. Acceptance `Planning reviewed and accepted` terpenuhi. M1 belum disetujui.

## Hasil dan file

| File | Hasil |
| --- | --- |
| [README.md](../../README.md) | Orientasi, batas kemampuan aktual, indeks dokumen |
| [planning.md](../planning.md) | Requirement/MVP, timeline/accounting/reward, risk/safety/order, model/account policy, kontrak, R01–R16 |
| [architecture.md](../architecture.md) | Ownership, flow, Node–Python, database konseptual, deployment/folders |
| [roadmap.md](../roadmap.md) | Seluruh task 0.1–16.18 sesuai spesifikasi, phase, dependencies, acceptance gates |
| [decisions.md](../decisions.md) | ADR-01–08 dan status baseline/usulan/deferred |
| [testing.md](../testing.md) | Strategi test per gate dan hasil verifikasi dokumen |
| [progress.md](../progress.md) | Approval, status aktual, remaining work |
| Dokumen ini | Konteks sesi selanjutnya |

Task 0.1–0.18 selesai disusun, diverifikasi sebagai dokumen dan diterima pengguna.
Tidak ada task M0 tersisa. PROJECT_SPEC.md tidak diubah.

## Arsitektur/kontrak dan keputusan penting

Python adalah simulator historical tunggal untuk backtest/RL; ObservationBuilder
dipakai lintas mode. Backend owns live risk/safety/order lifecycle; model tidak
dapat bypass proteksi. Paper memakai accounting Python. Shared schema/fixtures
menjaga risk semantics lintas bahasa. Batch memakai subprocess JSON Lines dan
artifact refs; persistent inference diputuskan sebelum M11.

Closed-candle observation, next-available fills, conservative ambiguity, biaya
net equity, explicit terminal settlement dan reward equity delta adalah usulan
desain yang harus diuji M5/M7. Daily loss equity/UTC/latch dan dedicated account
juga usulan, bukan hard safety limit live baru yang telah diaktifkan.

Kontrak hanya konseptual; tidak ada schema runtime atau API baru. Dependency baru:
tidak ada. Database migrations: tidak ada. Keputusan versi/ORM/validator belum
dipin. Referensi resmi Bybit/Gymnasium/MaskablePPO diperiksa untuk planning; cek
ulang saat implementasi. Final model promotion thresholds belum ditentukan.

## Tests dan acceptance

Belum ada unit/integration/contract/regression suite aplikasi. PowerShell
documentation checks exit 0: 8/8 file tersedia, 284/284 task ID tercakup, 0 tautan
lokal rusak, 0 trailing whitespace, dua walkthrough accounting sesuai rumus.
`git diff --check` exit 0; file baru diperiksa eksplisit karena masih untracked.
Review konsistensi agent selesai. Detail di [testing](../testing.md).

Enam kriteria dokumen M0 terpenuhi dengan evidence pada testing: ambiguity
tercatat, batas MVP jelas, ownership jelas, risiko teridentifikasi, dependency
tercatat dan fondasi dokumentasi tersedia. Kriteria ketujuh, review/penerimaan
pengguna, terpenuhi melalui `oke ku approve`. Semua acceptance criteria M0
terpenuhi. Tidak ada acceptance test aplikasi yang dijalankan.

## Known issues dan debt

R01–R16 pada planning adalah daftar pertanyaan/deferred design beserta owner dan
deadline. Risiko utama: bar approximation/liquidation, biaya/risk defaults,
resource budget, duplicate order/recovery, ownership, auth remote, promotion
criteria. Tidak ada bug aplikasi yang diketahui karena aplikasi belum dibuat.
Usulan desain belum merupakan bukti kelayakan trading.

## Menjalankan proyek

Belum tersedia aplikasi atau test command. Baca README dan dokumen Markdown.
Jangan menjalankan setup/install/database/credential operation atas dasar handoff
M0. M1 akan menyediakan perintah development yang benar-benar telah diuji.

## Sesi berikutnya

1. Baca PROJECT_SPEC.md, progress, roadmap, architecture, decisions dan handoff ini.
2. Periksa Git dan hasil verifikasi dokumen; jangan asumsikan keadaan tetap sama.
3. M0 telah diterima melalui `oke ku approve`; jangan meminta penerimaan ulang.
4. Jika pengguna menginstruksikan M1, susun plan foundation konkret: versi/runtime,
   ORM, struktur, DB setup/migration, health, tests dan commands, lalu ikuti
   approval scope yang diberikan. M1 belum disetujui oleh pelaksanaan M0.
5. Jangan mulai milestone berikutnya atau mengirim order secara otomatis.

Status penyerahan: M0 Completed; menunggu instruksi milestone berikutnya.
