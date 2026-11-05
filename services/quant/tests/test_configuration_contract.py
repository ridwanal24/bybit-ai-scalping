"""Structural validation only; semantic risk/trading parity is a later quant gate."""

import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator

CONTRACTS = Path(__file__).resolve().parents[3] / "packages" / "contracts"


def read(relative):
    return json.loads((CONTRACTS / relative).read_text(encoding="utf-8"))


def test_shared_json_schema_accepts_and_rejects_structural_fixtures():
    schema = read("schemas/configuration-v1.schema.json")
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    for item in read("fixtures/configuration-cases.json"):
        assert validator.is_valid(item["configuration"]) == item["structurally_valid"], item["name"]


def test_backend_canonical_vectors_have_identical_python_utf8_hashes():
    decimal_fields = set(read("fixtures/canonical-rules.json")["decimal_fields"])

    def canonical_value(value, field=""):
        if isinstance(value, str) and field in decimal_fields:
            normalized = value.rstrip("0").rstrip(".") if "." in value else value
            return "0" if normalized == "-0" else normalized
        if isinstance(value, list):
            return [canonical_value(item) for item in value]
        if isinstance(value, dict):
            return {key: canonical_value(item, key) for key, item in value.items()}
        return value

    for item in read("fixtures/canonical-vectors.json"):
        canonical = json.dumps(
            canonical_value(item["configuration"]),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        )
        assert canonical == item["canonical_json"]
        assert hashlib.sha256(canonical.encode("utf-8")).hexdigest() == item["sha256"]
    vectors = read("fixtures/canonical-vectors.json")
    assert vectors[0]["sha256"] == vectors[1]["sha256"]
    assert vectors[2]["sha256"] != vectors[3]["sha256"]
