"""Fail-closed capability and explicit research-assumption gates."""

from bybit_quant.configuration import configuration
from bybit_quant.contracts import INTERVALS, validate
from bybit_quant.simulation.numeric import cash, decimal, exact


@exact
def capabilities(c, instrument, policy, start, end):
    c = configuration(c)
    validate("simulation-policy-v1", policy)
    validate("instrument-v1", instrument)
    interval = INTERVALS[c["market"]["timeframe"]]
    if c["market"]["mode"] != "backtest" or c["execution"]["order_type"] != "market":
        raise ValueError("unsupported_execution_mode")
    if c["risk"]["max_leverage"] != 1:
        raise ValueError("unsupported_leverage")
    if c["stop_loss"]["trigger_reference"] != "last":
        raise ValueError("unsupported_trigger_reference")
    if (
        any(
            type(t) is not int or t < 0 or t > 9007199254740991 or t % interval
            for t in (start, end)
        )
        or start >= end
        or not (
            c["market"]["historical_start_ms"] <= start < end <= c["market"]["historical_end_ms"]
        )
    ):
        raise ValueError("invalid_episode_range")
    if instrument["symbol"] != c["market"]["symbol"]:
        raise ValueError("instrument_symbol_mismatch")
    for field in (
        "tick_size",
        "quantity_step",
        "min_quantity",
        "max_market_quantity",
        "max_limit_quantity",
        "min_leverage",
        "max_leverage",
        "leverage_step",
    ):
        if decimal(instrument[field]) <= 0:
            raise ValueError("invalid_instrument_constraints")
    if not decimal(instrument["min_leverage"]) <= 1 <= decimal(instrument["max_leverage"]) or (
        decimal(instrument["min_quantity"]) > decimal(instrument["max_market_quantity"])
        or decimal(instrument["min_notional"]) < 0
    ):
        raise ValueError("invalid_instrument_constraints")
    reserve = decimal(policy["safety_reserve"])
    if reserve < 0 or reserve >= decimal(c["risk"]["initial_capital"]) or cash(reserve) != reserve:
        raise ValueError("invalid_safety_reserve")
    return c
