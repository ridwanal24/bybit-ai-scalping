# Konfigurasi foundation

M1 menyediakan runtime environment untuk API dan koneksi database. Konfigurasi
market/risk/trading dan immutable experiment snapshot baru dikerjakan pada M2.

Root `.env` lokal dibuat `npm run setup` hanya jika file belum ada. Password DB
generated acak; tidak dicetak atau di-commit. `.env.example` hanya template.
Environment proses yang diberikan eksplisit mengalahkan `.env`. API dijalankan
melalui runner root agar file env dimuat dengan konsisten; menjalankan built API
langsung memerlukan environment yang disediakan sendiri.

| Variabel | Default / aturan |
| --- | --- |
| NODE_ENV | development; development/test/production saja |
| HOST | 127.0.0.1; hanya 127.0.0.1, ::1, localhost |
| PORT | 3000; integer 1–65535 |
| DATABASE_URL | Wajib; URL postgres/postgresql dengan hostname dan nama database |
| DATABASE_TIMEOUT_MS | 2000; integer 100–30000; timeout pool/query dan readiness |
| PYTHON_PATH | services/quant/.venv/Scripts/python.exe; path nonkosong, disiapkan untuk integrasi berikutnya |

Runner foundation menggunakan Python terisolasi yang dipin; PYTHON_PATH belum
menjadi kontrol worker/inference. Invalid environment ditolak tanpa mencetak
nilai input. DB/schema tidak tersedia membuat readiness 503, tetapi liveness
tetap 200. Batas timeout readiness juga berlaku jika dependency tidak merespons.

## Runtime dan state lokal

`toolchain.json` memin versi dan checksum archive Node, uv serta PostgreSQL.
Node/uv awalnya diverifikasi terhadap checksum upstream. PostgreSQL didapat lewat
HTTPS distribusi EDB yang dirujuk situs PostgreSQL; checksum pertama dihitung
lokal lalu dipin untuk unduhan ulang, bukan diklaim signature/checksum upstream.
Python dikelola uv pada `.tools/python`; package versions di `uv.lock`.

| Path (ignored) | Isi |
| --- | --- |
| .tools/ | Runtime portable, cache npm/uv, download dan provenance checksum |
| .runtime/postgres/ | Cluster development, marker ownership/credential lokal, logs |
| .runtime/integration/ | Cluster test terisolasi per run, dipertahankan untuk diagnosis |
| .runtime/logs/ | Log smoke API |
| .runtime/foundation-report.json | Hasil verification terakhir; baca status dan timestamp |
| services/quant/.venv/ | Virtual environment Python |

Jangan membagikan `.env`, marker cluster atau runtime logs tanpa pemeriksaan.
File runtime menyimpan credential DB lokal; permission file pada Windows mengikuti
ACL workspace. Ini setup lokal, belum secret store produksi. Tidak ada credential
Bybit atau runtime mode live pada M1.

Port DB development 55432, test 55433, smoke API 53001, semuanya loopback. Cluster
default menggunakan role development `bybit`; bukan role least-privilege produksi.
Port bentrok menyebabkan gagal, tidak mematikan proses lain. Marker path/PID/
postmaster options diperiksa sebelum stop database milik proyek.

DATABASE_URL boleh menunjuk DB proyek existing yang sengaja disediakan. Perintah
`db:start/stop/status` tetap mengelola cluster portable milik workspace, tidak
mengendalikan server dari DATABASE_URL. `setup` menyiapkan cluster default dan
menerapkan migration menggunakan DATABASE_URL efektif; review env Anda sebelum
setup bila memakai DB existing. Tidak ada operasi reset/drop otomatis.
