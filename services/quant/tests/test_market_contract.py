import hashlib
import json
from pathlib import Path

from jsonschema import Draft202012Validator

CONTRACTS = Path(__file__).resolve().parents[3] / "packages" / "contracts"


def test_market_schema_and_canonical_vectors():
    vectors = json.loads((CONTRACTS / "fixtures/market-vectors.json").read_text(encoding="utf-8"))
    for item in vectors:
        schema = json.loads((CONTRACTS / "schemas" / item["schema"]).read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(item["payload"])
        canonical = json.dumps(
            item["payload"], sort_keys=True, separators=(",", ":"), ensure_ascii=False
        )
        assert canonical == item["canonical_json"]
        assert hashlib.sha256(canonical.encode("utf-8")).hexdigest() == item["sha256"]
    assert vectors[1]["payload"]["volume"] is None
