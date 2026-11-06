# Testing dan verifikasi

## Perbaikan audit M1–M4 — 6 November 2026

Dua temuan audit diperbaiki atas instruksi pengguna:

- Final retry kini mempertahankan blocked-until dari Retry-After detik/HTTP-date
  atau reset timestamp. Tiga parameterized backend tests menjalankan12 kombinasi
  HTTP429/503/retCode10006 dan header pendek/panjang/date/reset. Test PostgreSQL
  tambahan memeriksa status PAUSED, cooldown tersimpan dan worker baru menolak
  resume tanpa request kelima.
- Main candle memakai embedded availability. Seluruh baris yang masih bergantung
  pada delayed candle berstatus stale dengan values unavailable sampai dependency
  tersedia; normalizer tidak fit baris itu, observation harus membangun ulang
  window valid. Tujuh Python cases tambahan menguji delay/dependent EMA rows,
  fit count, prefix/recovery, equality close dan invalid availability.

Sebelum source diperbaiki, targeted tests mereproduksi3 backend failures dan
4 Python failures. Setelah diperbaiki,149 Python dan33 backend unit tests lulus.
Reproduksi audit langsung kini menghasilkan blockedUntil707000 (sesuai expected)
dan delayed-main values[null]/reason stale, bukan fitur valid pada timestamp awal.

Local public-export smoke pada19:59:52 WIB lulus:495 fit rows,1185 vectors x299,
255 warm-up unavailable,720 heldout decisions. Normalizer/artifact/file SHA tetap
identik dengan hasil M4 awal. Tidak ada download baru, migration atau perubahan
config schema/artifact format. Context tetap synthetic FLAT.

Full-suite run awal setelah fix: dua legacy DB tests terkena query timeout500ms
(configuration create503 dan foundation metadata read). Test cooldown baru lulus.
Verification diulang pada cluster fresh dengan timeout aplikasi tetap sama.
**Final `npm run verify:features` exit0 PASSED**,20:01:21–20:03:10 WIB
(UTC13:01:21.993–13:03:10.374):77 contracts +33 backend unit +149 Python +31
PostgreSQL/HTTP integration = **290 tests tanpa skip**. Build/typecheck/lint/format,
contract export drift, fresh/reapply/M1+M2 upgrades, data preservation dan zero
schema diff lulus; cluster test dihentikan. Logs: `.runtime/fix-audit-m1-m4.log` dan
`.runtime/fix-audit-m1-m4-final.log`; report `.runtime/features-report.json`.
Audit dokumentasi:20 dokumen,110 local links valid,0 trailing whitespace dan
`git diff --check` lulus. Setelah final suite, perubahan hanya dokumentasi.

## Hasil M4 — Feature Engineering

Tanggal:6 November2026, Asia/Jakarta. Final command
`.tools/node/npm.cmd run verify:features`: exit0 PASSED. Report lokal
`.runtime/features-report.json`: UTC12:40:10.127–12:42:04.441
(WIB19:40:10–19:42:04). **279 tests lulus tanpa skip**.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Build/typecheck, ESLint/Ruff/Prettier, contracts export drift | Lulus |
| TypeScript contracts | 77 passed (70 M2/M3 +7 feature contract cases) |
| Backend unit | 30 passed |
| Python | 142 passed; semantic conformance, exact hashes, all23 independent indicator vectors, seeds/edge values, train-only/prefix invariance, context/shape, artifact/provenance/corruption E2E |
| PostgreSQL/HTTP integration | 30 passed; seluruh M1–M3 regression |
| Fresh/reapply/M1+M2 upgrades | Lulus; legacy data preserved, zero schema diff |
| Built process health/Python subprocess | Lulus; isolated cluster stopped |
| jsonschema promotion | 4.26.0 dev→runtime, package versions/transitive lock tetap; offline lock/sync lulus |
| Local public M3 export smoke | Lulus; fit/build CLI, replay dan artifact reload identik |

Smoke terakhir UTC12:40:52.589707 (WIB19:40:52),8.075s, memakai dataset publik M3
BTCUSDT2025-01-01 yang sudah ada; tidak ada download baru. Dataset
`3717d128-5be2-433f-90dc-ac21d3c35b54`, fingerprint
`229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa`.
Train range00:00–12:00UTC half-open menghasilkan495 fit rows. Build menghasilkan
1185 vectors x299 dan255 warm-up unavailable;720 heldout decisions pada
`[12:00,24:00)`. Context `synthetic_flat_context_on_public_market_data`, bukan
simulator/account state. Full build juga memuat close final pada Jan2 00:00UTC.

