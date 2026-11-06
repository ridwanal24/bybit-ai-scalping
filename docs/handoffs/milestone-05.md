# Milestone 5 — Trading Simulator

Tanggal:6 November2026, Asia/Jakarta. Approved melalui `kerjakan` setelah
[implementation plan M5](../plans/milestone-05.md) disajikan.

## Final Status

**Completed**. Seluruh task5.1–5.27 dan acceptance criteria dalam restricted
research scope selesai diverifikasi. Tidak ada blocker M5 atau approval M6.

## Implemented Features dan How It Works

Satu historical Python simulator menggabungkan verified export M3, frozen M4
features/normalizer/ObservationBuilder, state market/portfolio/position/intent,
Decimal128 ledger dan deterministic execution/risk/funding engine. Context model
berasal dari ledger saat keputusan; bukan synthetic FLAT file.

Keputusan closed-candle menghasilkan intent untuk next eligible open. Funding
posisi lama mendahului gap protections/close/entry; gap SL lalu capped TP,
intrabar SL-first bila double touch. ATR entry dibekukan sebelum execution bar.
Fee entry/exit, realization, funding dan margin direkonsiliasi tanpa double count.
Daily loss/drawdown latches, holding/cooldown dan terminal settlement tersedia.

Scope supported: market/last-price/1x, satu posisi, entry exposure/margin<=50%
equity, explicit current-metadata/schedule acknowledgements. Full liquidation
tidak dimodelkan; adverse collateral breach menghasilkan diagnostic invalid
artifact tanpa fake close. Intrabar funding/unsupported config ditolak.

## Completed Tasks

| Task | Deliverable / evidence |
| --- | --- |
| 5.1 Market state | UTC main bars, closed availability dan chronological execution phases |
| 5.2 Portfolio | Exact wallet/equity/collateral/cumulative ledger |
| 5.3 Position | Single FLAT/LONG/SHORT + frozen intent/ATR/SL/TP/ownership ID |
| 5.4 Long PnL | Independent profit/loss examples dan engine fills |
| 5.5 Short PnL | Independent profit/loss examples, adverse short costs |
| 5.6 Entry accounting | One entry fee, attached protection, no fee on rejected fill |
| 5.7 Exit accounting | Full-close realized/unrealized conversion once, no duplicate close |
| 5.8 Fees | Configured taker, adverse currency rounding; no maker fill claim |
| 5.9 Slippage | Adverse spread/slip in price, not charged as another fee |
| 5.10 Quantity rounding | Step floor/bounded binary search, tick direction and currency edge tests |
| 5.11 Sizing | Budget incl stop costs, min/max qty/notional, margin/exposure caps |
| 5.12 Hard SL | Frozen ATR, rounded/revalidated stop, gap/intrabar protection |
| 5.13 Fixed TP | RR target, capped gap price, conservative SL-first double touch |
| 5.14 AI exit | Matching directional close, no implicit TP even with nonnull RR field |
| 5.15 Hybrid | Protection + discretionary early exit + forced exit precedence |
| 5.16 Funding | Signed boundary cashflows, declared historical coverage/fixed schedule, no zero-fill |
| 5.17 Margin | Initial collateral, free margin/reserve, entry rejection and ongoing envelope |
| 5.18 Liquidation restriction | Approved1x/50% research envelope, bankruptcy/invalid diagnostics, no fake liquidation |
| 5.19 Equity | Streaming valuation/events and independent reload reconciliation |
| 5.20 Trade history | Entry/exit, fee/funding/PnL, target/gross/net RR, deterministic IDs |
| 5.21 Daily loss | Equity basis, UTC anchor before funding, latching and controlled close |
| 5.22 Drawdown | Sampled run high-water, latch survives UTC rollover, controlled termination |
| 5.23 Episode end | No final-interval entry/cross-split position, cancel pending/settle once |
| 5.24 Runner | Scripted CLI/internal callback, M4 integration, immutable artifacts/replay |
| 5.25 Event tests | Boundary ties, gaps, mode/delay/prefix/future mutation/no retroactive fill |
| 5.26 Accounting tests | Hand calculations, exact ledger/trade/equity sums, currency/quantity guards |
| 5.27 Integration | Fixture LONG+SHORT E2E, CLI valid/invalid, source/artifact verification and public-export smoke |

