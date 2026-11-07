"""Streaming M3 -> M4 -> single simulator; all policies consume the shared session."""

from bybit_quant.contracts import INTERVALS, validate
from bybit_quant.simulation.numeric import exact
from bybit_quant.simulation.session import DatasetSession


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
    dataset,
    c,
    normalizer,
    policy,
    start,
    end,
    *,
    actions=(),
    callback=None,
    sink=None,
    strategy=None,
):
    if callback is not None and not callable(callback):
        raise ValueError("invalid_policy_callback")
    scripts = iter(action_stream(actions, start, end, INTERVALS[c["market"]["timeframe"]]))
    session = None
    try:
        next_action = next(scripts, None)
        if (callback is not None and strategy is not None) or (
            next_action is not None and (callback is not None or strategy is not None)
        ):
            raise ValueError("callback_and_script_mutually_exclusive")
        session = DatasetSession(dataset, c, normalizer, policy, start, end, sink)
        sim = session.sim
        for frame in session.frames:
            if strategy is not None:
                strategy.observe(frame.indicators)
            if frame.time_ms < start:
                continue
            observation = frame.observation
            if strategy is not None:
                if observation["valid"]:
                    sim.submit(
                        frame.time_ms,
                        strategy.decide(frame.time_ms, frame.context),
                        frame.atr,
                        True,
                    )
            elif callback is not None:
                if observation["valid"]:
                    sim.submit(frame.time_ms, callback(frame.time_ms, observation), frame.atr, True)
            else:
                while next_action is not None and next_action["decision_ms"] <= frame.time_ms:
                    if next_action["decision_ms"] < frame.time_ms:
                        sim._reject("script_decision_not_available")
                    else:
                        sim.submit(
                            frame.time_ms, next_action["action"], frame.atr, observation["valid"]
                        )
                    next_action = next(scripts, None)
        for _ in scripts:
            pass
        return session.report
    finally:
        if session is not None:
            session.close()
        close = getattr(scripts, "close", None)
        if close:
            close()
