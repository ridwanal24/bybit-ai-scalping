"""Explicit train-scoped fit and frozen, content-addressed population z-score."""

import copy
import math
from decimal import Decimal

from bybit_quant.contracts import config_hash, digest, validate
from bybit_quant.features.schema import observation_schema


def decimal_string(value):
    if not math.isfinite(value):
        raise ValueError("nonfinite_statistics")
    text = format(Decimal(repr(value)), "f")
    result = text.rstrip("0").rstrip(".") if "." in text else text
    return "0" if result == "-0" else result


def fit(rows, c, dataset, start, end, role="train"):
    if (
        role != "train"
        or type(start) is not int
        or type(end) is not int
        or not (dataset["requested_start_ms"] <= start < end <= dataset["requested_end_ms"])
    ):
        raise ValueError("invalid_train_scope")
    schema = observation_schema(c)
    width = len(schema["schema"]["market"])
    means, m2 = [0.0] * width, [0.0] * width
    count = 0
    previous = None
    for row in rows:
        t = row["decision_ms"]
        if previous is not None and t <= previous:
            raise ValueError("nonascending_feature_rows")
        previous = t
        if not start <= t < end or row["reason"] is not None:
            continue
        if len(row["values"]) != width or not all(
            type(v) in (int, float) and math.isfinite(v) for v in row["values"]
        ):
            raise ValueError("invalid_fit_row")
        count += 1
        for i, x in enumerate(row["values"]):
            delta = x - means[i]
            means[i] += delta / count
            m2[i] += delta * (x - means[i])
    if not count:
        raise ValueError("empty_training_features")
    scales = [math.sqrt(max(0.0, value / count)) for value in m2]
    payload = {
        "version": "1",
        "algorithm": "welford_population_zscore_v1",
        "numeric": "python_float64_decimal_strings_v1",
        "feature_schema_hash": schema["sha256"],
        "configuration_hash": config_hash(c),
        "dataset_fingerprint": digest(dataset),
        "source": dataset["source"],
        "symbol": dataset["symbol"],
        "train_start_ms": start,
        "train_end_ms": end,
        "count": count,
        "means": [decimal_string(x) for x in means],
        "scales": [decimal_string(x if x else 1.0) for x in scales],
        "constant": [x == 0 for x in scales],
    }
    return Normalizer(payload)


class Normalizer:
    def __init__(self, payload, expected_id=None):
        validate("normalizer-v1", payload)
        self._payload = copy.deepcopy(payload)
        self.id = digest(payload)
        if expected_id is not None and expected_id != self.id:
            raise ValueError("normalizer_checksum")
        self.means = tuple(float(x) for x in payload["means"])
        self.scales = tuple(float(x) for x in payload["scales"])
        if not len(self.means) == len(self.scales) == len(payload["constant"]) or not (
            payload["train_start_ms"] < payload["train_end_ms"]
        ):
            raise ValueError("normalizer_shape_or_range")
        if not all(math.isfinite(x) for x in self.means) or not all(
            math.isfinite(x) and x > 0 for x in self.scales
        ):
            raise ValueError("normalizer_statistics")
        for scale, constant in zip(self.scales, payload["constant"], strict=True):
            if constant and scale != 1:
                raise ValueError("normalizer_constant_scale")

    @property
    def payload(self):
        return copy.deepcopy(self._payload)

    def bind(self, c, dataset):
        schema = observation_schema(c)
        explicit_id = c["features"]["normalization"]["artifact_id"]
        if (
            schema["sha256"] != self._payload["feature_schema_hash"]
            or len(schema["schema"]["market"]) != len(self.means)
            or dataset["source"] != self._payload["source"]
            or dataset["symbol"] != self._payload["symbol"]
            or explicit_id not in (None, self.id)
        ):
            raise ValueError("normalizer_incompatible")

    def transform(self, values):
        if len(values) != len(self.means):
            raise ValueError("normalizer_width")
        result = [
            (x - mean) / scale
            for x, mean, scale in zip(values, self.means, self.scales, strict=True)
        ]
        if not all(math.isfinite(x) for x in result):
            raise ValueError("nonfinite_transform")
        return result
