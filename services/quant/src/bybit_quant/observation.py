"""One observation builder for historical and future live consumers."""

import math
import struct
from collections import deque

from jsonschema.exceptions import ValidationError

from bybit_quant.configuration import configuration
from bybit_quant.contracts import INTERVALS, validate
from bybit_quant.features.schema import observation_schema


def context_values(ctx, c, decision):
    validate("observation-context-v1", ctx)
    if ctx["as_of_ms"] != decision:
        raise ValueError("context_not_current")
    if not all(math.isfinite(v) for v in ctx.values() if type(v) in (int, float)):
        raise ValueError("nonfinite_context")
    if ctx["equity"] > ctx["high_water_equity"]:
        raise ValueError("invalid_high_water")
    daily_limit = ctx["daily_start_equity"] * float(c["risk"]["daily_loss_limit"])
    if ctx["remaining_daily_budget"] > daily_limit or ctx["available_margin"] > ctx["equity"]:
        raise ValueError("context_budget_or_margin")
    side = {"FLAT": 0, "LONG": 1, "SHORT": -1}[ctx["side"]]
    if side == 0:
        if any(ctx[k] != 0 for k in ("entry", "quantity", "stop", "duration_bars")) or (
            ctx["take_profit"] is not None
        ):
            raise ValueError("flat_context_conflict")
    elif any(ctx[k] <= 0 for k in ("entry", "quantity", "stop")):
        raise ValueError("position_context_missing")
    if side and c["exit"]["mode"] != "AI_EXIT" and ctx["take_profit"] is None:
        raise ValueError("position_tp_missing")
    if c["exit"]["mode"] == "AI_EXIT" and ctx["take_profit"] is not None:
        raise ValueError("unexpected_tp")
    capital = float(c["risk"]["initial_capital"])
    mark = ctx["mark"]
    position = {
        "side": side,
        "unrealized_pnl": side * (mark - ctx["entry"]) * ctx["quantity"] / capital if side else 0,
        "duration": ctx["duration_bars"] / c["risk"]["max_holding_bars"],
        "distance_to_sl": (mark - ctx["stop"]) / mark if side else 0,
        "distance_to_tp": (ctx["take_profit"] - mark) / mark
        if side and ctx["take_profit"] is not None
        else 0,
        "exposure": mark * ctx["quantity"] / capital,
        "available_margin": ctx["available_margin"] / capital,
    }
    risk = {
        "drawdown": (ctx["high_water_equity"] - ctx["equity"]) / ctx["high_water_equity"],
        "remaining_daily_budget": ctx["remaining_daily_budget"] / capital,
        "trading_allowed": int(ctx["trading_allowed"]),
        "risk_fraction": float(c["risk"]["risk_per_trade"]),
    }
    return [position[key] for key in c["features"]["position_inputs"]] + [
        risk[key] for key in c["features"]["risk_inputs"]
    ]


class ObservationBuilder:
    def __init__(self, c, dataset, normalizer):
        self.c = configuration(c)
        self.schema = observation_schema(self.c)
        self.normalizer = normalizer
        self.compatible = True
        if normalizer is not None:
            try:
                normalizer.bind(self.c, dataset)
            except ValueError:
                self.compatible = False
        self.window = deque(maxlen=self.c["features"]["observation_window"])
        self.previous = None

    def push(self, row, context):
        t = row["decision_ms"]
        result = {"valid": False, "decision_ms": t}
        if self.previous is not None and t <= self.previous:
            raise ValueError("nonascending_observations")
        gap = (
            self.previous is not None
            and t != self.previous + INTERVALS[self.c["market"]["timeframe"]]
        )
        self.previous = t
        if gap or row["reason"] is not None:
            self.window.clear()
            return {**result, "reason": row["reason"] or "gap"}
        if self.normalizer is None:
            return {**result, "reason": "missing_artifact"}
        if not self.compatible:
            return {**result, "reason": "incompatible"}
        try:
            self.window.append(self.normalizer.transform(row["values"]))
        except (ValueError, TypeError, OverflowError):
            self.window.clear()
            return {**result, "reason": "invalid_value"}
        if len(self.window) != self.window.maxlen:
            return {**result, "reason": "warm_up"}
        if context is None:
            return {**result, "reason": "missing_context"}
        try:
            values = [v for row_values in self.window for v in row_values]
            values += context_values(context, self.c, t)
            if len(values) != self.schema["schema"]["dimension"]:
                raise ValueError("observation_shape")
            raw = struct.pack(f"<{len(values)}f", *values)
            values = list(struct.unpack(f"<{len(values)}f", raw))
            if not all(math.isfinite(x) for x in values):
                raise ValueError("float32_overflow")
        except (ValueError, TypeError, OverflowError, struct.error, ValidationError):
            return {**result, "reason": "invalid_value"}
        # Schema validation errors are also input failures, never valid vectors.
        return {
            "valid": True,
            "decision_ms": t,
            "schema_hash": self.schema["sha256"],
            "normalizer_id": self.normalizer.id,
            "values": values,
        }
