from copy import deepcopy

import pytest
from feature_helpers import config, small_config
from jsonschema.exceptions import ValidationError

from bybit_quant.configuration import configuration, issues, snapshot_document
from bybit_quant.contracts import CONTRACTS, canonical, config_hash, strict_json, validate
from bybit_quant.features.schema import observation_schema

CASES = strict_json((CONTRACTS / "fixtures/semantic-conformance.json").read_text("utf-8"))


@pytest.mark.parametrize("case", CASES, ids=lambda x: x["name"])
def test_python_semantic_rules_match_typescript(case):
    if not case["structurally_valid"]:
        with pytest.raises((ValidationError, ValueError)):
            configuration(case["configuration"])
    else:
        found = issues(case["configuration"])
        assert [{"field": f, "code": code} for f, code in found] == case["issues"]
        assert (not found) == case["semantically_valid"]


def test_observation_schema_hash_is_identical_to_typescript_and_dimension_299():
    reference = strict_json((CONTRACTS / "fixtures/observation-vector.json").read_text("utf-8"))
    assert observation_schema(config()) == reference
    assert reference["schema"]["dimension"] == 299
    for section, key in (("enabled", None), ("position_inputs", None), ("risk_inputs", None)):
        changed = config()
        changed["features"][section].reverse()
        assert observation_schema(changed)["sha256"] != reference["sha256"]


def test_dimension_and_actual_parameter_guard():
    c = config()
    c["network"]["input_dimension"] = 298
    with pytest.raises(ValueError, match="input_dimension_mismatch"):
        observation_schema(c)
    c = config()
    c["features"]["observation_window"] = c["training"]["observation_window"] = 4096
    c["training"]["episode_length_bars"] = 5000
    with pytest.raises(ValueError, match="parameter_budget_exceeded"):
        observation_schema(c)


@pytest.mark.parametrize("data", ['{"x":NaN}', '{"x":Infinity}', '{"x":1,"x":2}'])
def test_strict_json_rejects_nonfinite_and_duplicate_keys(data):
    with pytest.raises(ValueError):
        strict_json(data)


def test_exact_decimal_rules_and_opaque_artifact_identity():
    c = config()
    c["risk"]["risk_per_trade"] = "0.020000000000000001"
    assert ("risk.risk_per_trade", "risk_budget_order") in issues(c)
    c = config()
    d = deepcopy(c)
    c["features"]["normalization"]["artifact_id"] = "1.00"
    d["features"]["normalization"]["artifact_id"] = "1"
    assert config_hash(c) != config_hash(d)


def test_single_feature_alternate_window_is_valid():
    c = small_config()
    c["features"]["enabled"] = [{"id": "atr", "timeframe": "1m"}]
    schema = observation_schema(c)
    assert schema["schema"]["dimension"] == 13
    validate("feature-v1", schema["schema"])
    assert canonical(schema) == canonical(observation_schema(c))


def test_integral_json_numbers_have_javascript_canonical_hash():
    c = config()
    reference = config_hash(c)
    c["risk"]["max_leverage"] = 1.0
    c["training"]["seed"] = 42.0
    assert config_hash(configuration(c)) == reference


def test_actual_api_snapshot_envelope_is_verified():
    c = config()
    api_snapshot = {
        "id": "00000000-0000-4000-8000-000000000001",
        "payload": c,
        "configHash": config_hash(c),
        "sourceRevision": 1,
    }
    assert snapshot_document(api_snapshot)["configuration"] == c
    api_snapshot["configHash"] = "0" * 64
    with pytest.raises(ValueError, match="checksum"):
        snapshot_document(api_snapshot)
