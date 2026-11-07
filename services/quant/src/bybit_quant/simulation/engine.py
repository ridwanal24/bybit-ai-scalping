"""Deterministic restricted OHLC event engine, independent of agent implementation."""

import math
from collections import Counter
from copy import deepcopy

from bybit_quant.contracts import INTERVALS, validate
from bybit_quant.simulation.execution import Execution
from bybit_quant.simulation.ledger import Journal, Ledger
from bybit_quant.simulation.numeric import ZERO, D, decimal, exact, wire
from bybit_quant.simulation.policy import capabilities
from bybit_quant.simulation.risk import RiskState
from bybit_quant.simulation.state import Intent, MarketState, MemorySink, side_name


class Simulator:
    @exact
    def __init__(self, config, instrument, policy, start, end, sink=None):
        self.c = capabilities(config, instrument, policy, start, end)
        self.policy, self.start, self.end = deepcopy(policy), start, end
        self.interval = INTERVALS[self.c["market"]["timeframe"]]
        self.sink = sink if sink is not None else MemorySink()
        self.journal = Journal(self.sink)
        self.journal.time_ms = start
        self.ledger = Ledger(
            self.c["risk"]["initial_capital"], self.c["execution"]["taker_fee_rate"], self.journal
        )
        self.reserve = decimal(policy["safety_reserve"])
        self.execution = Execution(self.c, deepcopy(instrument), self.reserve)
        self.risk = RiskState(self.c["risk"])
        self.market = MarketState(start, D(1))
        self.pending = None
        self.forced = None
        self.last_exit = None
        self.last_decision = None
        self.decision_time = start
        self.intent_count = 0
        self.status, self.reason, self.termination = "running", "episode_end", "truncated"
        self.rejections = Counter()
        self.valid_observations = 0
        self.unavailable = Counter()
        self.open_active = False

    def _at(self, time_ms, phase, price=None):
        self.journal.time_ms, self.journal.phase = time_ms, phase
        if price is not None:
            self.market.price = price

    def _reject(self, reason):
        self.rejections[reason] += 1
        self.journal.emit("rejected", reason)
        return False

    def _cancel(self, reason):
        if self.pending:
            self.journal.emit("cancelled", reason, intent_id=self.pending.id)
            self.pending = None

    @exact
    def _record(self, price):
        self.ledger.reconcile(price)
        state = self.ledger.snapshot(price, self.reserve)
        pos = self.ledger.position
        self.sink.write(
            "equity",
            {
                "time_ms": self.journal.time_ms,
                "phase": self.journal.phase,
                **{key: wire(value) for key, value in state.items()},
                "realized": wire(self.ledger.realized),
                "fees": wire(self.ledger.fees),
                "funding": wire(self.ledger.funding),
                "side": side_name(pos.side if pos else 0),
                "quantity": wire(pos.quantity if pos else ZERO),
                "reference_price": wire(price),
                "peak_equity": wire(self.risk.peak),
                "drawdown": wire(self.risk.drawdown),
                "day_start_equity": wire(self.risk.day_start),
                "daily_latched": self.risk.daily_latched,
                "drawdown_latched": self.risk.drawdown_latched,
            },
        )
        self.journal.emit("mark", "portfolio_valuation", position=pos, price=price)

    def _stop(self, reason, invalid=False):
        self.status = "invalid" if invalid else "terminated_restricted"
        self.reason = reason
        self.termination = "invalid" if invalid else "terminated"
        self._cancel(reason)
        self.journal.emit("terminal", reason, position=self.ledger.position)

    @exact
    def _monitor(self, price):
        state = self.ledger.snapshot(price, self.reserve)
        previous = (self.risk.daily_latched, self.risk.drawdown_latched)
        reason = self.risk.check(state["equity"])
        if state["equity"] <= 0:
            self._stop("bankruptcy", invalid=True)
        elif state["available_margin"] <= 0:
            self._stop("restricted_envelope_breached", invalid=True)
        elif reason:
            if previous != (self.risk.daily_latched, self.risk.drawdown_latched):
                self.journal.emit("risk", reason, position=self.ledger.position)
            if self.ledger.position:
                self.forced = reason
            elif self.risk.drawdown_latched:
                self._stop(reason)
        return self.status == "running"

    @exact
    def _close(self, reference, reason, intent_id=None):
        pos = self.ledger.position
        if pos is None:
            return
        price = self.execution.fill(reference, pos.side == -1)
        self.ledger.exit(price, self.journal.time_ms, reason, intent_id)
        self.last_exit = self.market.index
        self._cancel("position_already_closed")
        self.forced = None
        self._monitor(reference)

    def _entry_allowed(self):
        if not self.risk.allowed:
            return "risk_latched"
        if (
            self.last_exit is not None
            and self.market.index - self.last_exit < self.c["risk"]["cooldown_bars"]
        ):
            return "cooldown_active"
        return None

    @exact
    def begin_bar(self, candle, funding_rate=None):
        if self.status != "running":
            return False
        validate(
            "market-candle-v1",
            {key: value for key, value in candle.items() if key != "available_at_ms"},
        )
        t = candle["open_time_ms"]
        if (
            self.open_active
            or t != self.start + (self.market.index + 1) * self.interval
            or not (
                t < self.end
                and candle["close_time_ms"] == t + self.interval
                and candle["timeframe"] == self.c["market"]["timeframe"]
                and candle["price_type"] == "last"
                and candle["symbol"] == self.c["market"]["symbol"]
            )
        ):
            raise ValueError("noncontiguous_simulation_bar")
        o, h, low, close = [decimal(candle[key]) for key in ("open", "high", "low", "close")]
        if not 0 < low <= min(o, close) <= max(o, close) <= h:
            raise ValueError("invalid_simulation_ohlc")
        self.market.index += 1
        self.market.time_ms = t
        self.open_active = True
        self._at(t, "open", o)
        old_day = self.risk.day
        self.risk.rollover(t, self.ledger.snapshot(o)["equity"])
        if old_day is not None and self.risk.day != old_day:
            self.journal.emit("risk", "utc_day_reset")
        if funding_rate is not None:
            self.ledger.fund(o, funding_rate)
        if not self._monitor(o):
            self._record(o)
            return False
        closed_at_open = False
        pos = self.ledger.position
        # Existing protections precede pending exits; TP gaps are capped at the target.
        if pos and pos.side * (o - pos.stop) <= 0:
            self._close(o, "hard_sl_gap")
            closed_at_open = True
        elif pos and pos.take_profit is not None and pos.side * (o - pos.take_profit) >= 0:
            self._close(pos.take_profit, "fixed_tp_gap")
            closed_at_open = True
        if self.status == "running" and self.ledger.position and self.forced:
            self._close(o, self.forced)
            closed_at_open = True
        intent = self.pending
        if self.status == "running" and intent and intent.due_ms <= t:
            self.pending = None
            if intent.action in (3, 4):
                pos = self.ledger.position
                if pos and pos.id == intent.position_id:
                    self._close(o, "ai_early_exit", intent.id)
                    closed_at_open = True
                else:
                    self.journal.emit("cancelled", "position_already_closed", intent_id=intent.id)
            else:
                rejected = self._entry_allowed()
                if closed_at_open or self.ledger.position is not None:
                    rejected = "position_conflict_at_fill"
                if t + self.interval == self.end:
                    rejected = "final_interval_entry"
                if rejected:
                    self._reject(rejected)
                else:
                    try:
                        entry = self.execution.entry(
                            1 if intent.action == 1 else -1,
                            o,
                            intent.atr,
                            self.ledger.snapshot(o)["equity"],
                        )
                    except ValueError as error:
                        self._reject(str(error))
                    else:
                        self.ledger.enter(
                            entry.side,
                            entry.quantity,
                            entry.price,
                            entry.stop,
                            entry.take_profit,
                            t,
                            self.market.index,
                            intent.id,
                            entry.risk_estimate,
                            None if entry.take_profit is None else decimal(self.c["exit"]["rr"]),
                        )
        if self.status == "running":
            self._monitor(o)
        self._record(o)
        return self.status == "running"

    @exact
    def end_bar(self, candle):
        if self.status != "running":
            return False
        if (
            not self.open_active
            or candle["open_time_ms"] != self.market.time_ms
            or (candle["close_time_ms"] != self.market.time_ms + self.interval)
        ):
            raise ValueError("bar_not_open")
        close_time = candle["close_time_ms"]
        close = decimal(candle["close"])
        self._at(close_time, "intrabar")
        pos = self.ledger.position
        if pos:
            adverse = decimal(candle["low"] if pos.side == 1 else candle["high"])
            # Conservative envelope checks precede ambiguous intrabar stop/path assumptions.
            envelope = self.ledger.snapshot(adverse, self.reserve)
            if envelope["equity"] <= 0 or envelope["available_margin"] <= 0:
                self._at(close_time, "intrabar", adverse)
                self._monitor(adverse)
                self._record(adverse)
                self.open_active = False
                return False
            stop_hit = (
                decimal(candle["low"]) <= pos.stop
                if pos.side == 1
                else decimal(candle["high"]) >= pos.stop
            )
            tp_hit = pos.take_profit is not None and (
                decimal(candle["high"]) >= pos.take_profit
                if pos.side == 1
                else decimal(candle["low"]) <= pos.take_profit
            )
            if stop_hit:
                self._close(pos.stop, "hard_sl_ambiguous" if tp_hit else "hard_sl")
            elif tp_hit:
                self._close(pos.take_profit, "fixed_tp")
        self._at(close_time, "close", close)
        if self.status == "running":
            self._monitor(close)
        pos = self.ledger.position
        if (
            pos
            and self.market.index - pos.opened_bar + 1 >= self.c["risk"]["max_holding_bars"]
            and (self.forced is None)
        ):
            self.forced = "max_holding_bars"
            self.journal.emit("risk", self.forced, position=pos)
        self._record(close)
        self.open_active = False
        self.decision_time = close_time
        return self.status == "running"

    @exact
    def context(self, time_ms, price):
        price = decimal(price)
        state = self.ledger.snapshot(price, self.reserve)
        if state["equity"] <= 0 or state["available_margin"] < 0:
            return None
        pos = self.ledger.position
        equity = float(state["equity"])
        day = float(self.risk.day_start)
        remaining = min(
            float(self.risk.remaining(state["equity"])),
            day * float(self.c["risk"]["daily_loss_limit"]),
        )
        # Only the model-facing boundary is float; financial state remains Decimal.
        return {
            "as_of_ms": time_ms,
            "side": side_name(pos.side if pos else 0),
            "mark": float(price),
            "entry": float(pos.entry) if pos else 0,
            "quantity": float(pos.quantity) if pos else 0,
            "stop": float(pos.stop) if pos else 0,
            "take_profit": float(pos.take_profit) if pos and pos.take_profit is not None else None,
            "duration_bars": (time_ms - pos.opened_ms) // self.interval if pos else 0,
            "equity": equity,
            "high_water_equity": max(equity, float(self.risk.peak)),
            "daily_start_equity": day,
            "available_margin": min(equity, float(state["available_margin"])),
            "remaining_daily_budget": max(0.0, remaining),
            "trading_allowed": self.status == "running" and self._entry_allowed() is None,
        }

    @exact
    def action_mask(self, time_ms, atr, observation_valid, reference):
        mask = [True, False, False, False, False]
        if self.status != "running" or not observation_valid or self.pending or self.forced:
            return mask
        pos = self.ledger.position
        if pos:
            if self.c["exit"]["mode"] != "FIXED_RR":
                mask[3 if pos.side == 1 else 4] = True
            return mask
        due = time_ms + self.policy["execution_latency_ms"]
        due_open = ((due + self.interval - 1) // self.interval) * self.interval
        if self._entry_allowed() or due_open + self.interval >= self.end:
            return mask
        if type(atr) not in (float, int) or not math.isfinite(atr) or atr <= 0:
            return mask
        equity = self.ledger.snapshot(decimal(reference))["equity"]
        for action, side in ((1, 1), (2, -1)):
            try:
                self.execution.entry(side, reference, D(repr(atr)), equity)
            except ValueError:
                pass
            else:
                mask[action] = True
        return mask

    def submit_masked(self, time_ms, action, atr, observation_valid, reference):
        if type(action) is not int or action not in range(5):
            return self.submit(time_ms, action, atr, observation_valid)
        if not self.action_mask(time_ms, atr, observation_valid, reference)[action]:
            self._at(self.decision_time, "decision")
            self._reject("masked_action")
            self.submit(time_ms, 0, atr, observation_valid)
            return False
        return self.submit(time_ms, action, atr, observation_valid)

    @exact
    def submit(self, time_ms, action, atr, observation_valid):
        self._at(self.decision_time, "decision")
        if self.status != "running":
            return self._reject("run_not_active")
        if (
            type(time_ms) is not int
            or time_ms != self.decision_time
            or (self.last_decision is not None and time_ms <= self.last_decision)
        ):
            return self._reject("invalid_or_duplicate_decision")
        self.last_decision = time_ms
        if type(action) is not int or action not in range(5):
            return self._reject("invalid_action")
        if action == 0:
            return True
        if not observation_valid:
            return self._reject("observation_unavailable")
        if time_ms >= self.end or self.pending is not None:
            return self._reject("episode_end_or_pending_intent")
        pos = self.ledger.position
        if action in (1, 2):
            reason = self._entry_allowed()
            if pos is not None:
                reason = "position_stacking_forbidden"
            if time_ms + self.interval >= self.end:
                reason = "final_interval_entry"
            if reason:
                return self._reject(reason)
            if type(atr) not in (float, int) or not math.isfinite(atr) or atr <= 0:
                return self._reject("atr_unavailable")
            frozen_atr = D(repr(atr))
        else:
            if not pos or pos.side != (1 if action == 3 else -1):
                return self._reject("position_close_mismatch")
            if self.c["exit"]["mode"] == "FIXED_RR":
                return self._reject("discretionary_close_disabled")
            frozen_atr = None
        self.intent_count += 1
        intent = Intent(
            f"intent-{self.intent_count}",
            action,
            time_ms,
            time_ms + self.policy["execution_latency_ms"],
            frozen_atr,
            pos.id if pos else None,
        )
        self.pending = intent
        self.journal.emit(
            "intent",
            "scheduled_next_available_open",
            intent_id=intent.id,
            position=pos,
            side=1 if action == 1 else -1 if action == 2 else 0,
        )
        return True

    @exact
    def finish(self):
        if self.status == "running":
            if self.decision_time != self.end or self.open_active:
                raise ValueError("episode_not_finished")
            self._at(self.end, "terminal")
            self._cancel("episode_end")
            if self.ledger.position:
                self._close(self.market.price, "terminal_settlement")
            if self.status == "running":
                self.status, self.reason, self.termination = (
                    "completed_restricted",
                    "episode_end",
                    "truncated",
                )
                self.journal.emit("terminal", self.reason)
            self._record(self.market.price)
        state = self.ledger.snapshot(self.market.price, self.reserve)
        report = {
            "version": "1",
            "status": self.status,
            "reason": self.reason,
            "termination": self.termination,
            "simulation_policy_version": "restricted_bar_v1",
            "numeric_policy": "decimal128_currency18_adverse_v1",
            "initial_capital": wire(self.ledger.initial),
            "final_wallet": wire(self.ledger.wallet),
            "final_equity": wire(state["equity"]),
            "realized": wire(self.ledger.realized),
            "fees": wire(self.ledger.fees),
            "funding": wire(self.ledger.funding),
            "net_equity_change": wire(state["equity"] - self.ledger.initial),
            "final_position": side_name(self.ledger.position.side if self.ledger.position else 0),
            "events": self.sink.counts["events"],
            "trades": self.sink.counts["trades"],
            "equity_points": self.sink.counts["equity"],
            "observations_valid": self.valid_observations,
            "observations_unavailable": dict(self.unavailable),
            "rejections": dict(self.rejections),
            "policy": self.policy,
            "execution_ready": False,
            "liquidation_model": "not_modeled_collateral_envelope_only",
            "historical_metadata": "current_observation_reference_only",
            "funding_schedule_validity": "researcher_declared_not_exchange_verified",
        }
        validate("simulation-report-v1", report)
        return report

    def apply_cashflow(self, *_):
        raise ValueError("external_cashflow_unsupported")