Normalizer `e9313eebe60972c72d972987e279757bfd3016b8faca0c3652db06c7a39bcfd9`;
artifact `7d34b20d9fb0f3ea010dcd618a93d705ccb8662a63fa5976a326d08f1bffb975`.
Binary SHA `91f098e6c647ecf4cc53647c2275c356c54f43546775684fc19d87148184a844`;
decision SHA `570a8878d39a816e8745495513976931cf9c318f7045309b3c4d8135a234751c`.
Report `.runtime/features-smoke.json`; command
`services/quant/.venv/Scripts/python.exe services/quant/tests/smoke_feature_export.py`.

Run awal gagal pada Windows pytest temp ownership SID. Workspace basetemp unik
dengan parent eksplisit memperbaikinya tanpa mengubah ACL global. Built API cold
startup terukur6.4s melewati polling lama sekitar5s; test startup budget kini30s,
health/database timeout aplikasi tetap. Test negatif snapshot kemudian diperbarui
agar mengharapkan checksum failure pada validator yang lebih awal. Final suite
di atas menguji source terakhir dan seluruh perbaikan, bukan hasil run gagal.

Detail formula, context dan limitations: [features](features.md);
[handoff M4](handoffs/milestone-04.md). Tidak ada simulator/training/trading claim.

Audit dokumentasi akhir:20 Markdown docs/README (PROJECT_SPEC tidak diubah),109
local links valid,0 trailing whitespace; `git diff --check` lulus. `.env`, runtime
reports dan feature artifacts tetap ignored. Timestamp `.env` tetap5 November2026
20:05:44 WIB;0 retained test clusters running. Dev DB55432 teramati stopped dan
tidak dinyalakan M4. Setelah final suite, perubahan hanya dokumentasi.

## Hasil M3 — Bybit Market Data

Tanggal:5 November2026, Asia/Jakarta. Final offline command
`.tools/node/npm.cmd run verify:market-data`: exit0 PASSED. Report lokal
`.runtime/market-data-report.json`: UTC14:58:26.357–15:00:10.168
(WIB21:58:26–22:00:10). Tidak ada dependency/runtime version upgrade dari M2.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Build/typecheck API/contracts/tests, export drift, ESLint/Ruff/Prettier | Lulus |
| Contract tests | 70 passed (52 config +18 market normalization/coverage) |
| Backend unit | 30 passed (16 foundation +14 public transport) |
| Python tests | 5 passed; structural schema/canonical vectors + CLI regressions |
| PostgreSQL/HTTP integration | 30 passed (14 M1/M2 +16 market ingestion scenarios) |
| Fresh/reapply M1–M3 migrations | Lulus; reapply no pending migration |
| M1/M2 additive upgrades | Legacy metadata/config sentinels dipertahankan; schema diff no difference |
| Resume/atomicity | Page budget/network failure resume, frozen cutoff, injected DB insert rollback dengan cursor/revisions tidak melompat |
| Worker/terminal protection | Global busy/stale owner reject, expired lease takeover, sealed finalization restart tanpa refetch, revision/dataset/member DML guards |
| Quality/fingerprint | Duplicates/order deterministic, gap/invalid/conflicts fail gate, correction leaves old dataset unchanged, incomplete excluded |
| Funding/reference variants | Signed/empty/irregular cadence dilabeli, no zero fill; mark/index volume null |
| Export/Python fixture E2E | Schema/quality/file digests/counts/ascending chronology lulus |
| Actual development migration | M3 applied ke bybit_dev127.0.0.1:55432; migrate status up to date |
| Public smoke | exit0, actual Bybit mainnet GET, completed24h BTCUSDT2025-01-01 UTC |
| Actual public export | 1440x1m +288x5m +96x15m +3 funding +instrument; zero missing/invalid/conflict,5 pages/0 retries |
| Actual Python export checker | exit0, passed files5 |
| Actual CLI download/export | completed run read idempotent, re-export digest sama; kedua commands exit0 |
| Final documentation/source checks | 17 dokumen,82 tautan lokal valid,0 trailing whitespace; git diff --check exit0; password lokal tidak ditemukan pada103 source files;0 cluster test aktif; runtime/export ignored |

Total135 automated cases ditambah orchestration/live assertions. Offline tests
tetap fixture-based untuk external HTTP, PostgreSQL nyata untuk integration.
Public smoke terpisah dan tidak disamakan dengan fixture data. Tidak ada mandatory
skip, private API, credential exchange, order, feature computation atau training.
Native cache/socket environment memerlukan approved escalated owner context
seperti milestone sebelumnya.

