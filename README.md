# Bybit AI Scalping

Platform penelitian dan automated trading Bybit berbasis NestJS, React, Python,
PostgreSQL, dan MaskablePPO. Sumber requirement: [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Status aktual

Per 5 November 2026 (Asia/Jakarta), repository berisi spesifikasi dan dokumentasi
Milestone 0. Belum ada aplikasi, dependency terpasang, database, data pasar, model,
atau koneksi akun. Tidak tersedia perintah menjalankan aplikasi atau test suite.

Pengguna menyetujui pelaksanaan M0 dengan instruksi `eksekusi milestone 0`.
Hasil planning diterima melalui pesan `oke ku approve` pada 5 November 2026.
Status milestone **Completed**. M1 belum disetujui.

## Dokumen

| Dokumen | Isi |
| --- | --- |
| [Planning](docs/planning.md) | Requirement, scope MVP, timeline simulator, accounting, risk, safety, kontrak, risiko terbuka |
| [Architecture](docs/architecture.md) | Ownership, data flow, komunikasi proses, database konseptual, struktur folder |
| [Roadmap](docs/roadmap.md) | Task, dependency, acceptance criteria dan checkpoint M0–M16 |
| [Decisions](docs/decisions.md) | Keputusan desain, alternatif, konsekuensi dan status |
| [Testing](docs/testing.md) | Strategi dan skenario verifikasi, hasil pemeriksaan dokumentasi |
| [Progress](docs/progress.md) | Status dan approval scope aktual |
| [Handoff M0](docs/handoffs/milestone-00.md) | Hasil, keterbatasan dan instruksi sesi berikutnya |

## Alur pengembangan

Satu persetujuan berlaku untuk satu milestone. Task normal dalam scope tersebut
tidak membutuhkan persetujuan ulang. Milestone berikutnya tidak dimulai otomatis.
Simulation MVP ditargetkan pada M6, RL proof of concept M8, dashboard riset M10,
Paper M11, Demo M13, dan kemampuan Real M15.

Real Trading harus disabled by default. Persetujuan implementasi fitur Real bukan
izin transaksi dana asli. Tidak ada jaminan profit atau promosi model otomatis.

Dokumentasi konfigurasi dan operasi akan dibuat pada milestone yang relevan.
Rancangan folder dan komponen dalam dokumen belum merupakan fitur yang berjalan.
