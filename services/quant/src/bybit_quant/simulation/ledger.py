"""Exact single-position accounting. Margin is collateral, never an expense."""

from bybit_quant.simulation.numeric import ZERO, cash, debit, decimal, exact, wire
from bybit_quant.simulation.state import Position, side_name


class Journal:
    def __init__(self, sink):
        self.sink = sink
        self.seq = 0
        self.time_ms = 0
        self.phase = "decision"
        self.wallet = ZERO

    def emit(
        self,
        kind,
        reason,
        *,
        amount=ZERO,
        position=None,
        intent_id=None,
        quantity=None,
        price=None,
        side=0,
    ):
        self.seq += 1
        self.sink.write(
            "events",
            {
                "seq": self.seq,
                "time_ms": self.time_ms,
                "phase": self.phase,
                "kind": kind,
                "reason": reason,
                "position_id": position.id if position else None,
                "intent_id": intent_id,
                "side": side_name(position.side if position else side),
                "quantity": wire(position.quantity if position else (quantity or ZERO)),
                "price": wire(price) if price is not None else None,
                "amount": wire(amount),
                "wallet": wire(self.wallet),
            },
        )


class Ledger:
    def __init__(self, initial_capital, fee_rate, journal):
        self.initial = decimal(initial_capital)
        self.fee_rate = decimal(fee_rate)
        if self.initial <= 0 or not 0 <= self.fee_rate < 1:
            raise ValueError("invalid_ledger_parameters")
        self.journal = journal
        self.wallet = self.initial
        self.journal.wallet = self.wallet
        self.realized = self.fees = self.funding = ZERO
        self.closed_realized = self.closed_fees = self.closed_funding = ZERO
        self.position = None
        self.opened = 0

    @exact
    def enter(
        self,
        side,
        quantity,
        price,
        stop,
        take_profit,
        time_ms,
        bar_index,
        intent_id=None,
        risk_estimate=None,
        target_rr=None,
    ):
        q, price, stop = map(decimal, (quantity, price, stop))
        tp = None if take_profit is None else decimal(take_profit)
        if (
            self.position is not None
            or type(side) is not int
            or side not in (-1, 1)
            or min(q, price, stop) <= 0
            or (
                side * (price - stop) <= 0
                or tp is not None
                and (tp <= 0 or side * (tp - price) <= 0)
            )
        ):
            raise ValueError("invalid_position_entry")
        fee = debit(q * price * self.fee_rate)
        risk_estimate = (
            decimal(risk_estimate) if risk_estimate is not None else q * abs(price - stop)
        )
        if risk_estimate <= 0:
            raise ValueError("invalid_initial_risk_estimate")
        self.opened += 1
        pos = Position(
            f"position-{self.opened}",
            side,
            q,
            price,
            stop,
            tp,
            time_ms,
            bar_index,
            fee,
            risk_estimate,
            None if target_rr is None else decimal(target_rr),
        )
        self.position = pos
        self.journal.emit("entry", "market_entry", position=pos, price=price, intent_id=intent_id)
        self.fees += fee
        self.wallet -= fee
        self.journal.wallet = self.wallet
        self.journal.emit(
            "fee", "entry_fee", amount=-fee, position=pos, price=price, intent_id=intent_id
        )
        self.reconcile(price)
        return pos

    @exact
    def fund(self, price, rate):
        price, rate = map(decimal, (price, rate))
        if self.position is None:
            return ZERO
        pos = self.position
        amount = cash(-pos.side * pos.quantity * price * rate)
        pos.funding += amount
        self.funding += amount
        self.wallet += amount
        self.journal.wallet = self.wallet
        self.journal.emit(
            "funding", "boundary_last_open_proxy", amount=amount, position=pos, price=price
        )
        self.reconcile(price)
        return amount

    @exact
    def exit(self, price, time_ms, reason, intent_id=None):
        price = decimal(price)
        if price <= 0 or self.position is None:
            raise ValueError("invalid_position_exit")
        pos = self.position
        gross = cash(pos.side * pos.quantity * (price - pos.entry))
        fee = debit(pos.quantity * price * self.fee_rate)
        self.realized += gross
        self.wallet += gross
        self.journal.wallet = self.wallet
        self.journal.emit(
            "realized", reason, amount=gross, position=pos, price=price, intent_id=intent_id
        )
        self.fees += fee
        self.wallet -= fee
        self.journal.wallet = self.wallet
        self.journal.emit(
            "fee", "exit_fee", amount=-fee, position=pos, price=price, intent_id=intent_id
        )
        self.position = None
        self.journal.emit("exit", reason, position=pos, price=price, intent_id=intent_id)
        net = gross - pos.entry_fee - fee + pos.funding
        self.journal.sink.write(
            "trades",
            {
                "position_id": pos.id,
                "side": side_name(pos.side),
                "quantity": wire(pos.quantity),
                "entry": wire(pos.entry),
                "exit": wire(price),
                "stop": wire(pos.stop),
                "take_profit": None if pos.take_profit is None else wire(pos.take_profit),
                "opened_ms": pos.opened_ms,
                "closed_ms": time_ms,
                "reason": reason,
                "gross_pnl": wire(gross),
                "entry_fee": wire(pos.entry_fee),
                "exit_fee": wire(fee),
                "funding": wire(pos.funding),
                "net_pnl": wire(net),
                "target_rr": None if pos.target_rr is None else wire(pos.target_rr),
                "gross_realized_rr": wire(gross / (pos.quantity * abs(pos.entry - pos.stop))),
                "net_realized_rr": wire(net / pos.risk_estimate),
                "initial_risk_estimate": wire(pos.risk_estimate),
            },
        )
        self.closed_realized += gross
        self.closed_fees += pos.entry_fee + fee
        self.closed_funding += pos.funding
        self.reconcile(price)

    @exact
    def snapshot(self, price, reserve=ZERO):
        price, reserve = map(decimal, (price, reserve))
        pos = self.position
        unrealized = cash(pos.side * pos.quantity * (price - pos.entry)) if pos else ZERO
        margin = debit(pos.quantity * pos.entry) if pos else ZERO
        equity = self.wallet + unrealized
        return {
            "wallet": self.wallet,
            "unrealized": unrealized,
            "equity": equity,
            "initial_margin": margin,
            "available_margin": equity - margin - reserve,
        }

    @exact
    def reconcile(self, price):
        if self.wallet != self.initial + self.realized - self.fees + self.funding:
            raise ArithmeticError("wallet_reconciliation_failed")
        pos = self.position
        if self.closed_realized != self.realized or (
            self.closed_fees + (pos.entry_fee if pos else ZERO) != self.fees
            or self.closed_funding + (pos.funding if pos else ZERO) != self.funding
        ):
            raise ArithmeticError("trade_reconciliation_failed")
        state = self.snapshot(price)
        if state["equity"] != self.wallet + state["unrealized"]:
            raise ArithmeticError("equity_reconciliation_failed")
