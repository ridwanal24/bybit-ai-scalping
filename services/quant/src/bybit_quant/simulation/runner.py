"""Streaming M3 -> M4 -> single simulator. Policy callbacks see closed observations only."""

from bybit_quant.contracts import INTERVALS, validate
from bybit_quant.features.alignment import feature_rows
from bybit_quant.features.indicators import Indicators
from bybit_quant.observation import ObservationBuilder
from bybit_quant.simulation.engine import Simulator
from bybit_quant.simulation.funding import FundingCalendar
from bybit_quant.simulation.numeric import decimal, exact


def action_stream(records, start, end, interval):
    previous = None
    for row in records:
        validate("simulation-action-v1", row)
        t = row["decision_ms"]
        if (
            type(t) is not int
            or type(row["action"]) is not int
            or not start <= t < end
            or (t % interval or previous is not None and t <= previous)
        ):
            raise ValueError("invalid_script_order_or_range")
        previous = t
        yield row


@exact
def run_dataset(
    dataset, c, normalizer, policy, start, end, *, actions=(), callback=None, sink=None
):
    if callback is not None and not callable(callback):
        raise ValueError("invalid_policy_callback")
    sim = Simulator(c, dataset.instrument(), policy, start, end, sink)
    c = sim.c
    main = c["market"]["timeframe"]
    descriptor = dataset.streams.get("last:" + main)
    if not descriptor or not descriptor["start_ms"] <= start < end <= descriptor["end_ms"]:
        raise ValueError("episode_outside_available_stream")
    normalizer.bind(c, dataset.manifest)
    streams = dataset.bind(c)
    calendar = FundingCalendar(policy, c, dataset.manifest, dataset.funding)
    funding = iter(calendar.events())
    next_funding = next(funding, None)
    features = iter(feature_rows(streams, c))
    atr_engine = Indicators(c["features"]["periods"], main)
    builder = ObservationBuilder(c, dataset.manifest, normalizer)
    scripts = iter(action_stream(actions, start, end, INTERVALS[main]))
    next_action = next(scripts, None)
    if callback is not None and next_action is not None:
        raise ValueError("callback_and_script_mutually_exclusive")
    try:
        for bar in dataset.candles(main):
            opened, closed = bar["open_time_ms"], bar["close_time_ms"]
            if opened >= end:
                break
            if opened >= start:
                while next_funding is not None and next_funding[0] < opened:
                    next_funding = next(funding, None)
                rate = (
                    next_funding[1]
                    if next_funding is not None and next_funding[0] == opened
                    else None
                )
                if rate is not None:
                    next_funding = next(funding, None)
                if not sim.begin_bar(bar, rate) or not sim.end_bar(bar):
                    break
            # ATR is advanced only after executions for this bar; entry intent freezes it.
            atr = atr_engine.push(bar)["values"].get("atr")
            row = next(features)
            if row["decision_ms"] != closed:
                raise ValueError("feature_market_timestamp_mismatch")
            context = sim.context(closed, decimal(bar["close"]))
            observation = builder.push(row, context)
            if closed < start or closed >= end:
                continue
            if observation["valid"]:
                sim.valid_observations += 1
            else:
                reason = observation["reason"]
                sim.unavailable[reason] += 1
            if callback is not None:
                if observation["valid"]:
                    sim.submit(closed, callback(closed, observation), atr, True)
            else:
                while next_action is not None and next_action["decision_ms"] <= closed:
                    if next_action["decision_ms"] < closed:
                        sim._reject("script_decision_not_available")
                    else:
                        sim.submit(closed, next_action["action"], atr, observation["valid"])
                    next_action = next(scripts, None)
        # Exhaust validation readers, never execute out-of-episode cashflows/actions.
        for _ in funding:
            pass
        for _ in scripts:
            pass
        report = sim.finish()
        dataset.verify_files()
        return report
    finally:
        for iterator in (features, funding, scripts):
            close = getattr(iterator, "close", None)
            if close:
                close()
