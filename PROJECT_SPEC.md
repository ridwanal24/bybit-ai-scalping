# MASTER PROJECT PROMPT
# BYBIT AI SCALPING
## Reinforcement Learning, Research & Automated Trading Platform

**Project Type:** Long-Term Software Engineering & Quantitative Research  
**Primary Stack:** NestJS + React + Python + PostgreSQL  
**Initial RL Algorithm:** MaskablePPO  
**Development Method:** Milestone-Based, Review-Driven  
**Approval Unit:** One Milestone  
**Session Strategy:** One Chat Window per Milestone (Recommended)  
**Final Target:** Automated Trading on Bybit Demo and Real Accounts  
**Current Stage:** Milestone 0 — Planning

---

# 1. PERAN AI CODING AGENT

Bertindaklah sebagai:

- Senior Software Engineer
- Software Architect
- Quantitative Developer
- Reinforcement Learning Engineer
- Machine Learning Engineer
- Trading Systems Engineer
- QA Engineer
- Security Engineer
- Software Maintenance Engineer

Saya ingin membangun sebuah platform AI Crypto Scalping menggunakan Bybit API V5 dan Reinforcement Learning.

Platform ini tidak hanya digunakan untuk melakukan training AI, tetapi juga untuk melakukan penelitian strategi, backtesting, evaluasi, pengelolaan model, serta automated trading pada akun Bybit Demo dan Real.

Proyek ini direncanakan untuk terus dikembangkan dalam jangka panjang.

Oleh karena itu, prioritaskan:

1. Kebenaran implementasi.
2. Konsistensi perilaku sistem.
3. Kualitas dan keamanan trading.
4. Kemudahan maintenance.
5. Reproducibility.
6. Modularitas.
7. Testing.
8. Dokumentasi.
9. Kemudahan pengembangan lanjutan.
10. Penggunaan resource secara efisien.

Jangan membangun sistem yang hanya terlihat lengkap, tetapi sulit diuji, diperbaiki, atau dikembangkan.

---

# 2. ATURAN UTAMA PENGERJAAN

**SATU PENGERJAAN = SATU MILESTONE YANG TELAH DISETUJUI.**

Saya tidak ingin memberikan persetujuan untuk setiap task kecil.

Gunakan milestone sebagai unit utama perencanaan, persetujuan, implementasi, review, dan penyelesaian pekerjaan.

## 2.1 Milestone-Based Workflow

Setiap milestone mengikuti siklus:

1. Pelajari kondisi repository dan dokumentasi.
2. Identifikasi milestone aktif.
3. Analisis seluruh task dalam milestone tersebut.
4. Identifikasi dependency dan risiko.
5. Susun Milestone Implementation Plan.
6. Jelaskan file yang diperkirakan dibuat atau diubah.
7. Tentukan acceptance criteria milestone.
8. Tunggu review dan persetujuan eksplisit saya.
9. Setelah disetujui, implementasikan seluruh task dalam milestone.
10. Jalankan unit tests dan integration tests yang relevan.
11. Lakukan perbaikan dalam scope milestone.
12. Jalankan milestone-level verification.
13. Perbarui dokumentasi dan progress.
14. Buat milestone handoff.
15. Laporkan hasil akhir milestone.
16. Berhenti dan tunggu instruksi berikutnya.

**Jangan meminta persetujuan untuk setiap task dalam milestone yang sudah disetujui.**

Task dan subtask adalah pembagian pekerjaan internal.

AI diperbolehkan mengerjakan task secara berurutan sampai milestone selesai, selama masih berada dalam scope dan rencana yang disetujui.

## 2.2 Milestone Approval

Persetujuan saya terhadap suatu milestone berarti AI diizinkan:

- Membuat file yang dibutuhkan milestone tersebut.
- Mengubah file yang relevan.
- Menambahkan dependency yang sudah dijelaskan.
- Membuat atau memperbarui unit tests.
- Menjalankan integration tests.
- Melakukan refactor kecil yang diperlukan dalam scope.
- Memperbarui dokumentasi.
- Memperbaiki bug yang muncul akibat implementasi milestone.

Persetujuan milestone bukan izin tanpa batas.

## 2.3 Kapan Harus Meminta Persetujuan Tambahan?

Minta persetujuan tambahan jika diperlukan:

- Mengubah arsitektur utama di luar rencana.
- Menambah milestone atau fitur besar yang tidak disetujui.
- Melakukan perubahan database yang destruktif.
- Menghapus atau menimpa data penting.
- Mengganti dependency utama dengan dampak luas.
- Mengubah trading behavior secara fundamental.
- Mengubah hard safety limits.
- Menggunakan API credentials yang belum disetujui.
- Mengaktifkan transaksi menggunakan dana sungguhan.
- Melakukan operasi eksternal yang memiliki dampak besar atau tidak dapat dibatalkan.

Jika ada blocker kritis, hentikan bagian yang terdampak, jelaskan masalahnya, dan minta keputusan saya.

Jangan diam-diam mengambil keputusan berisiko tinggi.

## 2.4 Aturan Review

Jika saya hanya meminta:

- Analisis.
- Review.
- Audit.
- Penjelasan.
- Perbandingan solusi.

Jangan langsung mengubah kode.

Jika saya menyetujui milestone, kamu boleh mengimplementasikan seluruh milestone tanpa ACC tambahan untuk task normal di dalamnya.

## 2.5 Aturan Penyelesaian

Setelah satu milestone selesai:

- Jangan otomatis melanjutkan milestone berikutnya.
- Jangan mengerjakan fitur future milestone.
- Jangan memperluas scope hanya karena masih berkaitan.
- Jangan mengklaim selesai jika integration tests wajib belum berhasil.
- Laporkan keterbatasan secara transparan.

---

# 3. STRUKTUR ORGANISASI PROYEK

Gunakan struktur:

**Project → Phase → Milestone → Task → Subtask**

## Project

Keseluruhan aplikasi Bybit AI Scalping.

## Phase

Tahapan besar yang menghasilkan kemampuan end-to-end.

Contoh:

- Simulation MVP.
- RL Proof of Concept.
- Research Platform.
- Live Trading.

## Milestone

Satu paket pekerjaan yang memiliki tujuan, scope, dan acceptance criteria yang jelas.

**Milestone merupakan unit utama persetujuan dan penyelesaian.**

## Task

Langkah teknis dalam milestone.

Tidak membutuhkan persetujuan terpisah setelah milestone disetujui.

## Subtask

Pecahan task jika implementasi membutuhkan langkah lebih kecil.

Tidak membutuhkan persetujuan terpisah selama tidak keluar dari scope milestone.

---

# 4. CHAT WINDOW & SESSION MANAGEMENT

Gunakan pendekatan:

**Satu Chat Window = Satu Milestone**, selama ukuran konteks masih memungkinkan.

Contoh:

- Chat 1: Milestone 0 — Planning.
- Chat 2: Milestone 1 — Foundation.
- Chat 3: Milestone 2 — Configuration.
- Chat 4: Milestone 3 — Market Data.

Seluruh chat menggunakan repository yang sama.

Tidak perlu membuat project atau repository baru setiap milestone.

Jika milestone terlalu besar untuk satu chat, boleh melanjutkannya di chat baru dengan milestone dan approval scope yang sama.

Jangan menganggap pergantian chat sebagai alasan untuk memulai ulang pekerjaan.

## 4.1 Sumber Kebenaran

Gunakan urutan berikut:

1. Kondisi aktual repository dan hasil pengujian.
2. PROJECT_SPEC.md.
3. Dokumen arsitektur dan keputusan yang telah disetujui.
4. docs/progress.md.
5. Dokumentasi operasional dan kontrak terkait.

Jika dokumentasi berbeda dengan implementasi, jangan otomatis memilih salah satunya.

Periksa perbedaannya dan laporkan.

## 4.2 Saat Memulai Chat Baru

AI wajib:

1. Membaca PROJECT_SPEC.md.
2. Membaca docs/progress.md.
3. Membaca docs/roadmap.md.
4. Membaca docs/architecture.md.
5. Membaca docs/decisions.md yang relevan.
6. Membaca handoff milestone sebelumnya.
7. Memeriksa repository dan status Git jika tersedia.
8. Memeriksa test status terakhir.
9. Mengidentifikasi milestone aktif.
10. Menentukan apakah milestone sudah disetujui.
11. Menjelaskan kondisi proyek.
12. Menyusun rencana milestone jika belum disetujui.

Jangan mengandalkan ingatan chat sebelumnya sebagai satu-satunya konteks.

## 4.3 Approval Scope Antar-Chat

Jika milestone sudah disetujui pada chat sebelumnya dan persetujuannya terdokumentasi, jangan meminta persetujuan ulang untuk task yang masih termasuk scope tersebut.

Namun, jangan menganggap catatan persetujuan berlaku untuk milestone lain.

Jika tidak ada bukti jelas bahwa milestone telah disetujui, minta persetujuan sebelum mengubah kode.

## 4.4 Milestone Handoff

Sebelum menyelesaikan milestone, buat atau perbarui handoff yang menjelaskan:

- Milestone ID dan nama.
- Approval scope.
- Status akhir.
- Task yang selesai.
- Task yang belum selesai.
- File yang dibuat/diubah.
- Arsitektur atau kontrak yang berubah.
- Dependency baru.
- Database migrations.
- Tests yang dijalankan.
- Hasil aktual tests.
- Known issues.
- Technical debt.
- Keputusan penting.
- Instruksi menjalankan aplikasi.
- Milestone berikutnya.
- Hal penting yang harus diperiksa di chat baru.

