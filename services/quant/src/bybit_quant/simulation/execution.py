"""Adverse full-fill bar model and bounded exact quantity search."""

from dataclasses import dataclass
from decimal import ROUND_FLOOR

from bybit_quant.simulation.numeric import ZERO, D, debit, decimal, exact, tick


@dataclass(frozen=True)
class Entry:
    side: int
    quantity: D
    price: D
    stop: D
    take_profit: D | None
    risk_estimate: D


class Execution:
    @exact
    def __init__(self, c, instrument, reserve):
        self.c, self.instrument, self.reserve = c, instrument, decimal(reserve)
        self.step = decimal(instrument["quantity_step"])
        self.tick = decimal(instrument["tick_size"])
        self.fee = decimal(c["execution"]["taker_fee_rate"])
        self.adverse = decimal(c["execution"]["spread_bps"]) / D(20000) + decimal(
            c["execution"]["slippage_bps"]
        ) / D(10000)

    @exact
    def fill(self, reference, buy):
        reference = decimal(reference)
        result = tick(reference * (1 + self.adverse if buy else 1 - self.adverse), self.tick, buy)
        if result <= 0:
            raise ValueError("nonpositive_modeled_fill")
        return result

    @exact
    def entry(self, side, reference, atr, equity):
        equity, atr = map(decimal, (equity, atr))
        if side not in (-1, 1) or min(equity, atr) <= 0:
            raise ValueError("invalid_entry_basis")
        price = self.fill(reference, side == 1)
        sl = self.c["stop_loss"]
        stop = tick(price - side * atr * decimal(sl["atr_multiplier"]), self.tick, side == 1)
        distance = side * (price - stop)
        if (
            stop <= 0
            or distance <= 0
            or not (
                decimal(sl["min_stop_fraction"])
                <= distance / price
                <= decimal(sl["max_stop_fraction"])
            )
        ):
            raise ValueError("stop_distance_outside_limits")
        tp = None
        if self.c["exit"]["mode"] != "AI_EXIT":
            tp = tick(price + side * distance * decimal(self.c["exit"]["rr"]), self.tick, side == 1)
            if tp <= 0 or side * (tp - price) <= 0:
                raise ValueError("invalid_take_profit")
        worst_exit = self.fill(stop, side == -1)
        unit_risk = (
            distance
            + max((price + worst_exit) * self.fee, price * decimal(sl["fee_allowance_rate"]))
            + max(abs(worst_exit - stop), price * decimal(sl["slippage_allowance_bps"]) / D(10000))
        )
        risk = self.c["risk"]
        budget = equity * decimal(risk["risk_per_trade"])
        cap = min(decimal(risk["max_position_notional"]), equity / D(2))
        margin_cap = equity * min(decimal(risk["max_margin_fraction"]), D("0.5"))
        free_budget = equity - self.reserve - decimal(risk["min_available_margin"])
        if free_budget <= 0:
            raise ValueError("insufficient_available_margin")
        upper = min(
            budget / unit_risk,
            cap / price,
            margin_cap / price,
            decimal(self.instrument["max_market_quantity"]),
            free_budget / (price * (1 + self.fee)),
        )
        units = max(0, int((upper / self.step).to_integral_value(rounding=ROUND_FLOOR)))

        def feasible(n):
            q = self.step * n
            notional = q * price
            margin = debit(notional)
            return (
                q * unit_risk <= budget
                and notional <= cap
                and margin <= margin_cap
                and equity - debit(notional * self.fee) - margin - self.reserve
                >= decimal(risk["min_available_margin"])
            )

        lo, hi = 0, units
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if feasible(mid):
                lo = mid
            else:
                hi = mid - 1
        quantity = self.step * lo
        if (
            quantity < decimal(self.instrument["min_quantity"])
            or quantity * price < decimal(self.instrument["min_notional"])
            or quantity == ZERO
        ):
            raise ValueError("quantity_below_instrument_minimum")
        return Entry(side, quantity, price, stop, tp, debit(quantity * unit_risk))
