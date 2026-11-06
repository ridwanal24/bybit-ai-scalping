from copy import deepcopy
from decimal import getcontext

import pytest
from simulation_helpers import config, instrument

from bybit_quant.contracts import CONTRACTS, strict_json, validate
from bybit_quant.simulation.execution import Execution
from bybit_quant.simulation.ledger import Journal, Ledger
from bybit_quant.simulation.numeric import D, cash, debit, decimal, tick, wire
from bybit_quant.simulation.state import MemorySink

VECTORS = strict_json((CONTRACTS / "fixtures/simulation-accounting.json").read_text("utf-8"))


@pytest.mark.parametrize("v", VECTORS, ids=lambda v: v["name"])
def test_independent_accounting_vectors(v):
    sink = MemorySink()
    journal = Journal(sink)
    ledger = Ledger("1000", v["fee_rate"], journal)
    side = v["side"]
    stop = D(v["entry"]) - side * D(10)
    ledger.enter(side, v["quantity"], v["entry"], stop, None, 0, 0)
    assert ledger.wallet == D(1000) - D(v["entry_fee"])
    before = ledger.snapshot(D(v["exit"]))
    assert before["unrealized"] == D(v["gross_pnl"])
    journal.time_ms = 60000
    ledger.exit(v["exit"], 60000, "test_close")
    assert ledger.wallet == D(v["final_wallet"])
    assert ledger.snapshot(D(v["exit"]))["unrealized"] == 0
    assert ledger.snapshot(D(v["exit"]))["initial_margin"] == 0
    assert sink.rows["trades"][0]["exit_fee"] == v["exit_fee"]
    for event in sink.rows["events"]:
        validate("simulation-event-v1", event)
    validate("simulation-trade-v1", sink.rows["trades"][0])
    assert sum(D(row["amount"]) for row in sink.rows["events"]) == ledger.wallet - D(1000)
    with pytest.raises(ValueError, match="invalid_position_exit"):
        ledger.exit(v["exit"], 60000, "duplicate")


@pytest.mark.parametrize(
    "side,rate,expected", [(1, ".01", "-1"), (-1, ".01", "1"), (1, "-.01", "1"), (-1, "-.01", "-1")]
)
def test_funding_sign_and_trade_reconciliation(side, rate, expected):
    sink = MemorySink()
    ledger = Ledger("1000", "0.001", Journal(sink))
    ledger.enter(side, "1", "100", D(100) - side * D(10), None, 0, 0)
    assert ledger.fund("100", rate) == D(expected)
    ledger.exit("100", 60000, "test")
    assert ledger.wallet == D("999.8") + D(expected)
    assert D(sink.rows["trades"][0]["net_pnl"]) == D(expected) - D(".2")
    assert ledger.fund("100", rate) == 0  # FLAT never pays a second event.


def test_margin_is_not_an_expense_and_prices_are_not_double_charged():
    sink = MemorySink()
    ledger = Ledger("1000", "0", Journal(sink))
    ledger.enter(1, "1", "101", "99", None, 0, 0)
    assert ledger.wallet == 1000 and ledger.snapshot(D(100))["equity"] == 999
    ledger.exit("99", 60000, "adverse_exit")
    assert ledger.wallet == 998 and ledger.realized == -2 and ledger.fees == 0


def test_adverse_currency_rounding_and_local_precision():
    before = getcontext().prec
    assert cash(D("0.0000000000000000009")) == 0
    assert cash(D("-0.0000000000000000001")) == D("-0.000000000000000001")
    assert debit(D("0.0000000000000000001")) == D("0.000000000000000001")
    assert getcontext().prec == before
    assert wire(D("-0.000")) == "0"
    assert tick(D("100.01"), D(".1"), True) == D("100.1")
    assert tick(D("100.09"), D(".1")) == D("100")
    for bad in (1.5, True, "NaN", "Infinity"):
        with pytest.raises(ValueError):
            decimal(bad)


@pytest.mark.parametrize("buy,expected", [(True, "100.1"), (False, "99.9")])
def test_adverse_fill_direction_and_tick(buy, expected):
    c = config()
    c["execution"].update(spread_bps="5", slippage_bps="5")
    execution = Execution(c, instrument(), "0")
    assert execution.fill("100", buy) == D(expected)


@pytest.mark.parametrize("side", [1, -1])
def test_sizing_is_largest_feasible_quantity_and_respects_cost_budget(side):
    c, inst = config(), instrument()
    execution = Execution(c, inst, "0")
    entry = execution.entry(side, "100", "2", "1000")
    assert entry.quantity == D("2.272" if side == 1 else "2.270")
    assert entry.risk_estimate <= 5
    assert (entry.quantity + D(".001")) * D("2.2" if side == 1 else "2.202") > 5
    assert entry.quantity * entry.price <= 500
    assert side * (entry.price - entry.stop) == 2
    assert side * (entry.take_profit - entry.price) >= 4


@pytest.mark.parametrize(
    "field,value,expected_cap",
    [
        ("max_position_notional", "100", "100"),
        ("max_margin_fraction", ".1", "100"),
        ("min_available_margin", "950", "50"),
    ],
)
def test_sizing_caps_and_rounded_fee_affordability(field, value, expected_cap):
    c = config()
    c["risk"][field] = value
    entry = Execution(c, instrument(), "0").entry(1, "100", "2", "1000")
    assert entry.quantity * entry.price <= D(expected_cap)
    assert D(1000) - debit(entry.quantity * entry.price) - debit(
        entry.quantity * entry.price * D(".001")
    ) >= D(c["risk"]["min_available_margin"])


def test_exposure_envelope_and_market_maximum_are_additional_caps():
    c = config()
    c["risk"]["max_position_notional"] = "100000"
    inst = instrument()
    inst["max_market_quantity"] = "0.5"
    entry = Execution(c, inst, "0").entry(1, "100", ".1", "1000")
    assert entry.quantity == D(".5")
    inst["max_market_quantity"] = "1000"
    entry = Execution(c, inst, "0").entry(1, "100", ".1", "1000")
    assert entry.quantity == 5


@pytest.mark.parametrize(
    "change", ["min_qty", "min_notional", "margin", "stop_small", "stop_large"]
)
def test_infeasible_sizing_rejects_without_mutating_configuration(change):
    c, inst = config(), instrument()
    atr = "2"
    if change == "min_qty":
        inst["min_quantity"] = "10"
    if change == "min_notional":
        inst["min_notional"] = "1000"
    if change == "margin":
        c["risk"]["min_available_margin"] = "1000"
    if change == "stop_small":
        atr = ".01"
    if change == "stop_large":
        atr = "10"
    before = deepcopy(c)
    with pytest.raises(ValueError):
        Execution(c, inst, "0").entry(1, "100", atr, "1000")
    assert c == before


def test_tiny_step_and_currency_rounding_search_is_bounded_and_exact():
    inst = instrument()
    inst.update(
        quantity_step="0.000000000000000001", min_quantity="0.000000000000000001", min_notional="0"
    )
    c = config()
    c["risk"]["min_available_margin"] = "999.999999999999999999"
    with pytest.raises(ValueError):
        Execution(c, inst, "0").entry(1, "100", "2", "1000")