Gunakan dokumentasi yang ringkas dan mudah dipahami.

---

# 5. PROJECT DOCUMENTATION SYSTEM

Dokumentasi adalah bagian wajib dari proyek.

File awal yang direncanakan:

- PROJECT_SPEC.md
- README.md
- docs/architecture.md
- docs/roadmap.md
- docs/decisions.md
- docs/progress.md
- docs/configuration.md
- docs/testing.md
- docs/operations.md
- docs/handoffs/

Tidak semua file harus dibuat pada hari pertama.

Buat dan lengkapi sesuai milestone yang relevan.

## 5.1 PROJECT_SPEC.md

Berisi:

- Visi proyek.
- Target akhir.
- Functional requirements.
- Non-functional requirements.
- Technology stack.
- Engineering principles.
- Development workflow.
- Milestone approval policy.
- Safety constraints.
- Project roadmap.

Dokumen ini menjadi sumber requirement utama.

Jangan mengubah requirement penting tanpa persetujuan saya.

## 5.2 docs/architecture.md

Berisi:

- System architecture.
- Component responsibilities.
- Data flow.
- Inter-service communication.
- Trading execution flow.
- Deployment structure.
- Important interfaces.

Perbarui ketika arsitektur berubah.

## 5.3 docs/roadmap.md

Berisi:

- Phase.
- Milestone.
- Task.
- Dependencies.
- Acceptance criteria.
- Status.
- Review checkpoints.

Jangan menandai milestone Completed hanya karena seluruh file telah dibuat.

## 5.4 docs/decisions.md

Catat keputusan penting:

- Context.
- Decision.
- Alternatives.
- Reasons.
- Tradeoffs.
- Consequences.

Gunakan Architecture Decision Record sederhana jika diperlukan.

## 5.5 docs/progress.md

Minimal mencakup:

- Current phase.
- Current milestone.
- Milestone approval status.
- Milestone implementation status.
- Completed tasks.
- Remaining tasks.
- Test summary.
- Known issues.
- Blockers.
- Next milestone.

Gunakan status seperti:

- Planned.
- Awaiting Approval.
- Approved.
- In Progress.
- Blocked.
- Verification.
- Completed.

Bedakan milestone yang selesai diimplementasikan dengan milestone yang sudah lolos verifikasi.

## 5.6 docs/handoffs/

Simpan ringkasan handoff per milestone.

Contoh:

- milestone-00.md
- milestone-01.md
- milestone-02.md

Handoff harus menjelaskan kondisi aktual proyek dan menjadi referensi untuk chat berikutnya.

## 5.7 Documentation Update Policy

Selama pengerjaan milestone:

- Progress internal boleh dicatat secara bertahap.
- Keputusan penting dicatat ketika dibuat.
- Dokumentasi arsitektur diperbarui ketika implementasinya berubah.
- Pada akhir milestone, seluruh dokumentasi relevan harus disinkronkan.

Jangan mendokumentasikan fitur sebagai selesai jika fitur tersebut belum berjalan.

Jangan menghabiskan waktu berlebihan membuat dokumentasi yang tidak dibutuhkan.

---

# 6. VISI DAN TARGET AKHIR APLIKASI

Aplikasi harus memungkinkan pengguna:

1. Mengambil historical Bybit market data.
2. Memilih pair dan timeframe.
3. Mengatur historical data range.
4. Mengatur capital dan risk management.
5. Mengatur RR, ATR, SL, TP, dan exit mode.
6. Memilih indikator dan AI features.
7. Mengatur neural network architecture.
8. Mengatur training hyperparameters.
9. Melatih AI menggunakan Reinforcement Learning.
10. Menyimpan model neural network.
11. Mengelola model registry.
12. Menjalankan backtesting.
13. Menjalankan walk-forward evaluation.
14. Menjalankan sensitivity testing.
15. Membandingkan model dan eksperimen.
16. Melakukan feature ablation.
17. Membandingkan neural network architectures.
18. Melakukan optional hyperparameter optimization.
19. Menjalankan model pada real-time market data.
20. Menjalankan paper trading.
21. Menjalankan Bybit Demo Trading.
22. Menjalankan Bybit Real Trading.
23. Memantau order dan positions.
24. Memantau balance, equity, PnL, dan drawdown.
25. Melihat keputusan agent dan hasil risk checks.
26. Menghentikan automated trading.
27. Melakukan emergency flatten.
28. Mengelola model deployment dan rollback.
29. Melihat riwayat eksperimen dan transaksi.
30. Melanjutkan pengembangan sistem dalam jangka panjang.

Sistem harus mampu melakukan:

Market Data → Feature Engineering → Observation → Model Inference → Risk Checks → Order Management → Exchange Execution → Position Reconciliation → Monitoring.

Sistem tidak hanya menghasilkan sinyal.

Sistem harus dapat mengeksekusi dan mengelola order secara otomatis sesuai trading mode.

Tidak ada jaminan profit.

Model yang gagal memenuhi kriteria evaluasi tidak boleh otomatis dipromosikan ke real trading.

---

# 7. TECHNOLOGY STACK

## 7.1 Backend

- Node.js
- TypeScript
- NestJS
- PostgreSQL
- Prisma atau ORM yang sesuai
- Class-validator atau Zod
- Jest/Vitest sesuai kompatibilitas

Gunakan modular NestJS architecture.

Hindari overengineering dan abstraction yang belum dibutuhkan.

## 7.2 Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- TanStack Query
- TradingView Lightweight Charts

## 7.3 AI & Quantitative Engine

- Python
- PyTorch
- Gymnasium
- Stable-Baselines3
- sb3-contrib
- MaskablePPO
- NumPy
- Pandas
- Pytest
- FastAPI jika diperlukan

## 7.4 Optional Optimization

- Optuna.

Implementasikan hanya setelah basic training dan evaluation stabil.

## 7.5 Infrastructure

- Docker Compose jika relevan.
- PostgreSQL.
- Environment-based configuration.
- Background workers.
- Structured logging.
- Model artifact storage.
- Database migrations.
- Backup/recovery procedures.

## 7.6 Resource Constraints

Prioritaskan single-machine development.

Jangan mewajibkan GPU untuk MVP.

Training awal harus bisa dijalankan menggunakan CPU dengan batas resource yang jelas.

Gunakan smoke tests dan small datasets sebelum training panjang.

Jangan menambahkan distributed training atau cloud infrastructure kompleks tanpa kebutuhan.

---

# 8. SYSTEM ARCHITECTURE

## 8.1 NestJS Backend

Bertanggung jawab untuk:

- Bybit REST integration.
- Bybit WebSocket integration.
- Historical data collection.
- Database persistence.
- Configuration management.
- Experiment management.
- Training orchestration.
- Dashboard API.
- Exchange adapters.
- Order management.
- Live risk validation.
- Position reconciliation.
- Audit logging.

## 8.2 Python Quantitative Engine

Bertanggung jawab untuk:

- Feature engineering.
- Observation construction.
- Historical simulator.
- Portfolio accounting.
- Reward calculation.
- RL environment.
- Training.
- Backtesting.
- Evaluation.
- Model inference.
- Neural network configuration.
- Model research.

## 8.3 React Frontend

Bertanggung jawab untuk:

- Market configuration.
- Trading configuration.
- Feature configuration.
- Neural network configuration.
- Training controls.
- Backtesting controls.
- Experiment visualization.
- Model management.
- Live trading monitoring.
- Emergency controls.

## 8.4 Shared Contracts

Definisikan kontrak untuk:

- Candle.
- Feature vector.
- Observation.
- Agent action.
- Trading configuration.
- Model metadata.
- Risk decisions.
- Order intent.
- Order status.
- Position state.
- Execution.
- Evaluation result.

Gunakan schema validation.

Jangan membuat kontrak yang sama dengan arti berbeda pada beberapa service.

## 8.5 Single Source of Truth

Gunakan Python sebagai sumber utama historical simulation.

Gymnasium environment dan backtesting harus menggunakan simulator yang sama.

Jangan membuat simulator yang menghasilkan perhitungan PnL berbeda antara training dan evaluation.

Untuk live execution, gunakan exchange-specific adapters tetapi pertahankan risk semantics yang konsisten melalui shared specifications dan conformance tests.

Live risk protection tidak boleh bergantung pada keberhasilan model inference.

---

# 9. TRADING MODES

## 9.1 Backtesting

- Historical data.
- Simulated orders.
- Transaction costs.
- Equity tracking.
- Trade history.
- Evaluation metrics.

Tidak mengirim order ke exchange.

## 9.2 Paper Trading

- Real-time public market data.
- Internal virtual account.
- Simulated order execution.
- Model inference.
- Position persistence.
- Real-time monitoring.

## 9.3 Bybit Demo Trading

- Demo credentials.
- Demo REST API.
- Private WebSocket sesuai dukungan Bybit.
- Dana virtual Bybit.
- Exchange order lifecycle.
- Position reconciliation.

Demo bukan simulator internal.

## 9.4 Bybit Real Trading

- Real account credentials.
- Dana sungguhan.
- Automated entries/exits.
- Protective SL/TP.
- Risk management.
- Order reconciliation.
- Emergency controls.

**Real Trading disabled by default.**

Tidak boleh ada perpindahan otomatis dari Paper/Demo menuju Real.

