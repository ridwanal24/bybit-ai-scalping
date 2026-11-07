# RL Environment M7

`bybit_quant.rl.TradingEnv` implements Gymnasium reset/step/spaces/action_masks
di atas incremental `simulation.DatasetSession`. Session yang sama dipakai
runner script, M6 baseline dan artifact publisher M5. Tidak ada simulator,
accounting, indicator atau order execution kedua. M7 tidak melatih model.

## Setup dan menjalankan

Gymnasium1.2.1 dan NumPy2.3.4 dipin bersama pada Python3.12.12, dengan
cloudpickle/farama-notifications dan wheels/hashes dalam `services/quant/uv.lock`.
Versi ini adalah compatibility baseline yang diuji, bukan klaim latest. Torch,
SB3 dan sb3-contrib belum dipasang; stack MaskablePPO tetap scope M8.

```powershell
.\.tools\uv\uv.exe sync --project services/quant --locked --cache-dir .tools/uv-cache
.\.tools\node\npm.cmd run verify:environment
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_environment.py
.\.tools\node\npm.cmd run environment:run -- --request .runtime/environment-smoke/masked_random.json
```

Smoke helper menggunakan existing public export/normalizer M3/M4 dengan preset
asli, seed42, HOLD dan masked-random, episode20h dan1200 steps. Setiap agent
direplay dua kali dan direkonsiliasi ke artifact M5; tidak download/refit/tuning.
Request helper dibuat sebelum root CLI example; absence source adalah error.

`rl-request-v1` memakai seluruh field simulation request kecuali `actions_file`,
ditambah `seed` integer0–4294967295 dan `agent`=`hold` atau `masked_random`.
Source snapshot boleh null sesuai M5; file paths relatif terhadap request.
Dataset UUID, frozen normalizer SHA, episode start/end dan seluruh explicit
restricted policy acknowledgements tetap wajib. Output relatif repository root.

Python integration:

```python
from bybit_quant.rl import TradingEnv, SettledEpisodeWrapper

raw = TradingEnv(dataset, configuration, normalizer, policy, split_start, split_end)
env = SettledEpisodeWrapper(raw)  # Learning adapter, belum menjalankan training.
observation, info = env.reset(seed=42)
mask = env.action_masks()  # np.bool_, true berarti valid.
observation, reward, terminated, truncated, info = env.step(0)
env.close()
```

## Observation, action dan masks

Observation adalah fresh float32 vector dengan ordered schema/dimension M4
`window*market_features+position+risk`; Box bounds memakai seluruh finite float32
range. Tidak clipping/menambahkan fitur/remaining-time tanpa schema change.
Normalizer frozen dan data availability/HTF/warm-up checks tetap M4.
Saat observation unavailable, vector adalah zero sentinel, info
`observation_valid=false` dan reason eksplisit, mask hanya HOLD. Ini bukan
valid market observation palsu; protective/forced exits tetap berjalan.

Action IDs tetap0 HOLD,1 OPEN_LONG,2 OPEN_SHORT,3 CLOSE_LONG,4 CLOSE_SHORT.
HOLD selalu valid. FLAT mengizinkan entry bila semua current gates lolos;
LONG/SHORT hanya matching close pada AI_EXIT/HYBRID. FIXED_RR tidak menerima
discretionary close. Pending/forced intents menahan aksi baru; risk latch,
cooldown, final eligible interval dan insufficient ATR/sizing memblokir entry.
Preview sizing memakai known closed reference/frozen ATR/equity/instrument rules,
tanpa next-open candle. Side feasibility bisa berbeda. Mask tidak memutasi ledger.

Fill masa depan tetap revalidate. Intent yang masked-valid dapat rejected setelah
gap/funding/rounding; `action_accepted=true` berarti submission accepted, bukan
filled. Exposure/fees/rejection tetap dari ledger M5. NumPy integer action diterima;
malformed/out-of-space action menimbulkan ValueError tanpa advance atau biaya.
In-space masked action dicatat sebagai rejected/no-op lalu satu bar tetap maju;
tidak ada reward penalty tambahan. Fee akibat protective exit adalah biaya market,
bukan biaya invalid action.

## Timeline, reset dan lifecycle

reset(seed) membangun simulator, wallet/position/risk/intent, indicator/window dan
reader baru; super.reset menginisialisasi local NumPy RNG. Seed juga men-seed
action_space. Fixed split/range tidak diacak, normalizer tidak refit dan tidak
membawa posisi/PnL dari prehistory/episode sebelumnya. Candle prehistory hanya
warm-up. First decision pada/selewat start, tidak di luar explicit range.

step submits current action, mengeksekusi next eligible open/latency, funding,
protections/risk dan close satu main bar, lalu mengembalikan observation/info
baru. No hidden skip atas unavailable decisions. Posisi/equity context selalu
current ledger, bukan previous observation cache. Semua protections aktif ketika
agent HOLD atau invalid. Step sebelum reset/setelah done/close ditolak.
close berulang aman dan menutup readers; tidak membuka network/DB.

