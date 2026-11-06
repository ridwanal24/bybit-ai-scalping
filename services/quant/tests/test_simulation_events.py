from copy import deepcopy

import pytest
from feature_helpers import START
from jsonschema.exceptions import ValidationError
from simulation_helpers import MINUTE, advance, bar, config, finish, instrument, policy, simulator

from bybit_quant.contracts import CONTRACTS, strict_json
from bybit_quant.simulation.numeric import D
from bybit_quant.simulation.risk import RiskState


@pytest.mark.parametrize("action,side", [(1, 1), (2, -1)])
def test_next_open_entry_attaches_stop_and_discretionary_exit(action, side):
    sim = simulator()
    assert sim.submit(START, action, 2.0, True)
    assert sim.ledger.position is None and sim.ledger.fees == 0
    advance(sim, bar(0))
    pos = sim.ledger.position
    assert pos.side == side and pos.stop == D(100) - side * D(2)
    assert sim.submit(START + MINUTE, 3 if side == 1 else 4, None, True)
    assert sim.ledger.position is not None
    advance(sim, bar(1))
    assert sim.ledger.position is None
    assert sim.sink.rows["trades"][0]["reason"] == "ai_early_exit"
    assert finish(sim)["status"] == "completed_restricted"


@pytest.mark.parametrize(
    "mode,tp,close_allowed",
    [("HYBRID", True, True), ("AI_EXIT", False, True), ("FIXED_RR", True, False)],
)
def test_all_exit_modes_keep_hard_stop(mode, tp, close_allowed):
    c = config()
    c["exit"].update(
        mode=mode, fixed_tp_enabled=tp, ai_close_enabled=close_allowed, rr="2" if tp else None
    )
    sim = simulator(c)
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0))
    assert (sim.ledger.position.take_profit is not None) == tp
    assert sim.submit(START + MINUTE, 3, None, True) == close_allowed
    advance(sim, bar(1, low=97))
    assert sim.ledger.position is None


@pytest.mark.parametrize(
    "action,high,low,reason",
    [
        (1, 105, 97, "hard_sl_ambiguous"),
        (2, 103, 95, "hard_sl_ambiguous"),
        (1, 105, 99, "fixed_tp"),
        (2, 101, 95, "fixed_tp"),
        (1, 101, 97, "hard_sl"),
        (2, 103, 99, "hard_sl"),
    ],
)
def test_intrabar_protection_and_conservative_double_touch(action, high, low, reason):
    sim = simulator()
    sim.submit(START, action, 2.0, True)
    advance(sim, bar(0, high=high, low=low))
    assert sim.ledger.position is None
    assert len(sim.sink.rows["trades"]) == 1
    assert sim.sink.rows["trades"][0]["reason"] == reason
    assert finish(sim)["trades"] == 1


@pytest.mark.parametrize(
    "open,high,low,reason,exit_price",
    [
        (97, 98, 96, "hard_sl_gap", "97"),
        (110, 111, 109, "fixed_tp_gap", "104"),
    ],
)
def test_gap_protection_precedes_pending_close_without_duplicate_fill(
    open, high, low, reason, exit_price
):
    sim = simulator()
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0))
    sim.submit(START + MINUTE, 3, None, True)
    advance(sim, bar(1, open=open, high=high, low=low, close=open))
    assert sim.sink.rows["trades"][0]["reason"] == reason
    assert sim.sink.rows["trades"][0]["exit"] == exit_price
    assert len([e for e in sim.sink.rows["events"] if e["kind"] == "exit"]) == 1
    assert len([e for e in sim.sink.rows["events"] if e["reason"] == "exit_fee"]) == 1
    assert sim.pending is None


def test_boundary_funding_is_before_existing_close_but_not_new_entry():
    sim = simulator()
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0), D(".01"))
    assert sim.ledger.funding == 0
    q = sim.ledger.position.quantity
    sim.submit(START + MINUTE, 3, None, True)
    advance(sim, bar(1), D(".01"))
    assert sim.ledger.funding == -q
    at_boundary = [e["kind"] for e in sim.sink.rows["events"] if e["time_ms"] == START + MINUTE]
    assert at_boundary.index("funding") < at_boundary.index("exit")


def test_position_stopped_in_previous_bar_does_not_pay_next_boundary_funding():
    sim = simulator()
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0, low=97))
    advance(sim, bar(1), D(".01"))
    assert sim.ledger.funding == 0


def test_frozen_atr_and_latency_never_fill_an_open_that_has_passed():
    p = policy()
    p["execution_latency_ms"] = 1
    sim = simulator(p=p)
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0, high=120, low=80))
    assert sim.ledger.position is None
    assert sim.pending.atr == 2
    advance(sim, bar(1))
    assert sim.ledger.position.opened_ms == START + MINUTE
    assert sim.ledger.position.stop == 98  # Not the large execution-bar range.