## 9.5 Testnet

Boleh digunakan untuk testing integrasi tambahan.

Testnet, Demo, dan Mainnet adalah lingkungan berbeda.

Periksa official Bybit API documentation saat implementasi.

---

# 10. TRADING & RISK CONFIGURATION

Semua parameter penting harus configurable tanpa mengubah source code.

## 10.1 Market Configuration

- Exchange.
- Market category.
- Pair.
- Main timeframe.
- Secondary timeframes.
- Historical start/end.
- Trading mode.

Default:

- Exchange: Bybit.
- Market: USDT Perpetual.
- Category: linear.
- Pair: BTCUSDT.
- Main timeframe: 1m.
- Secondary timeframes: 5m dan 15m.

Timeframe yang direncanakan:

- 1m.
- 3m.
- 5m.
- 15m.
- 30m.
- 1h.
- 4h.
- 1D.

Aktifkan hanya yang didukung exchange.

## 10.2 Capital & Risk Configuration

- Initial capital.
- Risk per trade.
- Maximum leverage.
- Maximum position size.
- Maximum margin allocation.
- Maximum concurrent positions.
- Daily loss limit.
- Maximum drawdown.
- Cooldown.
- Maximum holding duration.
- Minimum available margin.

Default penelitian:

- Initial capital: 1.000 USDT.
- Risk per trade: 0,5%.
- Maximum concurrent positions: 1.
- Daily loss limit: 2%.
- Maximum drawdown: 10%.

MVP hanya mendukung satu posisi aktif.

Default merupakan parameter penelitian, bukan jaminan keamanan.

## 10.3 Stop Loss Configuration

- SL method.
- ATR period.
- ATR multiplier.
- Minimum stop distance.
- Maximum stop distance.
- Trigger price reference.
- Estimated fee allowance.
- Estimated slippage allowance.

Default:

- ATR period: 14.
- ATR multiplier: 1,5.

Hard SL wajib.

## 10.4 Risk Reward Configuration

- Reward/risk ratio.
- Take profit mode.
- Exit mode.

Contoh:

- 1:1.
- 1:1,5.
- 1:2.
- 1:3.
- 1:4.

Gunakan numeric configuration.

Bedakan target RR, gross realized RR, dan net realized RR.

## 10.5 Execution Configuration

- Maker fee.
- Taker fee.
- Spread assumption.
- Slippage assumption.
- Funding assumption.
- Order type.
- Execution timeout.
- Stop trigger price type.

Jangan mengasumsikan satu tarif fee berlaku pada seluruh akun.

## 10.6 Configuration Validation

Wajib:

- Type validation.
- Range validation.
- Cross-field validation.
- Persistence.
- Presets.
- Versioning.
- Immutable experiment snapshots.
- Model compatibility checks.

Perubahan konfigurasi tidak boleh mengubah hasil eksperimen historis.

Jangan mengubah konfigurasi posisi aktif secara diam-diam.

---

# 11. FEATURE ENGINEERING

Semua fitur aktif yang didefinisikan sebagai input model harus benar-benar masuk observation.

## Price Action

- OHLCV sebagai sumber.
- Log return.
- Percentage return.
- Candle body ratio.
- Upper wick ratio.
- Lower wick ratio.
- High-low range.
- Close location.
- Rolling returns.

## Trend

- EMA 9.
- EMA 21.
- EMA 55.
- Distance to EMA.
- Distance between EMAs.
- EMA slope jika diperlukan.

## Momentum

- RSI 14.
- MACD 12/26/9.

## Volatility

- ATR 14.
- ATR percentage.
- Rolling volatility.

## Volume

- Volume change.
- Relative volume.
- Volume moving average ratio.

## Multi-Timeframe

- Higher timeframe trend.
- Higher timeframe momentum.
- Higher timeframe volatility.

Hanya gunakan higher timeframe candles yang sudah selesai.

Jangan memakai informasi masa depan.

## Position State

- FLAT/LONG/SHORT.
- Unrealized PnL.
- Position duration.
- Distance to SL.
- Distance to TP jika berlaku.
- Position exposure.
- Available margin.

## Risk Context

- Current drawdown.
- Remaining daily risk budget.
- Trading allowed/blocked status.
- Relevant risk configuration.

## ObservationBuilder

Bangun satu observation pipeline yang konsisten antara:

- Training.
- Validation.
- Testing.
- Backtesting.
- Paper.
- Demo.
- Real.

Observation harus memiliki:

- Feature schema.
- Stable feature ordering.
- Fixed shape per model.
- Data types.
- Normalization artifact.
- Timestamp alignment.
- Invalid value handling.
- Compatibility validation.

## Normalization

Fit pada training data saja.

Validation, test, dan live menggunakan normalization artifact yang sama.

Jangan melakukan fitting ulang ketika live tanpa deployment model baru.

## Warm-Up

Sediakan historical warm-up yang cukup.

Jika observation belum valid, blokir entry baru.

## Feature Ablation

Dukung perbandingan:

- Price action + volume.
- Price action + trend.
- Price action + momentum.
- Full feature set.
- Full feature set + multi-timeframe.

Jangan menganggap indikator lebih banyak otomatis lebih baik.

---

# 12. NEURAL NETWORK ARCHITECTURE

Gunakan MaskablePPO dengan MlpPolicy sebagai algoritma pertama.

PPO menggunakan actor-critic.

- Actor/policy network menghasilkan distribusi action.
- Critic/value network memperkirakan value.
- Invalid action masking membatasi tindakan yang tidak valid.

## Architecture Configuration

Dukung:

- Policy hidden layers.
- Value hidden layers.
- Neurons per layer.
- Activation function.
- Architecture preset.
- Custom architecture.

## Presets

Small:

- Policy: [64,64].
- Value: [64,64].

Medium:

- Policy: [128,64].
- Value: [128,64].

Large:

- Policy: [256,128,64].
- Value: [256,128,64].

Custom:

- User-defined architecture.

Default awal: Small.

## Activation Function

Pilihan awal:

- Tanh.
- ReLU.

## Learning Behavior

Ditentukan sebelum training:

- Jumlah layer.
- Jumlah neuron.
- Activation function.
- Learning rate.
- Hyperparameters.

Dipelajari saat training:

- Weights.
- Biases.
- Policy behavior.
- Value estimates.

MaskablePPO standar tidak otomatis menambah atau menghapus layer.

## Architecture Validation

Validasi:

- Layer count.
- Neurons per layer.
- Activation support.
- Total model parameters.
- Observation compatibility.
- Action compatibility.
- Resource requirements.

Untuk MVP, gunakan Small terlebih dahulu.

Preset dan custom architecture dapat diperluas setelah RL pipeline terbukti bekerja.

---

# 13. MODEL COMPATIBILITY POLICY

Untuk MVP:

**Satu model dilatih dan dievaluasi untuk satu configuration snapshot yang jelas.**

Snapshot mencakup:

- Pair.
- Timeframe.
- Feature schema.
- Observation window.
- Normalization.
- SL settings.
- RR jika relevan.
- Exit mode.
- Risk assumptions.
- Network architecture.
- Training parameters.

Jangan menganggap model kompatibel dengan setiap pair, timeframe, RR, dan mode exit.

Jika konfigurasi berubah:

1. Validasi schema compatibility.
2. Evaluasi behavioral compatibility.
3. Tentukan kebutuhan backtesting ulang.
4. Tentukan kebutuhan retraining.
5. Catat keputusan.

Model multi-pair dan multi-configuration adalah future research, bukan kewajiban MVP.

---

# 14. HISTORICAL DATA PIPELINE

Gunakan Bybit API V5.

Data:

- OHLCV.
- Instrument metadata.
- Historical funding.
- Mark price jika diperlukan.
- Index price jika relevan.

Implementasikan:

- REST client.
- Pagination.
- Rate limit handling.
- Retry/backoff.
- Timeout handling.
- Resumable download.
- UTC normalization.
- Chronological ordering.
- Persistence.
- Duplicate detection.
- Missing candle detection.
- Incomplete candle rejection.
- Data quality reporting.
- Dataset fingerprinting.

Target awal: satu tahun historical data jika tersedia.

Jangan menganggap semua pair memiliki panjang histori sama.

## Data Validation

Periksa:

- OHLC consistency.
- Timestamp validity.
- Volume validity.
- Duplicate candles.
- Missing intervals.
- Incomplete candles.
- Out-of-order candles.

Jangan mengisi missing intervals secara diam-diam.

## Dataset Versioning

Simpan:

- Dataset ID.
- Source.
- Exchange.
- Market category.
- Pair.
- Timeframe.
- Start/end.
- Candle count.
- Quality report.
- Fingerprint.
- Download timestamp.

Dataset yang berubah harus memiliki identitas yang dapat dibedakan.

---

# 15. TRADING SIMULATOR

Simulator merupakan fondasi penelitian.

Jangan memulai training RL sebelum simulator melewati pengujian dasar.

Komponen:

- Market state.
- Portfolio state.
- Position state.
- Order state.
- Execution model.
- Cost model.
- Risk state.
- Equity tracking.
- Trade history.

## Position Rules

MVP:

- FLAT.
- LONG.
- SHORT.

Maksimal satu posisi.

Tidak ada:

- Martingale.
- Averaging down.
- Position stacking.

## Position Sizing

Dasar:

risk_amount = equity × risk_percentage

position_quantity = risk_amount / stop_distance

Implementasi aktual harus mempertimbangkan:

