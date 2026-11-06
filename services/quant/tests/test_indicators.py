import math
from fractions import Fraction

import pytest
from feature_helpers import candles, small_config

from bybit_quant.contracts import CONTRACTS, strict_json
from bybit_quant.features.indicators import Indicators

# Eight hand-tabulated candles; rational EMA/Wilder reference values are exact.
GOLDEN = {
    "log_return": math.log(1.25),
    "percentage_return": 0.25,
    "body_ratio": 0.2,
    "upper_wick_ratio": 0.4,
    "lower_wick_ratio": 0.4,
    "range_fraction": 0.25,
    "close_location": 0.6,
    "rolling_return": "1/9",
    "ema_fast_distance": "307/4553",
    "ema_slow_distance": "33/287",
    "ema_long_distance": "438/2687",
    "ema_spread": "3107/77760",
    "ema_slope": "614/3939",
    "rsi": "17000/207",
    "macd_line": "3107/3888",
    "macd_signal": "4001/5832",
    "macd_histogram": "1319/11664",
    "atr": "181/32",
    "atr_fraction": "181/640",
    "volatility": abs(math.log(1.25) - math.log(8 / 9)) / 2,
    "volume_change": "1/7",
    "relative_volume": "16/13",
    "volume_ma_ratio": "16/15",
}


@pytest.mark.parametrize("name,expected", GOLDEN.items())
def test_all_23_features_match_independent_rational_reference(name, expected):
    engine = Indicators(small_config()["features"]["periods"], "1m")
    rows = [engine.push(c) for c in candles(closes=[10, 12, 11, 15, 14, 18, 16, 20])]
    target = float(Fraction(expected)) if isinstance(expected, str) else expected
    assert rows[-1]["values"][name] == pytest.approx(target, rel=1e-12, abs=1e-12)
    catalog = strict_json((CONTRACTS / "fixtures/feature-catalog.json").read_text("utf-8"))
    assert set(GOLDEN) == set(catalog["formulas"])


def test_first_valid_indices_seed_and_warmup():
    engine = Indicators(small_config()["features"]["periods"], "1m")
    rows = [engine.push(c)["values"] for c in candles(10)]
    expected = {
        "ema_fast_distance": 1,
        "ema_slow_distance": 2,
        "ema_long_distance": 3,
        "ema_slope": 2,
        "rsi": 2,
        "atr": 2,
        "macd_line": 2,
        "macd_signal": 3,
        "log_return": 1,
        "rolling_return": 2,
        "volatility": 2,
        "relative_volume": 2,
        "volume_ma_ratio": 1,
    }
    for name, first in expected.items():
        assert all(name not in row for row in rows[:first]), name
        assert name in rows[first], name


@pytest.mark.parametrize(
    "closes,expected", [([10] * 8, 50), (list(range(10, 18)), 100), (list(range(18, 10, -1)), 0)]
)
def test_rsi_flat_gain_only_loss_only(closes, expected):
    engine = Indicators(small_config()["features"]["periods"], "1m")
    result = [engine.push(c) for c in candles(closes=closes)][-1]
    assert result["values"]["rsi"] == expected


def test_zero_range_and_zero_volume_have_explicit_policy():
    engine = Indicators(small_config()["features"]["periods"], "1m")
    for c in candles(5):
        c.update(open="10", high="10", low="10", close="10", volume="0")
        row = engine.push(c)
    assert row["values"]["body_ratio"] == 0
    assert row["values"]["close_location"] == 0.5
    assert row["values"]["atr"] == 0
    assert not {"volume_change", "relative_volume", "volume_ma_ratio"} & row["values"].keys()


def test_gap_resets_and_duplicate_or_invalid_price_rejected():
    engine = Indicators(small_config()["features"]["periods"], "1m")
    cs = candles(10)
    for c in cs[:4]:
        engine.push(c)
    result = engine.push(cs[6])
    assert result["gap"] and "rsi" not in result["values"]
    with pytest.raises(ValueError, match="nonascending"):
        engine.push(cs[6])
    cs[7]["close"] = "Infinity"
    with pytest.raises(ValueError):
        engine.push(cs[7])


def test_period_one_and_huge_period_do_not_preallocate():
    p = small_config()["features"]["periods"]
    p.update(rsi=1, atr=1, volume=1, volatility=1, rolling_return=1, ema_long=9007199254740991)
    engine = Indicators(p, "1m")
    rows = [engine.push(c) for c in candles(3)]
    assert rows[-1]["values"]["volatility"] == 0
    assert "ema_long_distance" not in rows[-1]["values"]