def test_future_ohlc_does_not_change_open_fill_or_sizing():
    sims = [simulator(), simulator()]
    bars = [bar(0), bar(0, high=120, low=80, close=110)]
    for sim, candle in zip(sims, bars, strict=True):
        sim.submit(START, 1, 2.0, True)
        sim.begin_bar(candle)
    assert sims[0].ledger.position == sims[1].ledger.position
    assert sims[0].sink.rows["events"] == sims[1].sink.rows["events"]


def test_invalid_actions_and_observation_do_not_open_or_charge_fees():
    for action, valid in [(1, False), (3, True), (4, True), (99, True), (True, True)]:
        sim = simulator()
        assert not sim.submit(START, action, 2.0, valid)
        advance(sim, bar(0))
        assert sim.ledger.wallet == 1000 and sim.ledger.position is None
    sim = simulator()
    assert sim.submit(START, 0, None, False)
    assert not sim.submit(START, 1, 2.0, True)
    assert not sim.submit(START - MINUTE, 1, 2.0, True)


def test_max_holding_forces_next_open_exit_and_cooldown_blocks_reentry():
    c = config()
    c["risk"]["max_holding_bars"] = 1
    sim = simulator(c)
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0))
    assert sim.ledger.position is not None and sim.forced == "max_holding_bars"
    advance(sim, bar(1))
    assert sim.sink.rows["trades"][0]["reason"] == "max_holding_bars"
    assert not sim.submit(START + 2 * MINUTE, 1, 2.0, True)
    for i in range(2, 7):
        advance(sim, bar(i))
    assert sim.submit(START + 7 * MINUTE, 1, 2.0, True)


def test_funding_breach_latches_daily_limit_and_closes_at_boundary():
    c = config()
    c["risk"].update(risk_per_trade="0.005", daily_loss_limit="0.005")
    sim = simulator(c)
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0))
    # Funding breaches the daily equity budget before the next pending operation.
    advance(sim, bar(1), D(".05"))
    assert sim.risk.daily_latched and sim.ledger.position is None
    assert sim.sink.rows["trades"][0]["reason"] == "daily_loss_limit"
    assert sim.status == "running"
    assert not sim.submit(START + 2 * MINUTE, 1, 2.0, True)


def test_risk_utc_reset_does_not_clear_drawdown_or_retroactively_reset_funding():
    risk = RiskState(config()["risk"])
    midnight = START + 86400000
    risk.rollover(midnight - MINUTE, D(1000))
    risk.check(D(970))
    assert risk.daily_latched
    risk.check(D(1000))
    assert risk.daily_latched  # Recovery does not clear the daily latch.
    risk.rollover(midnight, D(1000))
    assert not risk.daily_latched
    assert risk.remaining(D(990)) == 10
    risk.check(D(890))
    risk.rollover(midnight + 86400000, D(890))
    assert risk.drawdown_latched and not risk.allowed


def test_drawdown_terminates_after_controlled_close():
    c = config()
    c["risk"].update(daily_loss_limit="0.005", max_drawdown="0.01")
    sim = simulator(c)
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0))
    advance(sim, bar(1), D(".05"))
    assert sim.status == "terminated_restricted"
    assert sim.reason == "drawdown_limit" and sim.ledger.position is None


@pytest.mark.parametrize(
    "high,reason", [(500, "restricted_envelope_breached"), (1000, "bankruptcy")]
)
def test_collateral_stress_invalidates_without_inventing_a_liquidation_fill(high, reason):
    sim = simulator()
    sim.submit(START, 2, 2.0, True)
    advance(sim, bar(0, high=high))
    assert sim.status == "invalid" and sim.reason == reason
    assert sim.ledger.position is not None and sim.sink.rows["trades"] == []
    report = sim.finish()
    assert report["execution_ready"] is False
    if reason == "bankruptcy":
        assert D(report["final_equity"]) < 0


def test_terminal_settlement_once_no_final_interval_entry_and_no_future_bar():
    sim = simulator(n=3)
    sim.submit(START, 1, 2.0, True)
    for i in range(3):
        advance(sim, bar(i))
    assert sim.ledger.position is not None
    report = sim.finish()
    assert report["trades"] == 1 and report["final_position"] == "FLAT"
    assert sim.sink.rows["trades"][0]["reason"] == "terminal_settlement"
    assert sim.finish() == report
    sim = simulator(n=3)
    for i in range(2):
        advance(sim, bar(i))
    assert not sim.submit(START + 2 * MINUTE, 1, 2.0, True)