- Fees.
- Slippage.
- Quantity step.
- Tick size.
- Minimum quantity.
- Minimum notional.
- Available margin.
- Maximum leverage.
- Exchange constraints.

Jika quantity tidak memenuhi batas risiko, tolak entry.

## Costs

- Maker/taker fees.
- Slippage.
- Spread.
- Funding.
- Liquidation costs jika relevan.

Semua biaya tercermin dalam net equity.

## Price References

Bedakan:

- Last traded price.
- Mark price.
- Index price.

Jangan menganggap semuanya sama.

## Margin & Liquidation

Dukung atau modelkan secara eksplisit:

- Initial margin.
- Maintenance margin.
- Available margin.
- Margin rejection.
- Liquidation.

Jika simulator belum dapat memodelkan liquidation dengan cukup baik, jangan menganggap hasil backtest futures sepenuhnya realistis.

---

# 16. SIMULATOR EVENT ORDERING

Sebelum implementasi simulator, tetapkan event timeline yang deterministik.

Untuk MVP berbasis closed candles, gunakan prinsip:

1. Agent hanya dapat mengamati candle yang sudah selesai dan data lain yang telah tersedia saat keputusan dibuat.
2. Action yang dibuat setelah candle close tidak boleh diisi secara retroaktif pada harga candle tersebut.
3. Order intent dijadwalkan menggunakan next-available execution assumption.
4. Pending orders diproses pada interval market berikutnya sesuai aturan fill.
5. Protective SL/TP dan funding diproses sesuai waktu kejadian dan informasi yang tersedia.
6. Setelah event diproses, update balance, positions, equity, dan reward.
7. Bangun observation berikutnya hanya ketika waktunya sudah tiba.

Dokumentasikan secara khusus:

- Bar timestamp conventions.
- Candle open/close boundaries.
- Data availability timestamp.
- Order submission time.
- Fill time.
- Stop trigger time.
- Funding settlement.
- Margin checks.
- Episode termination.

Jika SL dan TP sama-sama tersentuh dalam satu candle OHLC, jangan memilih hasil terbaik tanpa bukti.

Gunakan asumsi konservatif atau data granular.

Buat unit tests yang membuktikan bahwa tidak ada future leakage.

---

# 17. ACCOUNTING & REWARD

## Portfolio Accounting

Definisikan secara matematis:

- Wallet balance.
- Realized PnL.
- Unrealized PnL.
- Fees.
- Funding.
- Margin.
- Equity.
- Drawdown.

Jangan menghitung PnL dua kali ketika unrealized PnL menjadi realized PnL.

## Reward Function

Reward awal berbasis net equity change.

Kandidat:

reward_t = net_equity_return_t - risk_penalty_t

Alternatif:

reward_t = log(equity_next / equity_previous) - risk_penalty_t

Log reward hanya digunakan jika equity positif dan nilainya terdefinisi.

Pilih reward awal pada tahap desain dan validasi menggunakan deterministic scenarios.

## Reward Integrity Tests

Uji:

- Always HOLD.
- Overtrading.
- Holding losing positions.
- Entry and exit fees.
- Unrealized-to-realized conversion.
- Funding settlement.
- Forced exit.
- Episode end.
- Reward hacking.
- Nonpositive equity.

Reward yang meningkat tidak otomatis membuktikan performa trading membaik.

---

# 18. EXIT STRATEGIES

Dukung tiga mode.

## AI Exit

- AI menentukan entry.
- AI menentukan discretionary exit.
- Hard SL wajib.
- RR tidak otomatis menghasilkan fixed TP.

## Fixed RR

- AI menentukan entry.
- Hard SL aktif.
- Fixed TP berdasarkan RR.
- AI discretionary close tidak tersedia.
- Forced exit tetap berlaku.

## Hybrid

- AI menentukan entry.
- AI boleh early exit.
- Hard SL aktif.
- Fixed TP aktif.
- Forced exit tetap berlaku.

Default penelitian: Hybrid.

Exit mode harus masuk model compatibility metadata.

---

# 19. REINFORCEMENT LEARNING ENVIRONMENT

Gunakan Gymnasium.

Actions:

0 = HOLD  
1 = OPEN_LONG  
2 = OPEN_SHORT  
3 = CLOSE_LONG  
4 = CLOSE_SHORT

## Action Masking

Ketika FLAT:

- HOLD valid.
- OPEN_LONG valid jika risk checks mengizinkan.
- OPEN_SHORT valid jika risk checks mengizinkan.
- CLOSE_LONG invalid.
- CLOSE_SHORT invalid.

Ketika LONG:

- HOLD valid.
- CLOSE_LONG valid jika exit mode mengizinkan.
- Aksi lain invalid.

Ketika SHORT:

- HOLD valid.
- CLOSE_SHORT valid jika exit mode mengizinkan.
- Aksi lain invalid.

Forced exits tetap dilakukan simulator.

HOLD harus valid ketika tidak ada aksi trading lain yang diperbolehkan.

## Gymnasium API

- reset().
- step().
- observation_space.
- action_space.
- action_masks().
- terminated.
- truncated.
- info.

Gunakan environment checks dan deterministic tests.

## Separation of Concerns

Jangan mencampur operational order states dengan RL action space.

Model memilih trading actions.

Order manager mengelola actual order lifecycle.

---

# 20. BASELINE STRATEGIES

Sebelum training RL, implementasikan:

- Always HOLD.
- Random Agent.
- EMA 9/21 Crossover.
- Buy & Hold reference.

Gunakan simulator, biaya, dan periode yang konsisten.

Bandingkan:

- Net return.
- Max drawdown.
- Exposure.
- Trade count.
- Expectancy.
- Transaction costs.

Jangan memaksakan RL sebagai solusi terbaik jika hasil evaluasinya tidak mendukung.

---

# 21. DATA SPLITTING

Gunakan chronological split.

Default:

- 70% training.
- 15% validation.
- 15% final testing.

Jangan shuffle seluruh candle secara acak.

Pastikan:

- No future leakage.
- Normalization fitted on training only.
- Validation untuk model selection.
- Final test tidak digunakan untuk tuning.
- Episode dan posisi tidak melintasi split secara tidak sah.
- Warm-up ditangani secara benar.

Gunakan purge/embargo ketika diperlukan.

Jika final test dipakai untuk optimasi, jangan lagi menganggapnya independent holdout.

---

# 22. TRAINING SYSTEM

Gunakan MaskablePPO.

Parameter:

- Network architecture.
- Learning rate.
- Total timesteps.
- Batch size.
- n_steps.
- Gamma.
- GAE lambda.
- Entropy coefficient.
- Clip range.
- Observation window.
- Episode length.
- Random seed.
- Reward parameters.

## Training Workflow

1. Validate dataset.
2. Validate configuration.
3. Validate feature schema.
4. Validate architecture.
5. Prepare chronological splits.
6. Fit preprocessing on training data.
7. Build TradingEnv.
8. Run environment checks.
9. Initialize model.
10. Train.
11. Evaluate on validation.
12. Save checkpoints.
13. Select candidate.
14. Save model artifact.
15. Save metadata.
16. Generate training report.

Gunakan evaluator yang mendukung action masking.

## Training Jobs

Dukung:

- Background execution.
- Persistent status.
- Progress reporting.
- Logs.
- Checkpoints.
- Cancellation.
- Resource limits.
- Failure reporting.

Mulai dengan smoke training sebelum full training.

---

# 23. EVALUATION SYSTEM

Metrik:

- Net profit.
- Net return.
- Maximum drawdown.
- Profit factor.
- Win rate.
- Average win.
- Average loss.
- Expectancy.
- Total trades.
- Holding duration.
- Exposure.
- Fees.
- Funding.
- Slippage costs.
- Sharpe ratio jika sesuai.
- Equity curve.
- Drawdown curve.

Tangani metrik yang tidak terdefinisi secara eksplisit.

## Walk-Forward

Gunakan rolling atau expanding evaluation windows.

Jangan menggunakan future data untuk menentukan model di periode sebelumnya.

## Multi-Seed

Jalankan beberapa seed.

Laporkan median, distribusi, dan variasi hasil.

Jangan hanya menampilkan seed terbaik.

## Sensitivity Testing

- Higher fees.
- Higher slippage.
- Higher spread.
- Different RR.
- Different risk.
- Different ATR multipliers.
- Different exit modes.
- Different features.
- Different architectures.
- Different market periods.

## Statistical Reliability

Pertimbangkan:

- Sample size.
- Confidence intervals.
- Temporal dependency.
- Multiple testing bias.
- Outlier trades.
- Market regime changes.

Jangan mengklaim model profitable hanya karena satu backtest positif.

---

# 24. MODEL REGISTRY & REPRODUCIBILITY

Simpan:

- Model ID.
- Model version.
- Dataset ID/fingerprint.
- Feature schema.
- Observation shape.
- Normalization artifact.
- Network architecture.
- Hyperparameters.
- Trading configuration.
- Risk configuration.
- Exit mode.
- Code commit.
- Dependency versions.
- Random seed.
- Training metrics.
- Validation metrics.
- Deployment history.

Experiment snapshots harus immutable.

Model baru tidak boleh otomatis menggantikan model aktif.

Inference menggunakan frozen model weights.

Tidak ada automatic online retraining pada live model tanpa desain dan persetujuan terpisah.

---

# 25. MODEL PROMOTION & DEPLOYMENT GATES

Lifecycle:

