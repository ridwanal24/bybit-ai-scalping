"""Synthetic simulator fixtures: no exchange account or real-order behavior."""

from feature_helpers import START, small_config

from bybit_quant.simulation.engine import Simulator

MINUTE = 60000


def config():
    c = small_config()
    c["features"]["enabled"] = [{"id": "body_ratio", "timeframe": "1m"}]
    c["execution"].update(spread_bps="0", slippage_bps="0")
    c["stop_loss"].update(atr_multiplier="1", slippage_allowance_bps="0")
    return c


def instrument():
    return {
        "schema_version": "1",
        "source": "fixture",
        "category": "linear",
        "symbol": "BTCUSDT",
        "contract_type": "LinearPerpetual",
        "settlement": "USDT",
        "status": "Trading",
        "launch_time_ms": 0,
        "delivery_time_ms": 0,
        "tick_size": "0.1",
        "quantity_step": "0.001",
        "min_quantity": "0.001",
        "min_notional": "5",
        "max_limit_quantity": "100",
        "max_market_quantity": "10",
        "min_leverage": "1",
        "max_leverage": "100",
        "leverage_step": "0.01",
        "funding_interval_minutes": 480,
        "historical_validity": "current_observation_reference_only",
    }


def policy(start=START, end=START + 12 * MINUTE):
    return {
        "simulation_policy_version": "restricted_bar_v1",
        "acknowledge_research_only": True,
        "acknowledge_current_metadata": True,
        "acknowledge_declared_funding_schedule": True,
        "require_exchange_liquidation": False,
        "funding_price_proxy": "boundary_last_open",
        "execution_latency_ms": 0,
        "safety_reserve": "0",
        "funding_schedule": [
            {"start_ms": start, "end_ms": end, "interval_ms": 28800000, "anchor_ms": 0}
        ],
    }


def bar(i, *, start=START, open=100, high=100.5, low=99.5, close=100):
    return {
        "schema_version": "1",
        "source": "fixture",
        "category": "linear",
        "symbol": "BTCUSDT",
        "price_type": "last",
        "timeframe": "1m",
        "open_time_ms": start + i * MINUTE,
        "close_time_ms": start + (i + 1) * MINUTE,
        "open": str(open),
        "high": str(high),
        "low": str(low),
        "close": str(close),
        "volume": "1",
        "turnover": "100",
        "availability_policy": "closed_candle_assumption_v1",
    }


def simulator(c=None, p=None, n=12, start=START, inst=None):
    return Simulator(
        c or config(),
        inst or instrument(),
        p or policy(start, start + n * MINUTE),
        start,
        start + n * MINUTE,
    )


def advance(sim, candle, rate=None):
    if sim.begin_bar(candle, rate):
        sim.end_bar(candle)


def finish(sim):
    while sim.status == "running" and sim.decision_time < sim.end:
        advance(sim, bar(sim.market.index + 1, start=sim.start))
    return sim.finish()
