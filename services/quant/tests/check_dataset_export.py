"""Cross-language export checker used by integration tests; not a trading engine."""

import hashlib
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator


def check(directory):
    contracts = Path(__file__).resolve().parents[3] / "packages" / "contracts"
    exported = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    manifest = exported["manifest"]
    schema = json.loads(
        (contracts / "schemas/dataset-manifest-v1.schema.json").read_text(encoding="utf-8")
    )
    Draft202012Validator(schema).validate(manifest)
    quality_schema = json.loads(
        (contracts / "schemas/market-quality-v1.schema.json").read_text(encoding="utf-8")
    )
    Draft202012Validator(quality_schema).validate(exported["quality"])
    canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    assert hashlib.sha256(canonical.encode("utf-8")).hexdigest() == exported["fingerprint"]
    for entry in exported["files"]:
        assert Path(entry["file"]).name == entry["file"]
        data = (directory / entry["file"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry["sha256"]
        records = [json.loads(line) for line in data.splitlines()]
        assert len(records) == entry["count"]
        if entry["file"] == "instrument.json":
            meta = json.dumps(records[0], sort_keys=True, separators=(",", ":"), ensure_ascii=False)
            assert hashlib.sha256(meta.encode("utf-8")).hexdigest() == manifest["instrument_hash"]
            continue
        schema_name = (
            "funding-v1.schema.json"
            if entry["file"] == "funding.jsonl"
            else "market-candle-v1.schema.json"
        )
        validator = Draft202012Validator(
            json.loads((contracts / "schemas" / schema_name).read_text(encoding="utf-8"))
        )
        for record in records:
            validator.validate(record)
        times = [record.get("open_time_ms", record.get("timestamp_ms")) for record in records]
        assert times == sorted(set(times))
    print(json.dumps({"status": "passed", "files": len(exported["files"])}))


if __name__ == "__main__":
    check(Path(sys.argv[1]))