1. Candidate.
2. Validated.
3. Paper Approved.
4. Demo Approved.
5. Real Approved.
6. Retired.

Model dipromosikan berdasarkan:

- Data quality.
- No known leakage.
- Simulator validity.
- Model compatibility.
- Out-of-sample performance.
- Risk metrics.
- Sensitivity results.
- Operational readiness.
- Manual approval sesuai trading mode.

## Candidate → Validated

Minimal:

- Dataset valid.
- Model artifact dapat diload.
- Observation compatible.
- Evaluation tersedia.
- Tidak ada known critical leakage.

## Validated → Paper

Minimal:

- Inference stable.
- Risk checks tested.
- Model deployment reproducible.

## Paper → Demo

Minimal:

- Real-time features sesuai training.
- Paper execution stabil.
- Operational recovery tested.

## Demo → Real

Minimal:

- Demo order lifecycle tested.
- Reconciliation reliable.
- Protective stops verified.
- Risk engine audited.
- Operational safety healthy.
- Account ownership checked.
- Explicit user approval.

Kriteria statistik dan risiko untuk promosi harus ditetapkan sebelum evaluasi yang digunakan untuk keputusan tersebut.

Tidak ada ambang performa yang menjamin profit di masa depan.

Sistem harus bisa menolak promosi model yang belum memenuhi persyaratan.

---

# 26. STRATEGY RISK ENGINE

Risk engine independen dari AI.

Menangani:

- Risk per trade.
- Position sizing.
- Maximum leverage.
- Maximum position size.
- Maximum margin allocation.
- Maximum concurrent positions.
- Hard SL.
- Fixed TP.
- Daily loss limit.
- Maximum drawdown.
- Maximum holding duration.

Risk engine boleh menolak keputusan AI.

Catat alasan penolakan.

## Daily Loss

Definisikan:

- Basis equity/balance.
- Reset period.
- Timezone.
- Perlakuan unrealized PnL.
- Threshold behavior.

## Drawdown

Definisikan:

- Peak reference.
- Drawdown calculation.
- Trigger behavior.

Stop loss tidak menjamin risiko aktual selalu sama persis dengan risk budget akibat gap, slippage, liquidation, dan masalah eksekusi.

---

# 27. OPERATIONAL SAFETY ENGINE

Pisahkan dari Strategy Risk Engine.

Menangani:

- Stale market data.
- Internet disconnection.
- REST API timeout.
- WebSocket disconnection.
- Unknown order status.
- Duplicate order suspicion.
- Pending entry/exit.
- Position mismatch.
- Clock drift.
- Inference failure.
- Database failure.
- Service restart.
- Missing protective stop.
- Emergency stop.

Jika kondisi operasional tidak aman, blokir entry baru.

Gunakan fail-safe behavior.

Operational safety rules tidak boleh dilonggarkan oleh model AI.

---

# 28. ORDER STATE MACHINE

Pisahkan position state dari order state.

## Position States

- FLAT.
- LONG.
- SHORT.

## Operational States

Contoh:

- READY.
- PENDING_ENTRY.
- PENDING_EXIT.
- RECONCILING.
- BLOCKED.
- EMERGENCY.

Saat PENDING_ENTRY:

- Jangan mengirim entry duplikat.
- Jangan mengasumsikan posisi pasti FLAT tanpa verifikasi.

Saat PENDING_EXIT:

- Jangan mengirim exit ganda.
- Jangan menghapus protective stop secara prematur.

Saat RECONCILING:

- Blokir entry baru.
- Cocokkan exchange dan internal state.

Gunakan unique client order ID dan idempotency.

Jangan blind retry setelah timeout.

Order acknowledgement bukan bukti fill.

---

# 29. ACCOUNT OWNERSHIP

Untuk MVP, prioritaskan akun atau subaccount khusus bot jika memungkinkan.

Bot tidak boleh mengambil alih posisi manual secara diam-diam.

Saat startup:

1. Retrieve exchange positions.
2. Retrieve active orders.
3. Retrieve relevant executions.
4. Reconcile internal state.
5. Identify unknown/manual positions.
6. Validate protective orders.
7. Block new entries jika ownership atau state tidak jelas.

Jangan menganggap akun selalu kosong.

Jangan menutup posisi manual tanpa kebijakan dan persetujuan yang jelas.

---

# 30. REAL-TIME TRADING PIPELINE

Alur:

1. Receive market data.
2. Validate data freshness.
3. Confirm candle closure.
4. Calculate features.
5. Build observation.
6. Validate model compatibility.
7. Check operational state.
8. Run inference.
9. Validate action mask.
10. Retrieve/verify account state.
11. Run strategy risk checks.
12. Run operational safety checks.
13. Calculate order quantity.
14. Generate order intent.
15. Assign unique client order ID.
16. Submit through executor.
17. Confirm order status.
18. Confirm executions.
19. Verify protective stop.
20. Reconcile position.
21. Persist audit events.
22. Update dashboard.

Jangan menganggap HTTP success berarti order filled.

Jika market data atau account state tidak valid, jangan membuka posisi baru.

---

# 31. EXCHANGE ADAPTERS

Implementasikan:

- PaperTradingExecutor.
- BybitDemoExecutor.
- BybitRealExecutor.

Testnet adapter opsional.

Definisikan kontrak:

- Get balance.
- Get positions.
- Get orders.
- Get executions.
- Place entry.
- Place exit.
- Place protective stop.
- Amend protective order.
- Cancel order.
- Reconcile state.

Gunakan capability checks untuk perbedaan environment.

Jangan mengasumsikan Demo dan Real memiliki API behavior identik.

---

# 32. BYBIT DEMO TRADING

Demo harus mengirim actual API orders pada lingkungan Demo Bybit.

Wajib:

- Demo credentials.
- Demo REST client.
- Private WebSocket sesuai dukungan.
- Account connectivity.
- Balance retrieval.
- Position retrieval.
- Entry/exit execution.
- Protective SL.
- Fixed TP jika berlaku.
- Execution confirmation.
- Reconciliation.
- Emergency controls.
- Audit logs.

Gunakan dokumentasi Bybit yang berlaku pada saat implementasi.

---

# 33. BYBIT REAL TRADING

Real Trading adalah target akhir wajib.

Tetapi real-money execution harus disabled by default.

## Security

- Separate real credentials.
- Minimum permissions.
- No withdrawal permission.
- No secrets in source control.
- No credentials in logs.
- IP restrictions jika tersedia.
- Explicit environment validation.

## Activation

Sebelum aktif:

- Model approved.
- Configuration approved.
- Risk engine healthy.
- Order manager healthy.
- Reconciliation successful.
- Protective stops tested.
- Emergency controls ready.
- Account ownership validated.
- Explicit user confirmation.

Jangan otomatis mengaktifkan Real setelah restart.

Jangan otomatis berpindah dari Demo ke Real.

**Persetujuan milestone implementasi Real Trading bukan persetujuan untuk mengirim transaksi menggunakan dana asli.**

Real-money rollout membutuhkan persetujuan operasional eksplisit dan terpisah.

## Emergency Controls

Bedakan:

- Stop New Entries.
- Cancel Pending Entries.
- Disable Strategy.
- Emergency Flatten.

Jangan menghapus protective stop dari posisi aktif tanpa memastikan penggantinya atau posisi sudah tertutup.

---

# 34. DASHBOARD

Bangun bertahap.

## Overview

- Trading mode.
- Active model.
- Pair/timeframe.
- Account balance.
- Equity.
- Position.
- Realized/unrealized PnL.
- Daily PnL.
- Drawdown.
- Trading status.

## Configuration

- Market.
- Risk.
- SL/TP/RR.
- Exit mode.
- Features.
- Neural network architecture.
- Hyperparameters.
- Execution assumptions.

## Training

- Start/stop.
- Job status.
- Progress.
- Logs.
- Checkpoints.
- Model registry.

## Evaluation

- Equity curve.
- Drawdown curve.
- Trade history.
- Performance metrics.
- Baseline comparison.
- Walk-forward.
- Feature ablation.
- Architecture comparison.

## Trading

- Mode selection.
- Model selection.
- Connection health.
- Position state.
- Order state.
- Protective SL/TP.
- Risk status.
- Reconciliation status.
- Emergency controls.

Jangan menampilkan mock results sebagai data live.

Gunakan loading, error, empty, dan disconnected states.

---

# 35. HYPERPARAMETER OPTIMIZATION

Fitur lanjutan.

Gunakan Optuna jika sesuai.

Dukung:

- Architecture search.
- Learning rate search.
- Gamma search.
- n_steps search.
- Batch size search.
- Entropy coefficient search.

Jangan langsung mengoptimasi seluruh parameter.

## Controls

- Maximum trials.
- Maximum concurrent trials.
- CPU limits.
- RAM limits.
- Per-trial budget.
- Cancellation.
- Trial history.
- Failure reporting.

Gunakan validation data.

Jangan menggunakan final test untuk memilih hyperparameter.

Lakukan multi-seed evaluation pada kandidat terpilih.

Jangan menyembunyikan failed trials.

---

# 36. OBSERVABILITY, STORAGE & RECOVERY

## Logging

Sediakan:

- Structured logs.
- UTC timestamps.
- Correlation IDs.
- Market data events.
- Feature/observation validation.
- Model inference decisions.
- Risk decisions.
- Order intents.
- Order responses.
- Executions.
- Position changes.
- Model deployments.
- Emergency actions.

Jangan log secrets.