Actual smoke evidence `.runtime/bybit-smoke.json`: selesai UTC15:01:28.216Z
(WIB22:01:28), source bybit-mainnet. Dataset
3717d128-5be2-433f-90dc-ac21d3c35b54, download e4abb443-bc88-42cb-bdea-30b2d9139d65.
Fingerprint229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa.
Range `[1735689600000,1735776000000)`; actual metadata observation saat download,
historical funding cadence tetap unverified meskipun3 events berhasil diambil.
Execution-ready false. Artifacts/runtime di-ignore; ringkasan evidence disimpan
di source docs dan [handoff M3](handoffs/milestone-03.md).

Kegagalan awal integration disebabkan query advisory lock mengembalikan void
unsupported oleh Prisma. Setelah query mengembalikan integer, suite lulus.
Shutdown checkpoint Windows sempat melewati timeout30 detik tetapi server benar
berhenti; helper wait menjadi60 detik dan final cleanup lulus. Tidak memperbaiki
test dengan mengendurkan invariant worker/data. Diagnostic invalid-page counters
tetap dipersist tanpa memajukan cursor; cadence case memakai batch720 candles.

## Hasil M2 — Configuration System

Tanggal: 5 November 2026, Asia/Jakarta. Final command
`.tools/node/npm.cmd run verify:configuration`: exit 0, PASSED.
Report lokal `.runtime/configuration-report.json`: UTC
2026-11-05T13:46:49.156Z–13:48:06.783Z (WIB 20:46:49–20:48:06).
Runtime/dependency M1 tetap; tambahan workspace contracts dan Python dev dependency
jsonschema4.26.0 beserta transitive packages pada uv.lock.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Contracts build dan artifact export:check | Lulus, schema/preset/fixtures tidak drift |
| TypeScript build dan typecheck API/contracts/tests | Lulus |
| ESLint/Ruff/Prettier | Lulus |
| Contract unit tests | 52 passed: groups/type/range/cross-field, decimal precision/hash, preset, compatibility |
| Backend unit regression M1 | 16 passed |
| Python tests | 4 passed: 2 health CLI + shared structural schema + raw-config canonical/hash vectors |
| PostgreSQL/HTTP integration | 14 passed: 4 foundation + 10 configuration scenarios |
| Fresh/reapply migration | M1+M2 applied, reapply no pending migration |
| Upgrade M1 -> M2 | Legacy DB dibuat lewat migration M1 asli; sentinel data dan foundation marker tetap, config marker baru tersedia |
| Prisma schema diff setelah upgrade | No difference detected, exit 0 |
| Snapshot immutability | API tidak punya update/delete, raw SQL UPDATE/DELETE/TRUNCATE ditolak, FK parent deletion ditolak |
| Concurrency | Satu CAS update menang; stale409; concurrent snapshots ID sama; snapshot/edit race tidak mencampur payload/revision |
| Invalid input/no-write | Create/update invalid400 tanpa record/revision berubah; corrupt/unsupported snapshot409 |
| Compatibility | Exact/incompatible/retraining/reevaluation report; approval/execution selalu not_assessed |
| Failure responses | Storage unreachable503 tersanitasi, validation tetap tersedia; M1 health/error regressions lulus |
| Built-process E2E | API live/ready sebelum/sesudah schema, invalid startup nonzero, Python subprocess valid |
| Development migration | Additive M2 applied ke bybit_dev127.0.0.1:55432; migrate status up to date |
| Final documentation/source verification | 14 dokumen, 60 tautan lokal valid, 0 trailing whitespace; git diff --check exit0; password lokal tidak ditemukan pada 79 source files; 0 cluster test aktif |

Total 86 automated test cases ditambah orchestration smoke/migration assertions.
Tidak ada test wajib di-skip; tidak ada Bybit network call, training atau order.
Test clusters dan built smoke API dihentikan runner, development DB tetap running.
Native cache/socket membutuhkan eskalasi context pemilik workspace seperti M1.
Schema JSON/Python tests hanya structural; semantic execution parity Python belum
diklaim. PostgreSQL immutability membatasi ordinary DML, bukan admin DDL.

Satu fixture awal duplicate position input melebihi max array length sehingga
menguji structural length sebelum semantic duplication; fixture diperbaiki dengan
duplikasi dalam panjang yang valid. Sebelum final verification, nama constraint
dan updated_at default diselaraskan agar tidak ada schema drift. SQL M1 tidak diubah.

## Hasil historis M1 — Project Foundation

Tanggal: 5 November 2026, Asia/Jakarta. Runtime aktual: Node 24.22.2, CPython
3.12.12, PostgreSQL 17.10, NestJS 12.3.3, Prisma/client/adapter 7.10.1, TypeScript
5.9.3, Vitest 5.1.0, pytest 9.2.0. Dependency exact lainnya pada lockfiles.

