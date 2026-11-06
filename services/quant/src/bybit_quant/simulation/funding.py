"""Streaming declared schedule validation. No missing-event zero fill/interpolation."""

from copy import deepcopy

from bybit_quant.contracts import INTERVALS, validate
from bybit_quant.simulation.numeric import decimal


class FundingCalendar:
    def __init__(self, policy, config, manifest, record_factory):
        validate("simulation-policy-v1", policy)
        self.segments = deepcopy(policy["funding_schedule"])
        self.mode = config["execution"]["funding"]["mode"]
        self.fixed_rate = config["execution"]["funding"]["rate"]
        self.record_factory = record_factory
        start, end = manifest["requested_start_ms"], manifest["requested_end_ms"]
        interval = INTERVALS[config["market"]["timeframe"]]
        cursor = start
        for segment in self.segments:
            if (
                segment["start_ms"] != cursor
                or segment["start_ms"] >= segment["end_ms"]
                or (
                    segment["end_ms"] > end
                    or any(
                        segment[key] % interval
                        for key in ("start_ms", "end_ms", "interval_ms", "anchor_ms")
                    )
                )
            ):
                raise ValueError("unsupported_or_noncontiguous_funding_schedule")
            cursor = segment["end_ms"]
        if cursor != end:
            raise ValueError("funding_schedule_range_mismatch")
        # Complete preflight before any financial state can change.
        for _ in self.events():
            pass

    def times(self):
        for segment in self.segments:
            start, end, interval, anchor = (
                segment[k] for k in ("start_ms", "end_ms", "interval_ms", "anchor_ms")
            )
            first = anchor + ((start - anchor + interval - 1) // interval) * interval
            yield from range(first, end, interval)

    def events(self):
        records = iter(self.record_factory()) if self.mode == "historical" else iter(())
        for t in self.times():
            if self.mode == "historical":
                row = next(records, None)
                if row is None:
                    raise ValueError("missing_declared_funding_event")
                validate("funding-v1", row)
                if row["timestamp_ms"] != t:
                    raise ValueError("funding_schedule_event_mismatch")
                rate = decimal(row["rate"])
            else:
                rate = decimal(self.fixed_rate)
            if not -1 < rate < 1:
                raise ValueError("unsupported_funding_rate")
            yield t, rate
        if next(records, None) is not None:
            raise ValueError("extra_funding_event")
