import math
from copy import deepcopy

import pytest
from feature_helpers import START, candles, config, flat, small_config, streams

from bybit_quant.contracts import digest, validate
from bybit_quant.features.alignment import feature_rows
from bybit_quant.features.normalization import Normalizer, fit
from bybit_quant.features.schema import observation_schema
from bybit_quant.observation import ObservationBuilder, context_values


def setup_pipeline():
    c = small_config()
    rows = list(feature_rows(streams(), c))
    manifest = {
        "requested_start_ms": START,
        "requested_end_ms": START + 120 * 60000,
        "source": "fixture",
        "symbol": "BTCUSDT",
    }
    n = fit(rows, c, manifest, START, START + 60 * 60000)
    return c, rows, manifest, n


def test_htf_boundary_and_future_mutation_prefix_invariance():
    c = small_config()
    c["features"]["enabled"] = [{"id": "body_ratio", "timeframe": "5m"}]
    data = streams()
    original = list(feature_rows(data, c))
    assert all(row["reason"] == "warm_up" for row in original[:4])
    assert original[4]["reason"] is None
    assert original[4]["values"] == [0.2]
    changed = deepcopy(data)
    for cs in changed.values():
        for candle in cs:
            if candle["close_time_ms"] > START + 60 * 60000:
                candle.update(close="200", high="210", low="90")
    assert list(feature_rows(changed, c))[:60] == original[:60]
    prefix = {
        tf: [x for x in cs if x["close_time_ms"] <= START + 60 * 60000] for tf, cs in data.items()
    }
    assert list(feature_rows(prefix, c)) == original[:60]


def test_htf_missing_and_delayed_availability_never_joins_future():
    c = small_config()
    c["features"]["enabled"] = [{"id": "body_ratio", "timeframe": "5m"}]
    data = streams()
    data["5m"].pop(1)
    rows = list(feature_rows(data, c))
    assert rows[9]["reason"] == "stale"
    assert rows[14]["reason"] == "gap"
    data = streams()
    data["5m"][0]["available_at_ms"] = START + 6 * 60000
    rows = list(feature_rows(data, c))
    assert rows[4]["reason"] == "warm_up"
    assert rows[5]["reason"] is None


def test_delayed_main_blocks_dependent_rows_fit_and_observations_until_available():
    c = small_config()
    c["features"]["enabled"] = [{"id": "ema_fast_distance", "timeframe": "1m"}]
    data = candles(6)
    data[0]["available_at_ms"] = START + 3 * 60000
    rows = list(feature_rows({"1m": data}, c))
    assert [r["reason"] for r in rows[:2]] == ["stale", "stale"]
    assert [r["values"] for r in rows[:2]] == [[None], [None]]
    assert all(row["reason"] is None for row in rows[2:])
    m = {
        "requested_start_ms": START,
        "requested_end_ms": START + 7 * 60000,
        "source": "fixture",
        "symbol": "BTCUSDT",
    }
    n = fit(rows, c, m, START, START + 7 * 60000)
    assert n.payload["count"] == 4
    builder = ObservationBuilder(c, m, n)
    results = [builder.push(row, flat(row["decision_ms"])) for row in rows]
    assert [r["valid"] for r in results] == [False, False, False, True, True, True]
    assert list(feature_rows({"1m": data[:2]}, c)) == rows[:2]


def test_main_availability_at_close_preserves_historical_results():
    c = small_config()
    original = streams()
    explicit = deepcopy(original)
    for candle in explicit["1m"]:
        candle["available_at_ms"] = candle["close_time_ms"]
    assert list(feature_rows(explicit, c)) == list(feature_rows(original, c))


@pytest.mark.parametrize("available", [START, True, "invalid", None, 9007199254740992])
def test_main_availability_invalid_values_are_rejected(available):
    c = small_config()
    bar = candles(1)[0]
    bar["available_at_ms"] = available
    with pytest.raises(ValueError, match="invalid_availability"):
        list(feature_rows({"1m": [bar]}, c))


def test_train_only_statistics_invariant_to_future_and_heldout_transform_is_frozen():
    c, rows, manifest, normalizer = setup_pipeline()
    changed = deepcopy(rows)
    for row in changed:
        if row["decision_ms"] >= START + 60 * 60000 and row["reason"] is None:
            row["values"] = [1000000] * len(row["values"])
    other = fit(changed, c, manifest, START, START + 60 * 60000)
    assert other.payload == normalizer.payload and other.id == normalizer.id
    before = normalizer.payload
    normalizer.transform(changed[-1]["values"])
    assert normalizer.payload == before
    before["means"][0] = "999"
    assert normalizer.payload != before


@pytest.mark.parametrize(
    "role,start,end",
    [
        ("validation", START, START + 60000),
        ("live", START, START + 60000),
        ("train", START - 1, START + 60000),
        ("train", START, START),
        ("train", True, START + 60000),
    ],
)
def test_invalid_fit_role_and_range(role, start, end):
    c, rows, manifest, _ = setup_pipeline()
    with pytest.raises(ValueError, match="invalid_train_scope"):
        fit(rows, c, manifest, start, end, role)


def test_constant_normalizer_empty_fit_corruption_and_reorder():
    c, rows, manifest, n = setup_pipeline()
    with pytest.raises(ValueError, match="empty_training"):
        fit(rows, c, manifest, START, START + 60000)
    same = deepcopy(rows)
    for row in same:
        if row["reason"] is None:
            row["values"] = [2.0] * 9
    constant = fit(same, c, manifest, START, START + 60 * 60000)
    assert constant.payload["scales"] == ["1"] * 9
    assert constant.transform([2.0] * 9) == [0.0] * 9
    broken = n.payload
    broken["means"][0] = "5"
    with pytest.raises(ValueError, match="checksum"):
        Normalizer(broken, n.id)
    c["features"]["enabled"].reverse()
    with pytest.raises(ValueError, match="incompatible"):
        n.bind(c, manifest)