Manual early reset/close membuang unfinished research episode, tidak menghasilkan
completed report/valid evaluation. Agent tidak punya reset action. Evaluation CLI
mewajibkan episode sampai boundary. options selain None/{} ditolak; ubah range
melalui constructor dengan explicit split end. Generic TimeLimit di tengah posisi
tidak menggantikan settlement; gunakan explicit end yang diproses simulator.

## Reward dan terminal semantics

`net_equity_initial_v1`: `reward=(E_next−E_previous)/E_initial`, initial>0.
Decimal128 ledger menghitung delta/ratio sebelum float API boundary. Tidak ada
log reward, clipping, penalty, profit-only accounting atau compounded denominator.
Fee entry/exit, funding, unrealized/realized conversion dan terminal settlement
masuk equity sekali. Cumulative reward berasal dari net equity/initial; summed
float rewards diuji dengan tolerance1e-12. Losing HOLD tetap memberi negative
mark-to-market reward; round-trips tanpa price edge membayar costs.

Raw environment: risk termination, bankruptcy dan unsupported-envelope diagnostics
menghasilkan terminated=true; explicit range/data end menghasilkan truncated=true.
M5 terminal settlement memakai last close + adverse exit cost, hanya sekali;
terminal observation dibangun dengan **post-settlement FLAT** context. Nonpositive
equity tidak dipotong nol atau dipaksa menjadi valid context; terminal sentinel
finite dan diagnostic reason/report tetap mencatat actual negative equity.

Setiap completed/terminated independent episode memiliki `bootstrap_discount=0`.
Data boundary adalah truncation, tetapi settlement memutus continuation/portfolio
lintas split. `SettledEpisodeWrapper` mempertahankan truncated=true sambil membuat
terminated=true untuk absorbing learning boundary. Info raw_terminated/raw_truncated
tetap mengungkap penyebab asli; learning_terminal=true. Standard target
`r+gamma*(1−terminated)*V(next)` tidak menambahkan value reset. M8 wajib memakai
wrapper/ekuivalen bootstrap0 dan menolak invalid rollouts; raw Gym truncation tanpa
adapter tidak cukup untuk independent settled-episode training.

## Info, artifacts dan verification

`rl-info-v1` memberi schema/normalizer IDs, observation validity/reason, masks,
action acceptance, exact equity/reward/cumulative strings, timestamp/step count,
simulator status/reason, bootstrap/raw flags dan final report nullable.
`action_masks()` dan observations selalu fresh arrays agar caller tidak mengubah
state; info/report juga fresh. Reward float hanya API boundary.

`artifacts/environments/<id>/` berisi episode.json, actions.jsonl,
transitions.jsonl dan checksum manifest. Summary mengikat seed/agent, code/lock/
dataset/config/normalizer/schema/runtime versions dan linked M5 simulation ID.
Trace mengikat chosen masks/action, observation hashes, time, equity dan reward.
Episode ID dari checksum manifest; publish atomic sesudah financial replay/reload.
Existing ID diverifikasi, tidak overwrite. Archive harus membawa linked simulations.

`verify_episode(directory, simulations_root)` mengecek hashes/schemas/provenance,
action trace order/validity, raw boundary flags/report dan setiap step equity/reward
terhadap simulator equity ledger (terminal step memakai final settlement equity).
Sum reward harus sama net return. Forged reward ditolak walau outer hashes dihitung
ulang. Hash bukan signature; reload bukan ulang feature computation tanpa source.

Python CLI exit0=valid restricted episode, exit2=invalid diagnostic tetap tersimpan,
exit1=sanitized incompatible input/artifact. Root npm wrapper meneruskan keberhasilan
atau kegagalan proses. Invalid status bukan usable successful training sample.
Default env sink hanya menyimpan counts; MemorySink hanya explicit bounded tests.
JSONL streaming; full-year throughput/training resource budget belum dibuktikan.

## Sources dan limitations

API/seed/fresh-return contract: [Gymnasium Env](https://gymnasium.farama.org/api/env/).
Terminated/truncated dan bootstrap distinction:
[official time-limit guide](https://gymnasium.farama.org/tutorials/gymnasium_basics/handling_time_limits/).
Release provenance: [Gymnasium1.2.1](https://pypi.org/project/gymnasium/1.2.1/),
[NumPy2.3.4](https://pypi.org/project/numpy/2.3.4/). Diperiksa7 November2026;
Windows compatibility dibuktikan actual checker/regression, bukan diasumsikan.

Restricted market/last/1x/50%, declared funding schedule/last-open proxy/current
metadata, OHLC ambiguities, full-fill assumptions dan artificial settlement M5
tetap berlaku. M7 bukan model training, profit evidence, exchange liquidation
realism, OOS validation atau approval trading. M8 memerlukan scope/instruksi baru.
