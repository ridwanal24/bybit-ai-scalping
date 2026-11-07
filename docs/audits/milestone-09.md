# Audit ulang M9

7 November2026, setelah instruksi pengguna untuk memeriksa M9 sebelum M10.
Task9.1–9.19 dan5 acceptance criteria ditelusuri ke protocol/variants/runner/
metrics/report/screen/holdout serta bukti actual training dan cached replay.

Ditemukan dan diperbaiki dua gap:

1. Register protocol semula mengecek configuration historical range, tetapi belum
   menolak episode yang keluar dari coverage export sebelum reservation/training.
   Sekarang main stream dan exact requested half-open range dicek terhadap sealed
   export; request invalid tidak meninggalkan holdout reservation.
2. Report verifier semula memeriksa matched config/data/normalizer/range/costs,
   tetapi belum mewajibkan exact HOLD/random/EMA/BuyHold matrix dan random seed
   yang sesuai primary. Sekarang keempat strategies/order/seed wajib identik
   dengan frozen protocol convention; missing/duplicate/wrong-seed ditolak.

Empat regression cases ditambahkan. Focused audit **22 passed**,1 full E2E
dijalankan lagi dalam verification M10. Root reader membaca ulang public report
`6a8dbce35c5a25a40999d4963ce25017a5ddb484fb6200e3f0f65b8bcb2b4702`
dengan exit0 (`.runtime/m9-audit-report.log`),35 rows/6comparisons valid dan screen
tetap insufficient_evidence. Tidak ada tuning/retraining/public holdout access.

Archived protocol/model fingerprints tetap dipertahankan. Code fingerprint baru
memerlukan protokol/training baru untuk execution path; historical report reader
memverifikasi archive dengan original identity, bukan mengubah report agar cocok.
Keterbatasan24h/negative/sparse market evidence bukan task implementasi yang hilang.
Gate tidak diturunkan dan model tidak dipromosikan. Setelah gap ditutup, instruksi
yang sama mengotorisasi seluruh M10 tanpa konfirmasi ulang pertask.
