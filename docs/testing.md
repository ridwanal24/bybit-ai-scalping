# Testing dan verifikasi

## Status aktual M0

M0 hanya dokumentasi. Belum ada unit test, integration test, contract test atau
runtime yang dapat dijalankan. Hasil di bawah adalah pemeriksaan dokumen, bukan
bukti aplikasi atau trading berhasil. Tanggal: 5 November 2026, Asia/Jakarta.

| Pemeriksaan | Hasil |
| --- | --- |
| Git dan inventaris awal | Working tree awal bersih; hanya PROJECT_SPEC.md dan .git; baseline commit a7cf3ef |
| Kelengkapan delapan dokumen | Lulus; 8/8 file ditemukan dengan pemeriksaan PowerShell |
| Tautan Markdown lokal | Lulus; seluruh target lokal ditemukan, 0 tautan rusak |
| Task M0 0.1–0.18 dan task M1–M16 | Lulus; 284 ID task unik spesifikasi tercantum dalam roadmap, 0 hilang |
| Whitespace diff | Lulus; `git diff --check` exit 0; pemindaian delapan file baru juga menemukan 0 trailing whitespace |
| Accounting walkthrough | Lulus pemeriksaan aritmetika PowerShell; LONG 4,795 dan SHORT 4,805 dalam toleransi 1e-9 |
| Konsistensi scope/status | M0 Completed setelah penerimaan pengguna; M1 belum Approved; tidak ada klaim fitur berjalan |
| Review/penerimaan pengguna | Diterima melalui `oke ku approve`, 5 November 2026, Asia/Jakarta |

Pemeriksaan PowerShell dijalankan dari root repository: enumerasi delapan file,
regex task list spesifikasi `(?m)^- (\d+\.\d+)\b` dibanding ID dalam roadmap,
resolusi target Markdown relatif terhadap setiap dokumen, scan whitespace, dan
evaluasi dua contoh aritmetika. Command pemeriksaan menghasilkan exit 0.
`git diff -- PROJECT_SPEC.md` tidak menghasilkan perubahan. Karena file baru
masih untracked, `git diff --check` sendiri tidak mencakup isinya; pemindaian
file eksplisit dilakukan untuk melengkapinya. Tidak ada file di-stage atau commit.
Kecocokan task ID memverifikasi coverage nomor, bukan kebenaran implementasi.

## Strategi implementasi berikutnya

Fixtures deterministik menjadi dasar. Unit test tidak bergantung pada API Bybit;
network/account integration adalah lapisan terpisah dan diberi label lingkungan.
Semua hasil report menyebut command, environment, hasil aktual, skips dan blocker.
Test yang tidak dijalankan tidak boleh ditulis lulus. Setiap bug kritis diberi
regression scenario yang menguji behavior, bukan menyalin implementation.

