"""Streaming backward as-of join; missing expected HTF close never fills forward."""

from bybit_quant.contracts import INTERVALS
from bybit_quant.features.indicators import Indicators


def feature_rows(streams, c):
    main = c["market"]["timeframe"]
    required = {f["timeframe"] for f in c["features"]["enabled"]} | {main}
    engines = {tf: Indicators(c["features"]["periods"], tf) for tf in required}
    iterators = {tf: iter(streams.get(tf, ())) for tf in required if tf != main}
    lookahead = {tf: next(it, None) for tf, it in iterators.items()}
    latest = {}
    for candle in streams.get(main, ()):
        row = engines[main].push(candle)
        t = row["decision_ms"]
        latest[main] = row
        reason = "gap" if row["gap"] else None
        for tf, iterator in iterators.items():
            candidate = lookahead[tf]
            while (
                candidate is not None
                and candidate.get("available_at_ms", candidate["close_time_ms"]) <= t
            ):
                latest[tf] = engines[tf].push(candidate, candidate.get("available_at_ms"))
                candidate = next(iterator, None)
            lookahead[tf] = candidate
            expected = t // INTERVALS[tf] * INTERVALS[tf]
            if tf not in latest:
                reason = reason or "warm_up"
            elif latest[tf]["decision_ms"] != expected:
                reason = reason or "stale"
            elif latest[tf]["gap"]:
                reason = reason or "gap"
        values = []
        for item in c["features"]["enabled"]:
            value = latest.get(item["timeframe"], {}).get("values", {}).get(item["id"])
            if value is None:
                reason = reason or "warm_up"
            values.append(value)
        yield {"decision_ms": t, "values": values, "reason": reason}
