"""One incremental M3 -> M4 -> M5 timeline for scripted, baseline and Gym callers."""

from dataclasses import dataclass

from bybit_quant.features.alignment import feature_rows
from bybit_quant.features.indicators import Indicators
from bybit_quant.observation import ObservationBuilder
from bybit_quant.simulation.engine import Simulator
from bybit_quant.simulation.funding import FundingCalendar
from bybit_quant.simulation.numeric import D, decimal, exact


@dataclass(frozen=True)
class DecisionFrame:
    time_ms: int
    reference: D
    atr: float | None
    indicators: dict
    observation: dict
    context: dict | None


class DatasetSession:
    @exact
    def __init__(self, dataset, c, normalizer, policy, start, end, sink=None):
        self.dataset = dataset
        self.sim = Simulator(c, dataset.instrument(), policy, start, end, sink)
        c = self.sim.c
        self.main = c["market"]["timeframe"]
        descriptor = dataset.streams.get("last:" + self.main)
        if not descriptor or not descriptor["start_ms"] <= start < end <= descriptor["end_ms"]:
            raise ValueError("episode_outside_available_stream")
        normalizer.bind(c, dataset.manifest)
        self.builder = ObservationBuilder(c, dataset.manifest, normalizer)
        self.atr_engine = Indicators(c["features"]["periods"], self.main)
        calendar = FundingCalendar(policy, c, dataset.manifest, dataset.funding)
        self.funding = iter(calendar.events())
        self.features = iter(feature_rows(dataset.bind(c), c))
        self.bars = iter(dataset.candles(self.main))
        self.frames = self._frames()
        self.report = None
        self.terminal_observation = None
        self.time_ms = start

    def close(self):
        self.frames.close()
        for iterator in (self.features, self.funding, self.bars):
            close = getattr(iterator, "close", None)
            if close:
                close()

    def _frames(self):
        sim = self.sim
        try:
            next_funding = next(self.funding, None)
            for bar in self.bars:
                opened, closed = bar["open_time_ms"], bar["close_time_ms"]
                if opened >= sim.end:
                    break
                if opened >= sim.start:
                    while next_funding is not None and next_funding[0] < opened:
                        next_funding = next(self.funding, None)
                    rate = next_funding[1] if next_funding and next_funding[0] == opened else None
                    if rate is not None:
                        next_funding = next(self.funding, None)
                    if not sim.begin_bar(bar, rate) or not sim.end_bar(bar):
                        self.time_ms = sim.journal.time_ms
                        break
                indicators = self.atr_engine.push(bar)
                row = next(self.features)
                if row["decision_ms"] != closed:
                    raise ValueError("feature_market_timestamp_mismatch")
                reference = decimal(bar["close"])
                self.time_ms = closed
                if closed == sim.end:
                    self.report = sim.finish()
                    self.terminal_observation = self.builder.push(
                        row, sim.context(closed, reference)
                    )
                    break
                context = sim.context(closed, reference)
                observation = self.builder.push(row, context)
                if closed >= sim.start:
                    if observation["valid"]:
                        sim.valid_observations += 1
                    else:
                        sim.unavailable[observation["reason"]] += 1
                yield DecisionFrame(
                    closed,
                    reference,
                    indicators["values"].get("atr"),
                    indicators,
                    observation,
                    context,
                )
            for _ in self.funding:
                pass
            if self.report is None:
                self.report = sim.finish()
            self.dataset.verify_files()
        finally:
            for iterator in (self.features, self.funding, self.bars):
                close = getattr(iterator, "close", None)
                if close:
                    close()
