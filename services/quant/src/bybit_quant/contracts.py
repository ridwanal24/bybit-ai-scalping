"""Shared strict JSON, schema and canonical configuration utilities."""

import hashlib
import json
import re
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator

CONTRACTS = Path(__file__).resolve().parents[4] / "packages" / "contracts"
INTERVALS = {
    "1m": 60000,
    "3m": 180000,
    "5m": 300000,
    "15m": 900000,
    "30m": 1800000,
    "1h": 3600000,
    "4h": 14400000,
    "1D": 86400000,
}


def strict_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("duplicate_json_key")
            result[key] = value
        return result

    def invalid(_):
        raise ValueError("nonfinite_json")

    return json.loads(data, object_pairs_hook=pairs, parse_constant=invalid)


@lru_cache
def validator(name):
    schema = strict_json((CONTRACTS / "schemas" / f"{name}.schema.json").read_text("utf-8"))
    return Draft202012Validator(schema)


def validate(name, value):
    validator(name).validate(value)


def canonical(value):
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def config_canonical(value):
    fields = set(
        strict_json((CONTRACTS / "fixtures/canonical-rules.json").read_text("utf-8"))[
            "decimal_fields"
        ]
    )

    def visit(item, field=""):
        if isinstance(item, dict):
            return {key: visit(val, key) for key, val in item.items()}
        if isinstance(item, list):
            return [visit(val) for val in item]
        # JSON 1 and 1.0 are the same JS number; config numeric fields are integral.
        if type(item) is float and item.is_integer():
            return int(item)
        if (
            isinstance(item, str)
            and field in fields
            and re.fullmatch(r"-?(0|[1-9][0-9]{0,17})(\.[0-9]{1,18})?", item)
        ):
            result = item.rstrip("0").rstrip(".") if "." in item else item
            return "0" if result == "-0" else result
        return item

    return visit(value)


def config_hash(value):
    return digest(config_canonical(value))