def test_observation_values_order_context_is_current_only_and_schema_valid():
    c, rows, manifest, n = setup_pipeline()
    builder = ObservationBuilder(c, manifest, n)
    results = [builder.push(row, flat(row["decision_ms"])) for row in rows]
    valid = [row for row in results if row["valid"]]
    assert valid
    result = valid[-1]
    validate("observation-result-v1", result)
    assert len(result["values"]) == 2 * 9 + 11
    assert result["values"][-11:] == pytest.approx([0, 0, 0, 0, 0, 0, 1, 0, 0.02, 1, 0.005])
    reference = n.transform(rows[-2]["values"]) + n.transform(rows[-1]["values"])
    assert result["values"][:18] == pytest.approx(reference, rel=1e-6, abs=1e-6)


@pytest.mark.parametrize("side,sign", [("LONG", 1), ("SHORT", -1)])
def test_long_short_context_scaling_and_drawdown(side, sign):
    ctx = flat(START)
    ctx.update(
        side=side,
        entry=100,
        quantity=2,
        mark=110,
        stop=95,
        take_profit=120,
        duration_bars=480,
        equity=950,
        available_margin=950,
        high_water_equity=1000,
    )
    values = context_values(ctx, config(), START)
    assert values[:7] == pytest.approx([sign, sign * 0.02, 2, 15 / 110, 10 / 110, 0.22, 0.95])
    assert values[7] == pytest.approx(0.05)


def test_ai_exit_optional_tp_and_bad_contexts_block_valid_observation():
    c, rows, manifest, n = setup_pipeline()
    ctx = flat(rows[-1]["decision_ms"])
    for mutation in (
        {"as_of_ms": ctx["as_of_ms"] + 1},
        {"side": "LONG"},
        {"quantity": 1},
        {"equity": float("nan")},
        {"mark": 1e-45},
        {"available_margin": 1e100},
        {"unknown": True},
    ):
        builder = ObservationBuilder(c, manifest, n)
        for row in rows[:-1]:
            builder.push(row, flat(row["decision_ms"]))
        result = builder.push(rows[-1], {**ctx, **mutation})
        # Tiny positive mark with FLAT state is valid; no artificial denominator floor.
        assert result["valid"] == (mutation == {"mark": 1e-45})
    c["exit"].update(mode="AI_EXIT", fixed_tp_enabled=False, ai_close_enabled=True, rr=None)
    ctx.update(side="LONG", entry=100, quantity=1, stop=95)
    assert context_values(ctx, c, ctx["as_of_ms"])[4] == 0


def test_missing_context_artifact_incompatible_and_gap_return_unavailable():
    c, rows, manifest, n = setup_pipeline()
    good = [row for row in rows if row["reason"] is None]
    assert ObservationBuilder(c, manifest, None).push(good[0], None)["reason"] == "missing_artifact"
    changed = deepcopy(c)
    changed["features"]["normalization"]["artifact_id"] = "0" * 64
    assert ObservationBuilder(changed, manifest, n).push(good[0], None)["reason"] == "incompatible"
    builder = ObservationBuilder(c, manifest, n)
    builder.push(good[0], None)
    assert builder.push(good[1], None)["reason"] == "missing_context"
    assert builder.push(good[3], None)["reason"] == "gap"


def test_every_enabled_feature_and_permutation_enters_observation():
    c = small_config()
    names = list(__import__("test_indicators").GOLDEN)
    c["features"]["enabled"] = [{"id": name, "timeframe": "1m"} for name in names]
    rows = list(feature_rows({"1m": candles(100)}, c))
    m = {
        "requested_start_ms": START,
        "requested_end_ms": START + 100 * 60000,
        "source": "fixture",
        "symbol": "BTCUSDT",
    }
    n = fit(rows, c, m, START, START + 50 * 60000)
    b = ObservationBuilder(c, m, n)
    result = [b.push(row, flat(row["decision_ms"])) for row in rows][-1]
    assert result["valid"] and len(result["values"]) == 2 * 23 + 11
    assert result["schema_hash"] == observation_schema(c)["sha256"]
    assert digest(n.payload) == n.id


def test_normalization_matches_known_population_statistics():
    c = small_config()
    c["features"]["enabled"] = [{"id": "percentage_return", "timeframe": "1m"}]
    m = {
        "requested_start_ms": START,
        "requested_end_ms": START + 10 * 60000,
        "source": "fixture",
        "symbol": "BTCUSDT",
    }
    rows = [
        {"decision_ms": START + i * 60000, "values": [x], "reason": None}
        for i, x in enumerate([1.0, 2.0, 3.0])
    ]
    n = fit(rows, c, m, START, START + 3 * 60000)
    assert n.means == (2.0,)
    assert n.scales == pytest.approx((math.sqrt(2 / 3),))
    assert n.transform([3.0]) == pytest.approx([math.sqrt(1.5)])


def test_observations_are_prefix_invariant_with_frozen_artifact():
    c, rows, manifest, n = setup_pipeline()

    def replay(items):
        builder = ObservationBuilder(c, manifest, n)
        return [builder.push(row, flat(row["decision_ms"])) for row in items]

    assert replay(rows[:80]) == replay(rows)[:80]


@pytest.mark.parametrize(
    "key,value",
    [("remaining_daily_budget", 21), ("high_water_equity", 999), ("available_margin", 1001)],
)
def test_context_financial_anchors_must_be_consistent(key, value):
    context = flat(START)
    context[key] = value
    with pytest.raises(ValueError):
        context_values(context, config(), START)