def test_pending_latency_entry_cancelled_at_episode_end_and_gap_rejected():
    p = policy(end=START + 3 * MINUTE)
    p["execution_latency_ms"] = 600000
    sim = simulator(p=p, n=3)
    sim.submit(START, 1, 2.0, True)
    assert finish(sim)["trades"] == 0 and sim.pending is None
    with pytest.raises(ValueError, match="external_cashflow"):
        sim.apply_cashflow(100)
    sim = simulator()
    with pytest.raises(ValueError, match="noncontiguous"):
        advance(sim, bar(1))


@pytest.mark.parametrize(
    "change", ["leverage", "limit", "mark", "mode", "liquidation", "metadata", "reserve"]
)
def test_capability_gate_rejects_unsupported_requests_without_mutating_inputs(change):
    c, p, inst = config(), policy(), instrument()
    if change == "leverage":
        c["risk"]["max_leverage"] = 2
    if change == "limit":
        c["execution"]["order_type"] = "limit"
    if change == "mark":
        c["stop_loss"]["trigger_reference"] = c["execution"]["stop_trigger_reference"] = "mark"
    if change == "mode":
        c["market"]["mode"] = "real"
    if change == "liquidation":
        p["require_exchange_liquidation"] = True
    if change == "metadata":
        inst["tick_size"] = "0"
    if change == "reserve":
        p["safety_reserve"] = "1000"
    before = deepcopy(c)
    with pytest.raises((ValueError, ValidationError)):
        simulator(c, p, inst=inst)
    assert c == before


def test_unrealized_daily_breach_is_latched_before_recovery_at_next_open():
    c = config()
    c["risk"].update(daily_loss_limit="0.005", cooldown_bars=0)
    sim = simulator(c)
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0))
    sim.submit(START + MINUTE, 3, None, True)
    advance(sim, bar(1, open=99, low=98.5))
    assert sim.submit(START + 2 * MINUTE, 1, 2.0, True)
    advance(sim, bar(2, low=98.5, close=99))
    assert sim.risk.daily_latched and sim.ledger.position is not None
    assert sim.forced == "daily_loss_limit"
    advance(sim, bar(3))  # Recovery of price does not clear the close intent/latch.
    assert sim.ledger.position is None and sim.risk.daily_latched


def test_shared_risk_vectors_match_exact_utc_latch_semantics():
    vectors = strict_json((CONTRACTS / "fixtures/simulation-risk.json").read_text("utf-8"))
    for vector in vectors:
        r = config()["risk"]
        for key in ("initial_capital", "daily_loss_limit", "max_drawdown"):
            r[key] = vector[key]
        risk = RiskState(r)
        for step in vector["steps"]:
            equity = D(step["equity"])
            risk.rollover(step["time_ms"], equity)
            risk.check(equity)
            assert risk.daily_latched == step["daily_latched"]
            assert risk.drawdown_latched == step["drawdown_latched"]
            assert risk.day_start == D(step["day_start_equity"])
            assert risk.remaining(equity) == D(step["remaining"])


def test_configuration_policy_and_instrument_are_frozen_for_engine_lifetime():
    c, p, inst = config(), policy(), instrument()
    sim = simulator(c, p, inst=inst)
    c["execution"]["taker_fee_rate"] = "0.9"
    p["execution_latency_ms"] = 600000
    inst["max_market_quantity"] = "0.001"
    sim.submit(START, 1, 2.0, True)
    advance(sim, bar(0))
    assert sim.ledger.position.quantity == D("2.272")
    assert sim.ledger.fees == D("0.2272")


def test_midnight_anchor_is_sampled_before_same_timestamp_funding():
    start = START + 86400000 - MINUTE
    sim = simulator(start=start)
    sim.submit(start, 1, 2.0, True)
    advance(sim, bar(0, start=start))
    anchor = sim.ledger.wallet
    advance(sim, bar(1, start=start), D("0.001"))
    assert sim.risk.day_start == anchor
    assert sim.ledger.funding < 0
    assert sim.risk.remaining(sim.ledger.wallet) == anchor * D("0.02") + sim.ledger.funding


def test_ai_exit_rr_metadata_does_not_create_or_report_a_fixed_target():
    c = config()
    c["exit"].update(mode="AI_EXIT", fixed_tp_enabled=False, ai_close_enabled=True, rr="2")
    sim = simulator(c)
    sim.submit(START, 2, 2.0, True)
    advance(sim, bar(0))
    assert sim.ledger.position.take_profit is None
    finish(sim)
    assert sim.sink.rows["trades"][0]["target_rr"] is None