## Files Created/Modified

- `packages/contracts/src/simulation.ts`, index/export pipeline;8 generated JSON
  schemas, accounting/UTC risk fixtures dan TypeScript contract tests.
- `services/quant/src/bybit_quant/simulation/`: numeric/state/ledger/execution/risk,
  policy/funding gates, engine/runner, streaming artifacts/independent verifier, CLI.
- Dataset verified instrument/funding/file-recheck helpers dan quant CLI dispatch;
  root `simulation:run`, `verify:simulation` commands/report. Tidak ada dependency,
  config schema v1 atau migration baru.
- Quant simulation fixtures/accounting/event/funding/integration tests dan
  `tests/smoke_simulation.py`. README, architecture/configuration/operations,
  planning/ADR13, roadmap/progress/testing, plan M5 dan simulation guide.

## Tests Executed

Final `.tools/node/npm.cmd run verify:simulation` exit0 PASSED,
6 November2026 20:53:03–20:55:05 WIB. Report `.runtime/simulation-report.json`
UTC13:53:03.020–13:55:05.696.

- **384 tests tanpa skip**:84 TypeScript contracts +33 backend unit +236 Python
  +31 PostgreSQL/HTTP integration. Semua M1–M4/audit regressions tetap lulus.
- Build/typecheck/ESLint/Ruff/Prettier, schema export drift, fresh/reapply/M1+M2
  migration upgrades, legacy data preservation dan zero Prisma schema diff lulus.
- Synthetic export fixture E2E menghasilkan actual virtual LONG dan SHORT,
  deterministic replay/reload, callback current position context, invalid-envelope
  diagnostic dan CLI exit2; unsupported request exit1 tersanitasi.
- Valid segmented policy1000 intervals menghasilkan report>64KiB dan lolos reload
  setelah parser JSON documents dipisahkan dari per-record JSONL bound. Regression
  awal mereproduksi error, final case lulus. Descriptor/report limit2MiB.

Tidak ada test DB timeout pada final M5 verification. Test clusters dihentikan;
portable/cache/socket context memakai pola M1–M4. Credential/.env tidak diubah.

## Bounded Public-Export Smoke

Existing BTCUSDT dataset M3 `3717d128-5be2-433f-90dc-ac21d3c35b54`,
fingerprint `229a793c410fde2a0eb118cc9fdfc8ee2e773ef225097037f47579e9999e26fa`.
Tidak ada download baru. Frozen normalizer
`e9313eebe60972c72d972987e279757bfd3016b8faca0c3652db06c7a39bcfd9`.

CLI smoke+replay+reload selesai20:56:34 WIB,14.285s. Root npm command juga exit0
dan mengembalikan ID identik. Episode `[2025-01-01 04:00,2025-01-02 00:00)` UTC,
declared8h funding schedule/current instrument/last-open proxy, preset M2 asli,
script waktu/sisi yang ditetapkan sebelum membaca outcomes.

| Evidence | Hasil |
| --- | --- |
| Status | completed_restricted / episode_end / truncated |
| Artifact ID | 4e2ac0e1d0dd2e7bff0f63b6b2ecc6454bf1ef20e0cb2b3d10abac6e2b3f3fa8 |
| Code fingerprint | 2eaee6156dbf3be21c6c6c3cf0f8b696bcab4bf7113a1edfd27f3b3b87940e3f |
| Events / equity rows | 2430 /2401 |
| Observations | 1184 valid,16 warm-up unavailable |
| Trades | 1 SHORT,qty0.005,hard_sl |
| Entry / exit | 94512.4 /94696.5 |
| Gross / fees / funding | −0.9205 /0.9460445 /0 USDT |
| Net equity change | −1.8665445 USDT |
| Final wallet/equity | 998.1334555 USDT, FLAT |
| Rejections | 7 stop_distance_outside_limits,8 position_close_mismatch |

