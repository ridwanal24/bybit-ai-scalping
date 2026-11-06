"""SMA-seeded EMA, Wilder averages and bounded causal rolling features."""

import math
import statistics
from collections import deque

from jsonschema.exceptions import ValidationError

from bybit_quant.contracts import INTERVALS, validate


class Average:
    def __init__(self, period, wilder=False):
        self.period = period
        self.alpha = 1 / period if wilder else 2 / (period + 1)
        self.count = 0
        self.total = 0.0
        self.value = None

    def push(self, value):
        if self.value is None:
            self.count += 1
            self.total += value
            if self.count == self.period:
                self.value = self.total / self.period
        else:
            self.value += self.alpha * (value - self.value)
        return self.value


class Indicators:
    def __init__(self, periods, timeframe):
        self.p = periods
        self.interval = INTERVALS[timeframe]
        self.timeframe = timeframe
        self.reset()

    def reset(self):
        self.previous = None
        self.previous_time = None
        self.previous_ema = None
        self.averages = {
            key: Average(self.p[key])
            for key in ("ema_fast", "ema_slow", "ema_long", "macd_fast", "macd_slow", "macd_signal")
        }
        self.gain = Average(self.p["rsi"], True)
        self.loss = Average(self.p["rsi"], True)
        self.atr = Average(self.p["atr"], True)
        self.closes = deque(maxlen=self.p["rolling_return"] + 1)
        self.returns = deque(maxlen=self.p["volatility"])
        self.volumes = deque(maxlen=self.p["volume"])

    def push(self, candle, available_at_ms=None):
        try:
            validate(
                "market-candle-v1",
                {key: value for key, value in candle.items() if key != "available_at_ms"},
            )
        except ValidationError:
            raise ValueError("invalid_candle_schema") from None
        t = candle["open_time_ms"]
        if candle["timeframe"] != self.timeframe or candle["price_type"] != "last":
            raise ValueError("invalid_feature_stream")
        if t % self.interval or candle["close_time_ms"] != t + self.interval:
            raise ValueError("invalid_candle_time")
        gap = self.previous_time is not None and t != self.previous_time + self.interval
        if self.previous_time is not None and t <= self.previous_time:
            raise ValueError("nonascending_candles")
        if gap:
            self.reset()
        o, h, low, close, volume = [
            float(candle[key]) for key in ("open", "high", "low", "close", "volume")
        ]
        if not all(math.isfinite(v) for v in (o, h, low, close, volume)) or not (
            0 < low <= min(o, close) <= max(o, close) <= h and volume >= 0
        ):
            raise ValueError("invalid_candle_value")
        values = {}
        width = h - low
        values.update(
            body_ratio=(close - o) / width if width else 0.0,
            upper_wick_ratio=(h - max(o, close)) / width if width else 0.0,
            lower_wick_ratio=(min(o, close) - low) / width if width else 0.0,
            range_fraction=width / close,
            close_location=(close - low) / width if width else 0.5,
        )
        if self.previous is not None:
            prev_close, prev_volume = self.previous
            change = close - prev_close
            ret = math.log(close / prev_close)
            values.update(log_return=ret, percentage_return=close / prev_close - 1)
            self.returns.append(ret)
            gain, loss = self.gain.push(max(change, 0)), self.loss.push(max(-change, 0))
            if gain is not None:
                values["rsi"] = (
                    50.0
                    if gain == loss == 0
                    else (100.0 if loss == 0 else 100 - 100 / (1 + gain / loss))
                )
            atr = self.atr.push(max(width, abs(h - prev_close), abs(low - prev_close)))
            if atr is not None:
                values.update(atr=atr, atr_fraction=atr / close)
            if prev_volume:
                values["volume_change"] = volume / prev_volume - 1
        self.closes.append(close)
        if len(self.closes) == self.p["rolling_return"] + 1:
            values["rolling_return"] = close / self.closes[0] - 1
        if len(self.returns) == self.p["volatility"]:
            values["volatility"] = statistics.pstdev(self.returns)
        if len(self.volumes) == self.p["volume"]:
            mean = statistics.fmean(self.volumes)
            if mean:
                values["relative_volume"] = volume / mean
        self.volumes.append(volume)
        if len(self.volumes) == self.p["volume"]:
            mean = statistics.fmean(self.volumes)
            if mean:
                values["volume_ma_ratio"] = volume / mean
        averages = {
            key: avg.push(close) for key, avg in self.averages.items() if key != "macd_signal"
        }
        for name in ("fast", "slow", "long"):
            avg = averages[f"ema_{name}"]
            if avg is not None:
                values[f"ema_{name}_distance"] = close / avg - 1
        fast, slow = averages["ema_fast"], averages["ema_slow"]
        if fast is not None and slow is not None:
            values["ema_spread"] = (fast - slow) / close
        if fast is not None and self.previous_ema is not None:
            values["ema_slope"] = fast / self.previous_ema - 1
        mf, ms = averages["macd_fast"], averages["macd_slow"]
        if mf is not None and ms is not None:
            line = mf - ms
            values["macd_line"] = line
            signal = self.averages["macd_signal"].push(line)
            if signal is not None:
                values.update(macd_signal=signal, macd_histogram=line - signal)
        if not all(math.isfinite(value) for value in values.values()):
            raise ValueError("invalid_feature_value")
        self.previous, self.previous_ema, self.previous_time = (close, volume), fast, t
        close_time = candle["close_time_ms"]
        available = close_time if available_at_ms is None else available_at_ms
        if type(available) is not int or available < close_time:
            raise ValueError("invalid_availability")
        return {
            "decision_ms": close_time,
            "available_at_ms": available,
            "values": values,
            "gap": gap,
        }