| Gate | Skenario minimum | Oracle / invariant |
| --- | --- | --- |
| M1 foundation | API health, DB migration/connectivity, Python process dan command tests | Proses berjalan; DB benar-benar dijangkau, exit code/error benar |
| M2 config/contracts | Type/range, cross-field SL/exit/RR, model shape, duplicate snapshot write | Invalid ditolak, snapshot lama tidak berubah, hash stabil |
| M3 ingestion | Reverse pagination, duplicate, gap, incomplete/out-of-order OHLC, timeout/rate limit, resume | Chronological valid data, no silent fill, quality count/fingerprint sesuai fixtures |
| M4 features | Indicator reference values, warm-up, HTF boundary, perturb future data, feature toggle | Masa depan tidak mengubah observation masa lalu; active features benar-benar masuk |
| M4/M8 preprocessing | Train-only fit, changed validation/test distribution | Artifact train tidak berubah; no refit saat evaluation/live |
| M5 accounting | Long/short, partial close, fees, spread/slippage, signed funding, round/reject | Wallet+UPnL=equity, margin bukan expense, no double count, ledger conserved |
| M5 timeline | Next-bar fills, gap stop, SL/TP both hit, funding at boundary, duplicate exit | No retroactive fill; conservative priority; satu exposure ditutup sekali |
| M5 risk | Qty minimum/step, fee-aware size, margin cap, daily reset, DD latch, zero equity | Entry reject bila risk tidak valid; restart tidak menghapus latch |
| M5 terminal | Dataset end, forced exit, gap/split, nonpositive equity | Settlement dan fee terakhir masuk ledger; no cross-split position |
| M6 baseline | HOLD, seeded random, EMA, Buy & Hold di data/split/cost sama | HOLD tanpa costs return 0; comparison melaporkan exposure/constraint |
| M7 env | reset seed, step contract, masks seluruh position/exit modes, terminated/truncated | Gymnasium checker + mask-aware cases; HOLD valid; forced exits independen |
| M7 reward | Overtrade, losing hold, realized conversion, funding, terminal close | Sum reward = net equity change / initial capital; tidak reward fee avoidance palsu |
| M8 train | Bounded CPU smoke, masked eval, save/load, corrupted artifact, cancel/crash | Valid actions, same observation compatibility, job terminal state persisten |
| M9 evaluation | Multi-seed, walk-forward, sensitivity, holdout access, undefined metrics | Semua seed/failure dilaporkan; no test tuning; null+reason untuk undefined |
| M10 UI | API loading/error/empty, invalid config, job start/cancel, charts, model compare | Backend nyata; no fake live results; mode capability terlihat |
| M11 paper | Duplicate/late candle, reconnect/backfill, feature parity, inference failure, restore | Satu decision per closed candle; shared accounting; no exchange orders |
| M11 conformance | Risk sizing/reject/stop/rounding/defaults TypeScript vs Python fixtures | Decision dan quantity konsisten sesuai toleransi yang ditetapkan |
| M12 adapters | Wrong environment, credential isolation, unknown/manual position, capability mismatch | Block entry, no cross-account state, no secret dalam log |
| M12/M13 lifecycle | Lost ACK, partial fills, cancel race, WS duplicate/out-of-order, timeout | No duplicate create/exit; execution dedupe; confirmed exposure/protection |
| M13 Demo | Actual Demo open/fill/stop/TP/close + account reconciliation | IDs/executions/position/stop evidence; API ACK saja tidak cukup |
| M14 faults | DB/disk/network/worker loss, clock drift, missing stop, restart, restore backup | Entry blocked; protection preserved; recovery tidak mengambil posisi manual |
| M15 Real readiness | Dry-run with order transport disabled, activation flags, no autoresume | Tidak ada real order; readiness report dan separate money approval |

## Walkthrough planning

Contoh numerik pada [planning](planning.md) dicek ulang terhadap rumus: LONG net
4,795 dan SHORT net 4,805 untuk asumsi yang dicantumkan. Nilai ini menjadi calon
fixtures M5, belum executable regression tests. Timeline juga direview untuk
next-bar execution, ambiguity, funding, risk close dan terminal settlement.

## Acceptance M0

| Kriteria spesifikasi | Evidence |
| --- | --- |
| Ambiguities resolved atau explicitly documented | Planning R01–R16, owner/deadline |
| MVP boundaries clear | Planning checkpoint M6/M8/M10 dan out-of-scope |
| Architecture responsibilities clear | Architecture ownership dan ADR-02 |
| Critical trading risks identified | Risk register, safety/order/risk design |
| Implementation dependencies identified | Roadmap phase/dependency/gates |
| Documentation foundation established | README dan delapan dokumen planning |
| Planning reviewed and accepted | Terpenuhi: `oke ku approve`, 5 November 2026 |

Integration/contract/regression tests aplikasi tidak berlaku untuk deliverable
dokumentasi M0. M1 dan seterusnya tetap wajib memenuhi tests relevan sesuai
spesifikasi. Review akhir pengguna telah diterima; seluruh acceptance criteria M0
terpenuhi. Persetujuan ini tidak mencakup implementasi M1.