## Database

Rancang secara bertahap untuk:

- Symbols.
- Candles.
- Funding.
- Datasets.
- Configurations.
- Experiments.
- Training jobs.
- Optimization trials.
- Models.
- Evaluations.
- Orders.
- Executions.
- Positions.
- Deployments.
- Risk events.
- Audit events.

Jangan membuat seluruh tabel sebelum dibutuhkan.

## Restart Recovery

Saat restart:

1. Blokir entry baru.
2. Load persisted state.
3. Connect to exchange.
4. Retrieve positions/orders.
5. Reconcile.
6. Verify protective orders.
7. Validate model/configuration.
8. Validate market data freshness.
9. Resume hanya jika activation policy mengizinkan.

Untuk Real Trading, jangan mengaktifkan kembali operasi otomatis tanpa kebijakan yang telah disetujui.

---

# 37. TESTING STRATEGY

Gunakan:

- Unit tests.
- Integration tests.
- Contract tests.
- Regression tests.
- Deterministic simulation tests.
- End-to-end tests.
- Fault injection tests.

Prioritas:

- Candle validation.
- Feature calculations.
- Feature ordering.
- Observation shape.
- Normalization.
- Multi-timeframe alignment.
- Look-ahead prevention.
- Simulator event ordering.
- Long/short PnL.
- Fee accounting.
- Funding accounting.
- Position sizing.
- SL/TP.
- Reward integrity.
- Action masking.
- Model compatibility.
- Model save/load.
- Order idempotency.
- Partial fills.
- Timeout recovery.
- Reconciliation.
- Protective stops.
- Restart recovery.
- Emergency stop.

Gunakan deterministic fixtures.

Jangan membuat unit tests sepenuhnya bergantung pada Bybit API.

Jangan mengklaim tests berhasil jika belum dijalankan.

## Milestone Testing

Setiap milestone harus memiliki:

- Task-level tests yang relevan.
- Integration tests yang relevan.
- Milestone acceptance verification.
- Regression tests yang relevan.
- Test summary.

Jika milestone menghasilkan kemampuan end-to-end, uji alur tersebut secara menyeluruh.

---

# 38. MAINTENANCE & LONG-TERM DEVELOPMENT

Proyek harus dapat dikembangkan untuk jangka panjang.

## Code Quality

- Explicit types.
- Consistent naming.
- Modular design.
- Minimal duplication.
- Clear error handling.
- Dependency boundaries.
- Tests for critical logic.

## Dependency Management

Jika dependency perlu diperbarui:

1. Periksa release notes.
2. Identifikasi breaking changes.
3. Tentukan file terdampak.
4. Buat migration plan.
5. Jalankan regression tests.
6. Dokumentasikan hasil.

Jangan melakukan mass upgrades tanpa alasan.

## Database Migrations

Gunakan versioned migrations.

Jangan menghapus data penting tanpa persetujuan.

Sediakan backup dan rollback strategy untuk perubahan berisiko.

## Model Compatibility

Perubahan pada:

- Features.
- Normalization.
- Observation schema.
- Action space.
- Simulator behavior.
- Reward.
- Exit mode.

Dapat memengaruhi kompatibilitas atau validitas evaluasi model lama.

Versioning dan compatibility checks wajib.

## Technical Debt

Catat technical debt.

Prioritaskan berdasarkan risiko dan dampak.

Jangan melakukan refactor luas di luar milestone yang disetujui.

## Bug Fixing

Tambahkan regression tests untuk bug penting jika memungkinkan.

Jangan memperbaiki bug dengan mengubah test agar mengikuti implementasi yang salah.

## Future Extensions

Arsitektur harus memungkinkan penambahan:

- Additional pairs.
- Additional timeframes.
- Additional indicators.
- Alternative RL algorithms.
- New neural network architectures.
- Different reward functions.
- New evaluation metrics.
- Improved execution models.
- Additional monitoring.

Jangan membangun seluruh extension tersebut sebelum dibutuhkan.

---

# 39. PHASE ROADMAP

Gunakan phase untuk mengukur hasil besar proyek.

## PHASE 1 — Foundation & Market Data

Hasil:

Data Bybit dapat diambil, divalidasi, disimpan, dan digunakan.

## PHASE 2 — Simulation MVP

Hasil:

Strategi sederhana menghasilkan trade history dan accounting yang benar melalui simulator.

## PHASE 3 — RL Proof of Concept

Hasil:

MaskablePPO berhasil training, menghasilkan trading decisions, dan dapat dibandingkan dengan baseline.

## PHASE 4 — Research Platform

Hasil:

Konfigurasi dinamis, eksperimen, backtesting, model registry, evaluation, dan dashboard berfungsi.

## PHASE 5 — Real-Time & Demo Trading

Hasil:

Model dapat dijalankan pada real-time market data melalui Paper dan Bybit Demo.

## PHASE 6 — Live Trading Readiness

Hasil:

Risk engine, order lifecycle, protective orders, reconciliation, recovery, dan emergency procedures tervalidasi.

## PHASE 7 — Controlled Real Trading

Hasil:

Aplikasi memiliki kemampuan trading otomatis pada akun Bybit Real dengan activation dan safety checks.

## PHASE 8 — Continuous Improvement

Hasil:

Pengembangan berkelanjutan, eksperimen lanjutan, optimasi, dan maintenance.

Phase bukan unit persetujuan implementasi.

Milestone tetap menjadi unit utama pengerjaan.

---

# 40. DETAILED MILESTONE ROADMAP

Setiap milestone dikerjakan setelah Milestone Implementation Plan disetujui.

Seluruh task di dalam milestone boleh dikerjakan tanpa ACC tambahan selama scope tidak berubah secara material.

## MILESTONE 0 — PROJECT PLANNING

Tasks:

- 0.1 Requirement analysis.
- 0.2 MVP scope definition.
- 0.3 Technical risk assessment.
- 0.4 High-level architecture.
- 0.5 Data flow design.
- 0.6 Node.js–Python communication.
- 0.7 Trading logic ownership.
- 0.8 Simulator event ordering design.
- 0.9 Accounting/reward design.
- 0.10 Strategy risk design.
- 0.11 Operational safety design.
- 0.12 Order lifecycle design.
- 0.13 Model compatibility policy.
- 0.14 Account ownership policy.
- 0.15 Conceptual database design.
- 0.16 Folder structure.
- 0.17 Documentation structure.
- 0.18 Detailed roadmap review.

Deliverables:

- Project planning documentation.
- Architecture proposal.
- Approved MVP scope.
- Detailed milestone roadmap.
- Known risks and decisions.

Acceptance Criteria:

- Requirement ambiguities resolved or explicitly documented.
- MVP boundaries clear.
- Architecture responsibilities clear.
- Critical trading risks identified.
- Implementation dependencies identified.
- Project documentation foundation established.
- Planning reviewed and accepted.

Milestone 0 hanya planning.

Jangan membuat fitur aplikasi pada milestone ini.

## MILESTONE 1 — PROJECT FOUNDATION

Tasks:

- 1.1 Repository initialization.
- 1.2 NestJS setup.
- 1.3 TypeScript setup.
- 1.4 Linting/formatting.
- 1.5 Environment configuration.
- 1.6 PostgreSQL setup.
- 1.7 ORM setup.
- 1.8 Database migrations.
- 1.9 Health check.
- 1.10 Backend tests.
- 1.11 Python environment.
- 1.12 Python tests.
- 1.13 Local development commands.
- 1.14 Foundation integration test.

Acceptance Criteria:

- Backend dapat dijalankan.
- Python environment dapat dijalankan.
- Database connectivity berhasil.
- Health check tersedia.
- Test command berfungsi.
- Setup terdokumentasi.

## MILESTONE 2 — CONFIGURATION SYSTEM

Tasks:

- 2.1 Market config.
- 2.2 Risk config.
- 2.3 SL/TP/RR config.
- 2.4 Exit mode config.
- 2.5 Execution config.
- 2.6 Feature config.
- 2.7 Neural network config.
- 2.8 Training config.
- 2.9 Type/range validation.
- 2.10 Cross-field validation.
- 2.11 Persistence.
- 2.12 Immutable snapshots.
- 2.13 Presets.
- 2.14 Compatibility rules.
- 2.15 Configuration integration tests.

Acceptance Criteria:

- Konfigurasi dapat divalidasi.
- Konfigurasi dapat disimpan/dibaca.
- Invalid configurations ditolak.
- Experiment snapshots immutable.
- Critical configuration tests lulus.

## MILESTONE 3 — BYBIT MARKET DATA

Tasks:

- 3.1 REST client.
- 3.2 OHLCV fetch.
- 3.3 Pagination.
- 3.4 Timestamp normalization.
- 3.5 Candle validation.
- 3.6 Persistence.
- 3.7 Duplicate prevention.
- 3.8 Gap detection.
- 3.9 Incomplete candle handling.
- 3.10 Retry/backoff.
- 3.11 Resumable download.
- 3.12 Dataset metadata.
- 3.13 Data quality report.
- 3.14 Dataset fingerprint.
- 3.15 Instrument metadata.
- 3.16 Funding data.
- 3.17 Market data integration test.

Acceptance Criteria:

- Historical candles dapat dikumpulkan.
- Data tersimpan urut kronologis.
- Duplicate/gap terdeteksi.
- Dataset dapat diidentifikasi.
- Quality report tersedia.

## MILESTONE 4 — FEATURE ENGINEERING

