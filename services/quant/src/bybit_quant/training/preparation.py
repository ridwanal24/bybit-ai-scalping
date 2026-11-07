"""Chronological preparation; holdout is never fitted or evaluated by M8."""

from itertools import takewhile

from bybit_quant.configuration import configuration
from bybit_quant.contracts import INTERVALS, validate
from bybit_quant.features.alignment import feature_rows
from bybit_quant.features.normalization import fit
from bybit_quant.simulation.policy import capabilities


def chronological_split(start, end, interval):
    if (
        any(type(v) is not int for v in (start, end, interval))
        or interval <= 0
        or start < 0
        or start >= end
        or start % interval
        or end % interval
    ):
        raise ValueError("invalid_split_range")
    bars = (end - start) // interval
    train_bars, validation_bars = bars * 70 // 100, bars * 15 // 100
    a, b = start + train_bars * interval, start + (train_bars + validation_bars) * interval
    if min(train_bars, validation_bars, bars - train_bars - validation_bars) < 2:
        raise ValueError("insufficient_split_bars")
    split = {
        "version": "chronological_70_15_15_v1",
        "train": [start, a],
        "validation": [a, b],
        "holdout": [b, end],
        "interval_ms": interval,
        "holdout_evaluated": False,
    }
    validate("training-split-v1", split)
    return split


def validate_training(c, resources):
    c = configuration(c)
    validate("training-resources-v1", resources)
    t, network = c["training"], c["network"]
    if c["features"]["normalization"]["artifact_id"] is not None:
        raise ValueError("training_requires_train_only_fit")
    if (
        network["preset"] != "Small"
        or network["policy_layers"] != [64, 64]
        or network["value_layers"] != [64, 64]
    ):
        raise ValueError("unsupported_training_architecture")
    if (
        t["n_steps"] < 8
        or t["episode_length_bars"] < 2
        or t["n_steps"] > 2048
        or t["batch_size"] > t["n_steps"]
        or t["n_steps"] % t["batch_size"]
        or t["total_timesteps"] % t["n_steps"]
        or t["total_timesteps"] > resources["max_timesteps"]
    ):
        raise ValueError("training_rollout_or_resource_budget")
    return c


def prepare(dataset, c, policy, start, end, resources):
    c = validate_training(c, resources)
    capabilities(c, dataset.instrument(), policy, start, end)
    interval = INTERVALS[c["market"]["timeframe"]]
    stream = dataset.streams.get("last:" + c["market"]["timeframe"])
    if not stream or not stream["start_ms"] <= start < end <= stream["end_ms"]:
        raise ValueError("split_outside_dataset")
    split = chronological_split(start, end, interval)
    train_start, train_end = split["train"]
    # Stop computation at the train boundary; do not traverse validation/holdout rows.
    features = feature_rows(dataset.bind(c), c)
    rows = takewhile(lambda row: row["decision_ms"] < train_end, features)
    try:
        normalizer = fit(rows, c, dataset.manifest, train_start, train_end)
    finally:
        features.close()
    if normalizer.payload["train_end_ms"] != train_end:
        raise ValueError("normalizer_train_scope")
    normalizer.bind(c, dataset.manifest)
    return c, split, normalizer