| Command / pemeriksaan | Hasil aktual |
| --- | --- |
| `python scripts/bootstrap.py` | Exit 0; runtime portable di workspace, archive SHA256 dicatat |
| `.tools/node/node.exe scripts/tasks.mjs setup` | Exit 0; locked npm/uv deps, Python env, development DB dan migration siap |
| `.tools/node/npm.cmd run verify:foundation` | Exit 0, PASSED; terakhir 20:10:38–20:11:27 WIB |
| Prisma generate + TypeScript build/typecheck | Lulus |
| ESLint API/scripts dan Ruff check/format | Lulus |
| Prettier format check | Lulus; scope source TS/JS/JSON, tidak memindai Python runtime/cache |
| Vitest unit | 2 file, 16 tests lulus |
| Pytest | 2 tests lulus, tanpa cacheprovider agar tidak tergantung ownership cache sandbox |
| Vitest integration | 1 file, 4 tests lulus, dedicated PostgreSQL nyata |
| Migration from empty/reapply | Apply satu migration, reapply tanpa pending/duplicate marker |
| Built API sebelum migration | Actual HTTP readiness 503, liveness 200 |
| Built API setelah migration | Actual HTTP readiness/liveness 200 |
| ORM transaction | Read/write dan rollback terverifikasi, probe tidak tertinggal |
| Invalid marker dan DB unreachable | Readiness 503 tersanitasi, bounded, liveness tetap 200 |
| Invalid startup environment | Built API exit nonzero |
| Python subprocess | JSON health valid dan runtime 3.12; dari root melalui isolated executable |
| Development DB lifecycle | db:stop/status/start/migrate/status exit 0; status false lalu true |
| Cleanup | Proses built smoke API dan cluster test dihentikan runner |
| Source secret/ignore check | Generated local DB password tidak ditemukan dalam 51 source files sebelum final docs sync; .env/runtime/venv/generated client ignored |
| Final documentation/source check | 12 dokumen, 47 tautan lokal valid, 0 trailing whitespace, git diff --check exit 0; password lokal tidak ditemukan pada 52 source files; 0 cluster test aktif |

Report lokal terakhir `.runtime/foundation-report.json`: status passed, UTC
2026-11-05T13:10:38.335Z sampai 13:11:27.095Z. Report runtime di-ignore; ringkasan
hasil dipertahankan di dokumen ini dan [handoff M1](handoffs/milestone-01.md).
Tidak ada network/API Bybit, real/demo order, training atau profit test.

Verification dijalankan dengan execution context pemilik workspace melalui
eskalasi environment: socket sandbox dibatasi dan native SWC cache menolak SID
sandbox yang berbeda. Tidak ada test wajib di-skip atau diganti mock sebagai
pengganti PostgreSQL. Unit test sengaja memakai dependency fake untuk menguji
timeout/error; integration dan built API smoke menggunakan PostgreSQL nyata.

Masalah yang diperbaiki sebelum final pass: pg_ctl inherited pipe menyebabkan
runner hang Windows; test ConfigService generic type; native cache path; Ruff
explicit check=False; formatter traversal cache permission; merge config Vitest
yang sempat mengulang unit dalam suite integration. Final suite terpisah 16+2+4.

## Catatan penutupan M0 (historis)

M0 hanya dokumentasi. Saat M0 ditutup belum ada unit/integration/contract test
atau runtime aplikasi. Hasil di bawah adalah pemeriksaan dokumen, bukan
bukti aplikasi atau trading berhasil. Tanggal: 5 November 2026, Asia/Jakarta.

| Pemeriksaan | Hasil |
| --- | --- |
| Git dan inventaris awal | Working tree awal bersih; hanya PROJECT_SPEC.md dan .git; baseline commit a7cf3ef |
| Kelengkapan delapan dokumen | Lulus; 8/8 file ditemukan dengan pemeriksaan PowerShell |
| Tautan Markdown lokal | Lulus; seluruh target lokal ditemukan, 0 tautan rusak |
| Task M0 0.1–0.18 dan task M1–M16 | Lulus; 284 ID task unik spesifikasi tercantum dalam roadmap, 0 hilang |
| Whitespace diff | Lulus; `git diff --check` exit 0; pemindaian delapan file baru juga menemukan 0 trailing whitespace |
| Accounting walkthrough | Lulus pemeriksaan aritmetika PowerShell; LONG 4,795 dan SHORT 4,805 dalam toleransi 1e-9 |
| Konsistensi scope/status | Pada penutupan M0: Completed setelah penerimaan pengguna, M1 belum Approved |
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
