# Catatan keputusan

Tanggal semua entri: 5 November 2026, Asia/Jakarta. **Baseline spesifikasi** berarti
requirement yang sudah diberikan pengguna. **Usulan M0** berarti pilihan desain
dalam deliverable planning yang diterima melalui `oke ku approve` pada 5 November
2026; detail deferred tetap harus diselesaikan sebelum gate terkait. Penerimaan
planning bukan izin eksekusi live. **Deferred** memiliki deadline dalam
[risk register](planning.md).

## ADR-01 — Milestone sebagai unit approval

- Status: baseline spesifikasi; pelaksanaan M0 Approved.
- Konteks: proyek panjang memerlukan scope dan handoff yang dapat diaudit.
- Keputusan: satu milestone per siklus. Pesan pengguna `eksekusi milestone 0`
  menyetujui plan M0 dalam chat ini, mencakup delapan dokumen yang direncanakan.
- Alternatif: persetujuan per task atau implementasi seluruh roadmap sekaligus.
- Alasan/tradeoff: scope terkendali tanpa interupsi per task; memerlukan review
  dan dokumentasi tiap milestone.
- Konsekuensi: tidak menjalankan M1, credential, database, training atau order.
  Approval plan M0 dan penerimaan hasil planning dicatat sebagai dua kejadian
  berbeda. Hasil diterima melalui `oke ku approve` pada 5 November 2026;
  acceptance akhir M0 terpenuhi dan status Completed.

## ADR-02 — Ownership historical dan live

- Status: baseline simulator Python tunggal; detail Paper/conformance usulan M0.
- Konteks: simulator ganda dapat menghasilkan PnL training/backtest berbeda.
- Keputusan: Python simulator bersama untuk baseline, Gymnasium dan evaluation.
  ObservationBuilder Python juga dipakai inference real-time. Paper menggunakan
  accounting Python; NestJS memegang operational state/order lifecycle. NestJS
  risk live independen dari inference dengan shared fixtures/conformance tests.
- Alternatif: simulator TypeScript kedua; seluruh proteksi live hanya Python.
- Alasan/tradeoff: satu sumber accounting dan proteksi operasional independen;
  tetap ada dua implementasi risk yang perlu verifikasi semantic equivalence.
- Konsekuensi: conformance wajib M11 dan tidak boleh memberi model hak bypass.

## ADR-03 — Transport batch lokal dahulu

- Status: usulan M0; inference transport Deferred ke M11.
- Konteks: single-machine CPU, dataset besar, pekerjaan training lama.
- Keputusan: subprocess CLI tanpa shell, JSON Lines protocol, artifact references,
  persistent backend job status dan cancellation. Satu worker aktif awal.
- Alternatif: FastAPI untuk semua job; Redis/Celery/broker sejak foundation.
- Alasan/tradeoff: dependency sedikit dan failure isolation proses; memerlukan
  supervisor, schema messages, restart/cancellation handling yang eksplisit.
- Konsekuensi: jangan spawn proses per tick untuk live; ukur persistent inference
  sebelum M11. Batas CPU/RAM/time final setelah inventaris resource dan benchmark.

## ADR-04 — Snapshot dan wire format berversi

- Status: baseline immutable/reproducibility; format desimal usulan M0.
- Konteks: data/config berubah, dua bahasa berbeda dan artifact di filesystem.
- Keputusan: schema bersama, decimal strings untuk uang/quantity, UTC millis,
  finite tensors, canonical hash, immutable dataset export/config snapshot,
  artifact checksum/manifest serta code/dependency/seed metadata.
- Alternatif: JSON float untuk semua uang; run membaca config/data mutable.
- Alasan/tradeoff: audit dan pengulangan run lebih jelas; konversi/validator dan
  lifecycle DB–filesystem perlu implementasi serta tests.
- Konsekuensi: jangan deduksi compatibility dari shape saja atau mengubah dataset
  run lama lewat perbaikan candle global. Tool validator/ORM Deferred M1/M2.

## ADR-05 — Eksekusi bar dan reward sederhana

- Status: closed candle/no leakage/SL baseline; detail timeline dan reward usulan M0.
- Konteks: OHLC tidak menunjukkan urutan intrabar atau memastikan fill live.
- Keputusan: keputusan sesudah close, fill paling awal next open, adverse costs,
  SL-first jika ambigu, funding berdasarkan event timestamp, terminal settlement
  dilabeli. Reward delta net equity dibagi initial capital positif, tanpa shaping.
- Alternatif: fill retroaktif pada close; optimistic TP-first; log reward awal;
  tick simulator langsung.
- Alasan/tradeoff: deterministik dan accounting mudah ditelusuri; bar approximation
  tetap tidak menangkap mikrostruktur, gap fill aktual atau liquidation lengkap.
- Konsekuensi: conservative fixtures M5, reward invariants M7. Restricted margin/
  liquidation envelope wajib disepakati sebelum M5, bukan klaim realism futures.

## ADR-06 — Risk latching dan ownership