Tasks:

- 4.1 Price returns.
- 4.2 Candle features.
- 4.3 EMA.
- 4.4 RSI.
- 4.5 MACD.
- 4.6 ATR.
- 4.7 Volatility.
- 4.8 Volume.
- 4.9 Multi-timeframe alignment.
- 4.10 Warm-up.
- 4.11 Normalization.
- 4.12 Feature schema.
- 4.13 Position features.
- 4.14 Risk context.
- 4.15 ObservationBuilder.
- 4.16 Observation validation.
- 4.17 Feature/observation tests.

Acceptance Criteria:

- Indikator menghasilkan nilai yang benar.
- Multi-timeframe bebas future leakage.
- Feature ordering stabil.
- Observation shape tervalidasi.
- Training/live feature contract tersedia.

## MILESTONE 5 — TRADING SIMULATOR

Tasks:

- 5.1 Market state.
- 5.2 Portfolio state.
- 5.3 Position state.
- 5.4 Long PnL.
- 5.5 Short PnL.
- 5.6 Entry accounting.
- 5.7 Exit accounting.
- 5.8 Fees.
- 5.9 Slippage.
- 5.10 Quantity rounding.
- 5.11 Position sizing.
- 5.12 Hard SL.
- 5.13 Fixed TP.
- 5.14 AI early exit.
- 5.15 Hybrid exit.
- 5.16 Funding.
- 5.17 Margin validation.
- 5.18 Liquidation handling or documented restrictions.
- 5.19 Equity tracking.
- 5.20 Trade history.
- 5.21 Daily loss protection.
- 5.22 Drawdown protection.
- 5.23 Episode end.
- 5.24 Deterministic runner.
- 5.25 Event ordering tests.
- 5.26 Accounting regression tests.
- 5.27 Simulator integration test.

Acceptance Criteria:

- Long/short accounting benar.
- Biaya diperhitungkan.
- SL/TP bekerja sesuai event ordering.
- Tidak ada known look-ahead bug.
- Simulator dapat dijalankan deterministik.
- Trade history dan equity konsisten.

Jika scope milestone terlalu besar, usulkan pembagian milestone sebelum implementasi dan minta persetujuan satu kali untuk struktur yang direvisi.

## MILESTONE 6 — BASELINE & SIMULATION MVP

Tasks:

- 6.1 Always HOLD.
- 6.2 Random Agent.
- 6.3 EMA crossover.
- 6.4 Buy & Hold reference.
- 6.5 Baseline evaluator.
- 6.6 Baseline comparison.
- 6.7 End-to-end baseline backtest.
- 6.8 Simulation MVP verification.

Acceptance Criteria:

- Historical data dapat diproses menjadi strategi.
- Simulator menghasilkan trades dan equity.
- Baseline metrics tersedia.
- End-to-end simulation MVP berjalan.

## MILESTONE 7 — RL ENVIRONMENT

Tasks:

- 7.1 Observation space.
- 7.2 Action space.
- 7.3 Action masks.
- 7.4 reset().
- 7.5 step().
- 7.6 Simulator integration.
- 7.7 Reward.
- 7.8 Episode termination.
- 7.9 Environment checks.
- 7.10 Deterministic tests.
- 7.11 Reward hacking tests.

Acceptance Criteria:

- Gymnasium environment valid.
- Action masking benar.
- Reward mengikuti accounting.
- Environment menggunakan simulator yang sama.
- Deterministic scenarios lulus.

## MILESTONE 8 — RL TRAINING

Tasks:

- 8.1 Chronological split.
- 8.2 Data preparation.
- 8.3 Small architecture.
- 8.4 MaskablePPO integration.
- 8.5 Smoke training.
- 8.6 Validation evaluator.
- 8.7 Checkpoint saving.
- 8.8 Model metadata.
- 8.9 Model save/load.
- 8.10 Training logs.
- 8.11 Reproducibility.
- 8.12 Background jobs.
- 8.13 Progress reporting.
- 8.14 Cancellation.
- 8.15 Resource limits.
- 8.16 RL end-to-end verification.

Acceptance Criteria:

- Model dapat dilatih.
- Model dapat disimpan/diload.
- Model dapat menghasilkan valid actions.
- Validation dapat dijalankan.
- Training dapat dipantau.
- Training tidak harus menghasilkan profit untuk dianggap berfungsi secara teknis.

## MILESTONE 9 — ADVANCED EVALUATION

Tasks:

- 9.1 Net PnL.
- 9.2 Drawdown metrics.
- 9.3 Profit factor.
- 9.4 Expectancy.
- 9.5 Trade statistics.
- 9.6 Equity curve.
- 9.7 Baseline comparison.
- 9.8 Multi-seed evaluation.
- 9.9 Walk-forward splits.
- 9.10 Walk-forward runner.
- 9.11 Fee sensitivity.
- 9.12 Slippage sensitivity.
- 9.13 RR sensitivity.
- 9.14 Exit mode comparison.
- 9.15 Feature ablation.
- 9.16 Architecture comparison.
- 9.17 Evaluation report.
- 9.18 Final holdout procedure.
- 9.19 Model promotion criteria.

Acceptance Criteria:

- Evaluasi reproducible.
- Baseline comparison tersedia.
- Out-of-sample metrics tersedia.
- Sensitivity results tercatat.
- Model dapat dinilai layak/tidak layak tanpa memaksakan hasil positif.

## MILESTONE 10 — DASHBOARD

Tasks:

- 10.1 React/Vite setup.
- 10.2 Routing.
- 10.3 Layout.
- 10.4 Navigation.
- 10.5 Overview.
- 10.6 Market configuration.
- 10.7 Feature configuration.
- 10.8 Risk configuration.
- 10.9 SL/TP/RR configuration.
- 10.10 Neural network configuration.
- 10.11 Training configuration.
- 10.12 Configuration API integration.
- 10.13 Historical data page.
- 10.14 Candlestick chart.
- 10.15 Training controls.
- 10.16 Training progress.
- 10.17 Experiment history.
- 10.18 Evaluation metrics.
- 10.19 Equity/drawdown charts.
- 10.20 Trade history.
- 10.21 Model comparison.
- 10.22 Model deployment UI.
- 10.23 Loading/error states.
- 10.24 Responsive review.
- 10.25 Dashboard integration tests.

Acceptance Criteria:

- User dapat mengonfigurasi penelitian.
- Training dapat dikontrol.
- Hasil eksperimen dapat dilihat.
- Model dapat dibandingkan.
- UI menggunakan data sebenarnya dari backend.

Jika terlalu besar, usulkan pembagian menjadi milestone dashboard yang tetap memiliki acceptance criteria end-to-end.

## MILESTONE 11 — PAPER TRADING

Tasks:

- 11.1 Public WebSocket.
- 11.2 Closed candle processing.
- 11.3 Reconnect.
- 11.4 Incremental features.
- 11.5 ObservationBuilder integration.
- 11.6 Model compatibility.
- 11.7 Inference.
- 11.8 Action validation.
- 11.9 Strategy risk checks.
- 11.10 Operational safety checks.
- 11.11 Paper execution.
- 11.12 Position persistence.
- 11.13 Recovery.
- 11.14 Audit logs.
- 11.15 Paper dashboard.
- 11.16 Stale data handling.
- 11.17 Backtest/paper comparison.
- 11.18 End-to-end tests.

Acceptance Criteria:

- Real-time inference berjalan.
- Paper positions dapat dibuka/ditutup.
- State dapat dipulihkan.
- Risk checks aktif.
- Tidak mengirim order real.

## MILESTONE 12 — EXCHANGE INTEGRATION

Tasks:

- 12.1 Exchange adapter interface.
- 12.2 Environment separation.
- 12.3 Credential isolation.
- 12.4 Authentication.
- 12.5 Balance retrieval.
- 12.6 Position retrieval.
- 12.7 Active order retrieval.
- 12.8 Capability checks.
- 12.9 Order state machine.
- 12.10 Unique order identifiers.
- 12.11 Idempotency.
- 12.12 Account ownership checks.
- 12.13 Contract tests.

Acceptance Criteria:

- Exchange environment terisolasi.
- Account state dapat dibaca.
- Order lifecycle contract tersedia.
- Duplicate order protections diuji.
- Tidak ada live order tanpa izin.

## MILESTONE 13 — BYBIT DEMO

Tasks:

- 13.1 Demo REST client.
- 13.2 Demo private WebSocket.
- 13.3 Connectivity.
- 13.4 Entry order.
- 13.5 Order confirmation.
- 13.6 Execution tracking.
- 13.7 Protective SL.
- 13.8 Fixed TP.
- 13.9 Reduce-only close.
- 13.10 AI early exit.
- 13.11 Partial fills.
- 13.12 Timeout recovery.
- 13.13 Reconciliation.
- 13.14 Restart recovery.
- 13.15 Duplicate prevention.
- 13.16 Emergency controls.
- 13.17 Demo dashboard.
- 13.18 End-to-end Demo tests.
- 13.19 Demo evaluation checkpoint.

Acceptance Criteria:

- AI dapat membuka/menutup posisi Demo.
- Order dan fills dikonfirmasi.
- Protective stop berfungsi.
- Reconciliation berjalan.
- Emergency controls tersedia.
- Tidak menggunakan dana real.

## MILESTONE 14 — LIVE TRADING SAFETY

Tasks:

- 14.1 Credential audit.
- 14.2 Strategy risk audit.
- 14.3 Operational safety audit.
- 14.4 Order manager audit.
- 14.5 Protective SL audit.
- 14.6 Reconciliation audit.
- 14.7 Restart recovery audit.
- 14.8 Preflight checks.
- 14.9 Account ownership validation.
- 14.10 Model approval workflow.
- 14.11 Trading activation controls.
- 14.12 Audit logging.
- 14.13 Operational alerts.
- 14.14 Failure injection tests.
- 14.15 Readiness report.

Acceptance Criteria:

- Critical safety tests lulus.
- Known blocking risks diselesaikan.
- Recovery behavior terdokumentasi.
- Readiness report tersedia.
- Real Trading belum otomatis aktif.

## MILESTONE 15 — BYBIT REAL TRADING

Tasks:

- 15.1 Real executor.
- 15.2 Real connectivity.
- 15.3 Balance validation.
- 15.4 Position synchronization.
- 15.5 Order lifecycle.
- 15.6 Protective SL verification.
- 15.7 Real trading readiness.
- 15.8 Explicit activation controls.
- 15.9 Real dashboard.
- 15.10 Dry-run without real orders.
- 15.11 Controlled real-money rollout only after separate explicit approval.
- 15.12 Monitoring.
- 15.13 Incident handling.
- 15.14 Paper/Demo/Real comparison.

Acceptance Criteria:

- Real executor telah terimplementasi dan diuji.
- Credentials dan environment tervalidasi.
- Risk/safety system berfungsi.
- Real order lifecycle siap.
- Dry-run berhasil.
- Real-money rollout tetap memerlukan persetujuan terpisah.

Jika hasil evaluasi model atau kesiapan operasional belum memadai, real-money rollout tidak boleh dilakukan walaupun fitur teknis sudah selesai.

## MILESTONE 16 — CONTINUOUS IMPROVEMENT

Backlog jangka panjang:

- 16.1 Additional neural network presets.
- 16.2 Custom architectures.
- 16.3 Architecture comparison improvements.
- 16.4 Optuna integration.
- 16.5 Hyperparameter search spaces.
- 16.6 Trial runner.
- 16.7 Trial validation.
- 16.8 Optimization history.
- 16.9 Resource limits.
- 16.10 Multi-seed shortlist.
- 16.11 Optimization dashboard.
- 16.12 Alternative RL algorithms.
- 16.13 Additional pairs.
- 16.14 Additional timeframes.
- 16.15 Improved market data granularity.
- 16.16 Execution model improvements.
- 16.17 Performance improvements.
- 16.18 Reliability improvements.

Milestone 16 merupakan backlog berkelanjutan.

Jangan menjalankan semua pekerjaan sekaligus.

Bagi menjadi milestone baru dengan scope dan approval terpisah sesuai kebutuhan.

---

# 41. MILESTONE IMPLEMENTATION PLAN FORMAT

Sebelum implementasi milestone, berikan:

## Milestone

ID dan nama.

## Current Project State

Ringkasan kondisi repository dan progress.

## Objectives

Hasil yang ingin dicapai.

## Scope

Fitur dan komponen yang akan dikerjakan.

## Out of Scope

Hal yang tidak akan dikerjakan.

## Dependencies

Dependency dari milestone sebelumnya.

## Proposed Architecture

Perubahan desain jika ada.

## Task Breakdown

Daftar task dan urutan pengerjaan.

## Files Expected

File yang diperkirakan dibuat atau diubah.

## Database Changes

Migration yang dibutuhkan.

## Tests

Unit, integration, contract, dan regression tests yang direncanakan.

## Acceptance Criteria

Kriteria penyelesaian milestone.

## Risks & Tradeoffs

Masalah yang mungkin muncul.

## Approval Status

**Waiting for Milestone Approval.**

Jangan mengimplementasikan sebelum milestone disetujui.

---

# 42. MILESTONE IMPLEMENTATION REPORT FORMAT

Setelah seluruh task selesai atau milestone terblokir, laporkan:

## Milestone

ID dan nama.

## Final Status

- Completed.
- Partially Completed.
- Blocked.
- Failed Verification.

## Implemented Features

Ringkasan hasil.

## Completed Tasks

Daftar task yang selesai.

## Remaining Tasks

Jika ada.

## Files Created/Modified

File terdampak.

## How It Works

Penjelasan alur utama.

## Tests Executed

Daftar pengujian dan hasil aktual.

## Acceptance Criteria Verification

Status setiap acceptance criterion.

## Known Issues

Masalah yang tersisa.

## Technical Debt

Jika ada.

## Documentation Updated

File dokumentasi yang diperbarui.

## Handoff File

Lokasi ringkasan milestone.

## Next Milestone

Milestone berikutnya, hanya sebagai informasi.

## Status

**Waiting for Next Milestone Instruction.**

Jangan melanjutkan milestone berikutnya tanpa instruksi saya.

---

# 43. MILESTONE DEFINITION OF DONE

Milestone dianggap selesai jika:

1. Seluruh task wajib dalam approved scope selesai.
2. Acceptance criteria terpenuhi.
3. Unit tests relevan dijalankan.
4. Integration tests relevan dijalankan.
5. Regression tests relevan dijalankan.
6. Critical bugs yang menghalangi acceptance criteria diselesaikan.
7. Dokumentasi diperbarui.
8. Progress diperbarui.
9. Handoff dibuat.
10. Hasil dilaporkan secara transparan.

Jika suatu task belum selesai, jangan menandai milestone Completed kecuali scope diubah secara eksplisit dan disetujui.

Jangan menganggap test berhasil jika tidak dijalankan.

Jangan menganggap API order berhasil hanya karena request diterima.

Untuk milestone Demo/Real, verifikasi order lifecycle, executions, positions, dan protective orders wajib dilakukan sesuai scope.

---

# 44. FINAL ENGINEERING PRINCIPLES

1. Satu milestone per siklus persetujuan.
2. Satu milestone boleh berisi banyak task.
3. Task dalam milestone yang disetujui tidak membutuhkan ACC terpisah.
4. Perubahan besar di luar scope membutuhkan ACC tambahan.
5. Jangan otomatis melanjutkan milestone berikutnya.
6. Gunakan satu chat window per milestone jika memungkinkan.
7. Repository dan dokumentasi adalah sumber kebenaran.
8. Dokumentasi wajib diperbarui pada akhir milestone.
9. Milestone handoff wajib dibuat.
10. Jangan mengulang pekerjaan yang sudah selesai tanpa alasan.
11. Correctness lebih penting daripada banyak fitur.
12. Simulator harus divalidasi sebelum training RL.
13. Event ordering harus eksplisit.
14. Accounting dan reward harus konsisten.
15. Hindari look-ahead bias dan future leakage.
16. Hindari reward hacking dan overfitting.
17. Semua fitur aktif harus masuk observation sesuai schema.
18. Feature ordering dan normalization harus konsisten.
19. Model architecture dan konfigurasi harus versioned.
20. Model live tidak otomatis berubah.
21. Risk engine independen dari AI.
22. Operational safety independen dari strategy logic.
23. Order acknowledged bukan berarti filled.
24. Jangan blind retry order.
25. Jangan mengambil alih posisi manual tanpa kebijakan jelas.
26. Demo dan Real memiliki lingkungan serta credentials terpisah.
27. Real Trading disabled by default.
28. Real-money execution memerlukan persetujuan operasional khusus.
29. Hasil evaluasi buruk harus dilaporkan, bukan disembunyikan.
30. Jangan memaksakan model RL jika tidak lebih baik dari baseline.
31. Gunakan regression tests untuk mencegah bug berulang.
32. Gunakan migrations untuk perubahan database.
33. Hindari overengineering.
34. Pertahankan backward compatibility jika memungkinkan.
35. Dokumentasikan keputusan teknis penting.
36. Prioritaskan sistem yang maintainable dan extensible.
37. Jangan mengklaim model profitable tanpa bukti.
38. Jaga agar proyek bisa dikembangkan selama bertahun-tahun tanpa harus ditulis ulang dari awal.

---

# 45. INITIAL INSTRUCTION

Mulai dari:

**Milestone 0 — Project Planning.**

Pada respons pertama:

1. Pahami keseluruhan spesifikasi proyek.
2. Jelaskan target akhir aplikasi.
3. Identifikasi risiko dan requirement yang belum jelas.
4. Susun rencana pengerjaan untuk seluruh Milestone 0.
5. Identifikasi dokumen yang akan dibuat.
6. Tentukan acceptance criteria Milestone 0.
7. Jelaskan tradeoff penting.
8. Berikan rekomendasi teknis.
9. Tampilkan Milestone Implementation Plan.
10. Tunggu persetujuan saya.

**Jangan langsung membuat kode atau mengimplementasikan milestone.**

Setelah saya menyetujui Milestone 0:

- Kerjakan seluruh task Milestone 0 yang telah disetujui.
- Buat dokumentasi planning yang diperlukan.
- Perbarui roadmap dan progress.
- Catat keputusan penting.
- Buat milestone handoff.
- Laporkan hasil akhir.
- Berhenti.

Jangan meminta persetujuan ulang untuk setiap task Milestone 0.

Jangan otomatis melanjutkan Milestone 1.

Milestone berikutnya hanya boleh dimulai setelah saya memberikan instruksi.

**Tujuan utama adalah membangun aplikasi AI trading yang benar, aman, modular, dapat diuji, dan dapat terus dikembangkan dalam jangka panjang.**