Hasil loss tidak diubah menjadi profit melalui tuning assumptions/script.
Public smoke hanya1 trade; kebutuhan LONG+SHORT dibuktikan fixture E2E, bukan
diklaim dari public smoke ini. Tiga actual source funding records divalidasi
terhadap deklarasi schedule, tetapi tidak ada posisi terekspos pada settlement
episode; signed funding accounting diuji pada deterministic fixtures.

Artifact file SHA256:

- events: `d6a04808e35e02e3cc635bef513db947d67688dc766b33a30d80323d17af0d83`
- trades: `7b8db9f13d384932b1821e5cf135b10862f3d42f78771fe5020823af86d11247`
- equity: `774c97abd9f8b382ada5eaed9cb7c6df6f70837a21dd078082c56cff1939c66a`
- report: `a4a54b06711629d775bb182dd5ffb2dc5cf5340e1b9d1c9d12869933298b3b3a`
- descriptor: `6f2039fcaacfbd156a0c752705257b25ac8ef5b11d76ae9990d8a571c219ec57`

Evidence ignored: `.runtime/verify-simulation-final.log`, `simulation-report.json`,
`simulation-smoke.json`, `simulation-root-cli.log`, `artifacts/simulations/<id>/`.

## Acceptance Criteria Verification

Semua acceptance spec M5 terpenuhi dalam approved restricted scope: LONG/SHORT
accounting, net costs, conservative SL/TP ordering, tested no-future boundaries,
deterministic runner dan consistent history/equity. Normalizer tidak refit;
observation invalid memblokir entry, protection tetap berjalan. Unsupported
liquidation/funding/reference requests bukan silent fallback atau valid result.

## Remaining Tasks

Tidak ada task wajib M5 tersisa. M6 memerlukan plan/approval baru.

## Known Issues dan Technical Debt

- Research restrictions market/last/1x/50%, declared funding schedule/last-open
  proxy dan current metadata tidak setara exchange history atau live readiness.
- Full fills, bar timing dan SL-first adalah assumptions; liquidation tiers,
  order book/partial fills/limit execution tidak dimodelkan. Intrabar funding ditolak.
- High-water/risk monitoring sampled open/funding/fill/close, bukan tick-by-tick.
  Terminal settlement artificial/dilabeli; gap/funding dapat melebihi stop budget.
- Exact ledger menerima float64 ATR M4; version/rounding dibekukan, tetapi tidak
  mengklaim bitwise portability lintas runtime/platform atau full-year throughput.
- Local immutable artifacts membutuhkan repository layout; hash bukan signature.
  Job registry/resume, backup/purge/standalone worker dan live risk conformance
  tetap milestone terkait. Retained stopped test clusters memakai disk.
- Baseline efficacy/reward/model/evaluation belum dibuat; public smoke loss dan
  single trade tidak menjadi alasan mengubah target teknis atau mempromosikan model.

## Documentation Updated dan How to Run

README; architecture/configuration/operations; planning dan decisions ADR13;
testing/progress/roadmap; plan M5, [simulation guide](../simulation.md) dan handoff ini
`docs/handoffs/milestone-05.md`.

```powershell
.\.tools\node\npm.cmd run verify:simulation
.\services\quant\.venv\Scripts\python.exe services/quant/tests/smoke_simulation.py
.\.tools\node\npm.cmd run simulation:run -- --request .runtime/simulation-smoke/request.json
```

Request/script format, path semantics, exit codes, restrictions dan artifact
verification ada pada guide. Tidak memerlukan Bybit/API credentials atau DB running.

## Next Milestone dan Status

M6 — Baseline & Simulation MVP, informasi saja. Baca spec/progress/roadmap/handoff
ini dan periksa Git sebelum menyusun plan. Reuse engine/normalizer/risk/funding
policies yang sama untuk HOLD/random/EMA/Buy & Hold reference; exposure/cost
differences harus eksplisit, bukan simulator baru atau optimistic reference.
Approval M5 tidak mengizinkan M6/training/orders otomatis.

**Waiting for Next Milestone Instruction.**
