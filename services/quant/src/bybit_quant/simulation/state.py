"""Simulation state and streaming journal; event amounts reconcile wallet exactly."""

from copy import deepcopy
from dataclasses import dataclass

from bybit_quant.simulation.numeric import ZERO, D


def side_name(side):
    return {0: "FLAT", 1: "LONG", -1: "SHORT"}[side]


@dataclass
class Position:
    id: str
    side: int
    quantity: D
    entry: D
    stop: D
    take_profit: D | None
    opened_ms: int
    opened_bar: int
    entry_fee: D
    risk_estimate: D
    target_rr: D | None
    funding: D = ZERO


@dataclass(frozen=True)
class Intent:
    id: str
    action: int
    decision_ms: int
    due_ms: int
    atr: D | None
    position_id: str | None


@dataclass
class MarketState:
    time_ms: int
    price: D
    index: int = -1


class MemorySink:
    """Bounded tests/research callers may collect; production CLI uses FileSink."""

    def __init__(self):
        self.rows = {"events": [], "trades": [], "equity": []}
        self.counts = {key: 0 for key in self.rows}

    def write(self, stream, row):
        self.rows[stream].append(deepcopy(row))
        self.counts[stream] += 1
