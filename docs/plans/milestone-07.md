# Milestone 7 — RL Environment

Tanggal:7 November2026, Asia/Jakarta. Approved melalui instruksi
`lanjutkan eksekusi M7`. Scope task7.1–7.11; tidak mencakup training M8,
model promotion, download baru atau exchange orders.

## Goal dan implementation plan

1. Refactor streaming runner menjadi reusable incremental DatasetSession pada
   simulator M5 yang sama. Historical baseline/script/artifact outputs wajib
   tetap equivalent. M4 indicators/normalizer/ObservationBuilder tetap tunggal.
2. Gymnasium1.2.1 dan NumPy2.3.4 dipin bersama pada Python3.12 Windows x64,
   dependencies/transitives dikunci dengan uv. Tidak memasang Torch/SB3 atau
   training sekarang; compatibility stack M8 tetap diverifikasi pada M8.
3. Observation Box float32 dimension/schema M4, Discrete(5), action_masks bool
   true=valid. Unavailable observation memakai zero sentinel + info explicit;
   hanya HOLD tersedia, protective/forced exits tetap memproses setiap bar.
4. Mask pada current information: state/exit mode, observation/risk/cooldown,
   forced/pending intents, final eligible execution interval, ATR dan sizing
   preview dari known closed reference. Tidak membaca next open; execution
   tetap revalidasi karena gap/funding dapat mengubah kelayakan.
5. reset(seed) membangun portfolio/risk/indicator/window baru, fixed explicit
   split/range dan frozen normalizer; prehistory hanya warm-up. Tidak shuffle,
   refit atau carry posisi/PnL. step mengeksekusi current action pada next
   eligible open, advances satu main bar, returns fresh observation/info.
6. Reward v1=(equity_next−equity_previous)/initial_capital, Decimal128 sebelum
   float boundary, tanpa penalty/bonus/clipping. Fee/funding/unrealized dan
   terminal settlement masuk sekali. Sum rewards direkonsiliasi net return.
7. Risk/bankruptcy/invalid-envelope -> terminated; range end -> truncated.
   Natural boundary disettle M5 sekali pada last close. Karena independent
   settled episodes tidak punya continuation state lintas split, info membawa
   bootstrap_discount0/explicit no-bootstrap. Wrapper untuk learners menandai
   settled truncation sekaligus terminated agar library standard tidak bootstrap
   value reset. Raw Gym flags/reason tetap tersedia dan diuji.
8. Strict shared environment request/info/reward policy contracts, offline smoke
   CLI dan verification task. No migrations/config v1 changes. Environment
   checks memakai Gymnasium check_env, tanpa dependency SB3 di M7.
9. Unit/integration tests: spaces/masks setiap state/mode/gates, seed/reset/no
   carry, step lifecycle, replay equality M5, future/availability boundaries,
   funding/fees/forced exits/negative equity, terminal settlement once, reward
   telescoping, overtrading/losing HOLD/no free reset gains, bootstrap wrapper.
10. Full regression M1–M6 + bounded local public-export masked-random/HOLD smoke,
    deterministic replay/provenance/report; update guide/ADR/progress/roadmap/
    testing/operations/README/handoff, berhenti sebelum M8.

## Acceptance dan batas

Gymnasium API/checker valid, masks benar dan HOLD selalu tersedia, simulator
tunggal, reward/accounting konsisten, deterministic/reward integrity tests lulus.
Unsupported/envelope invalid tidak menjadi successful training sample; diagnostic
episode diberi invalid status. M8 wajib reject invalid rollouts dan memakai
settlement bootstrap adapter. Training/performance bukan acceptance M7.
Restricted market/last/1x/50%, declared funding schedule/current metadata/proxy,
artificial terminal settlement dan full-year throughput limitations tetap berlaku.

## Sources dan risks

Official [Gymnasium Env](https://gymnasium.farama.org/api/env/),
[time limits](https://gymnasium.farama.org/tutorials/gymnasium_basics/handling_time_limits/),
[Gymnasium1.2.1](https://pypi.org/project/gymnasium/1.2.1/) dan
[NumPy2.3.4](https://pypi.org/project/numpy/2.3.4/) diperiksa7 November2026.
Versi dipilih sebagai explicit reproducible compatibility baseline, bukan klaim
latest; actual Windows wheels/checker/tests harus lulus. Refactor session harus
mempertahankan golden M5/M6 ledger equivalence; lockfile/code fingerprint berubah
sehingga content IDs baru diharapkan walau behavior ledger sama.