- Status: hard safety baseline; daily anchor/reset dan breach action usulan M0.
- Konteks: unrealized losses, restart dan foreign activity dapat menyesatkan state.
- Keputusan: usulkan equity basis, daily anchor UTC persisten, drawdown high-water
  per run/deployment; breach block entry dan controlled close posisi bot. Dedicated
  account/one-way diusulkan; unknown/manual position memblokir, tanpa auto-adopt.
- Alternatif: realized-only daily loss; reset latch restart; mengambil alih semua
  posisi pada simbol.
- Alasan/tradeoff: kerugian terbuka tidak tersembunyi; lebih ketat dan memerlukan
  keputusan reset/manual review serta account ownership yang dapat dibuktikan.
- Konsekuensi: finalisasi R06/R07 sebelum M2/M5 dan R13 sebelum Demo. Default
  numeric spec tidak diubah; M0 belum menetapkan hard limits baru untuk live.

## ADR-07 — Ledger order dan fail-safe

- Status: baseline ACK≠fill/no blind retry; persistence detail usulan M0.
- Konteks: timeout tidak membuktikan create order gagal; fills bisa parsial.
- Keputusan: durable intent sebelum submit, unique client ID, execution dedupe,
  pending/unknown block entry, reconciliation sebelum retry/resume, stop tetap
  aktif sampai flat/pengganti terkonfirmasi. Emergency actions dipisahkan.
- Alternatif: retry create setiap timeout; local action dianggap posisi final.
- Alasan/tradeoff: mencegah duplicate exposure; memerlukan query recovery dan
  state machine yang menangani partial/cancel/out-of-order events.
- Konsekuensi: fault injection M12–M14 dan capability verification tiap environment.

## ADR-08 — Gates model dan Real

- Status: baseline spesifikasi; ambang statistik Deferred M9.
- Konteks: training selesai/profit satu backtest bukan bukti kelayakan live.
- Keputusan: Candidate → Validated → Paper → Demo → Real melalui bukti dan approval;
  normalization train-only, frozen model, no auto online retraining/deployment.
  Promotion criteria ditetapkan sebelum evaluasi keputusan. Real disabled by
  default, tidak autoresume, rollout dana membutuhkan izin operasional terpisah.
- Alternatif: deploy seed terbaik otomatis; auto-switch Demo ke Real.
- Alasan/tradeoff: evaluasi dan recovery dapat diaudit; promosi lebih lambat dan
  hasil negatif dapat menghentikan rollout walau executor telah siap.
- Konsekuensi: M15 dry-run dipisahkan dari izin real order. Tidak ada target profit
  atau capital rollout yang ditentukan M0.

## ADR-09 — Implementasi foundation lokal M1

- Status: diimplementasikan dalam plan M1 yang disetujui melalui `lakukan`.
- Konteks: Node global 26.13/Python 3.15 tersedia, Docker tidak ditemukan;
  PostgreSQL Laragon 14.5 ditemukan belakangan pada lokasi nonstandar.
- Keputusan: workspace-local Node 24.22.2, uv 0.13.7, CPython 3.12.12,
  PostgreSQL 17.10 portable; npm/uv cache dan runtime state lokal. Tidak mengubah
  PATH permanen, global runtime, service atau cluster Laragon.
- Backend: NestJS 12.3.3 ESM/TypeScript 5.9.3, Prisma/client/adapter 7.10.1 + pg,
  ConfigModule/Zod, Vitest 5.1.0/SWC, ESLint/Prettier. Python pytest/Ruff,
  tanpa dependency RL pada foundation.
- Alternatif: menggunakan runtime global yang belum diverifikasi kompatibel,
  instalasi Docker/system service atau memakai cluster pengguna existing.
- Alasan/tradeoff: setup dapat diulang tanpa menimpa mesin pengguna; unduhan
  cukup besar dan bootstrap saat ini spesifik Windows x64. Native cache/socket
  memerlukan context pemilik workspace untuk verification dalam environment ini.
- Konsekuensi: package/runtime locks dan limited npm install-script policy
  dikomit sebagai source nanti; artifact/secret tetap ignored. Registry `latest`
  Prisma sempat menunjuk 8 RC, tetapi implementasi tetap pada jalur 7 plan.
- Database: satu tabel app_metadata + marker schema, migration versioned.
  Liveness independen, readiness menguji marker DB dengan timeout dan error
  tersanitasi. Runtime/script/transaction/HTTP integration lulus, bukan hanya mock.
- Provenance: Node dan uv dibanding checksum upstream; PostgreSQL checksum
  pertama dihitung dari unduhan HTTPS EDB dan dipin untuk berikutnya. Tidak
  mengklaim checksum PostgreSQL pertama berasal dari independent upstream digest.

## Keputusan yang belum ditutup

R01–R16 pada [planning](planning.md) mencatat owner, milestone deadline dan dampak.
Sebelum milestone terkait diimplementasikan, plan harus menyelesaikan pilihan yang
memblokir acceptance-nya atau mengajukan perubahan scope eksplisit. Dokumen ini
tidak mengubah requirement penting PROJECT_SPEC.md.
