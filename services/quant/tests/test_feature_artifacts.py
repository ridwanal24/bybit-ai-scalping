import hashlib
import json
import subprocess
import sys
from copy import deepcopy

import pytest
from feature_helpers import (
    START,
    exported_dataset,
    flat,
    small_config,
    source_snapshot,
    write_export,
)

from bybit_quant.artifacts import (
    build_artifact,
    load_normalizer,
    save_normalizer,
    verify_artifact,
)
from bybit_quant.contracts import canonical, digest
from bybit_quant.dataset import Dataset
from bybit_quant.features.alignment import feature_rows
from bybit_quant.features.normalization import fit


def test_verified_export_to_frozen_artifact_roundtrip_deterministic_and_tamper(tmp_path):
    data = tmp_path / "dataset"
    exported_dataset(data)
    d, c = Dataset(data, source_snapshot()), small_config()
    n = fit(feature_rows(d.bind(c), c), c, d.manifest, START, START + 60 * 60000)
    root = tmp_path / "features"
    save_normalizer(root, n)
    loaded = load_normalizer(root, n.id)
    assert loaded.payload == n.payload
    contexts = [flat(START + (i + 1) * 60000) for i in range(120)]
    ctx_hash = digest(contexts)
    first = build_artifact(root, d, c, loaded, contexts, "synthetic_flat_fixture", ctx_hash)
    second = build_artifact(root, d, c, loaded, contexts, "synthetic_flat_fixture", ctx_hash)
    assert first == second
    manifest = verify_artifact(root / first["id"])
    assert manifest["rows"] > 60 and manifest["dimension"] == 29
    assert manifest["source"] == "fixture"
    target = root / first["id"] / "observations.f32"
    target.write_bytes(target.read_bytes()[:-1])
    with pytest.raises(ValueError, match="checksum"):
        verify_artifact(root / first["id"])
    path = root / "normalizers" / (n.id + ".json")
    payload = json.loads(path.read_text("utf-8"))
    payload["means"][0] = "999"
    path.write_text(canonical(payload), "utf-8")
    with pytest.raises(ValueError):
        load_normalizer(root, n.id)
    with pytest.raises(ValueError, match="immutable"):
        save_normalizer(root, n)


@pytest.mark.parametrize(
    "case",
    [
        "checksum",
        "path",
        "duplicate",
        "missing",
        "quality",
        "fingerprint",
        "provenance",
        "symbol",
        "coverage",
        "ohlc",
    ],
)
def test_dataset_loader_rejects_corrupt_exports_even_with_rehashed_files(tmp_path, case):
    e = exported_dataset(tmp_path)
    if case == "checksum":
        (tmp_path / "last-1m.jsonl").write_bytes(b"corrupt\n")
    elif case == "path":
        e["files"][0]["file"] = "../outside.jsonl"
    elif case == "duplicate":
        e["files"][1] = deepcopy(e["files"][0])
    elif case == "missing":
        e["files"].pop()
    elif case == "quality":
        e["quality"]["candles_usable"] = False
    elif case == "fingerprint":
        e["fingerprint"] = "0" * 64
    elif case == "provenance":
        e["configuration_snapshot_id"] = "no-uuid"
    else:
        path = tmp_path / "last-1m.jsonl"
        rows = [json.loads(line) for line in path.read_text("utf-8").splitlines()]
        if case == "symbol":
            rows[0]["symbol"] = "ETHUSDT"
        elif case == "coverage":
            rows[0]["open_time_ms"] += 1
        elif case == "ohlc":
            rows[0]["high"] = "1"
        data = "".join(canonical(row) + "\n" for row in rows).encode("utf-8")
        path.write_bytes(data)
        checksum = hashlib.sha256(data).hexdigest()
        e["files"][0]["sha256"] = e["manifest"]["streams"][0]["sha256"] = checksum
        e["fingerprint"] = digest(e["manifest"])
    write_export(tmp_path, e)
    with pytest.raises((ValueError, OSError)):
        Dataset(tmp_path)


def test_dataset_binding_feature_variant_allowed_other_symbol_or_stream_rejected(tmp_path):
    exported_dataset(tmp_path)
    d, c = Dataset(tmp_path, source_snapshot()), small_config()
    assert set(d.bind(c)) == {"1m", "5m", "15m"}
    c["market"]["symbol"] = "ETHUSDT"
    with pytest.raises(ValueError, match="mismatch"):
        d.bind(c)
    c = small_config()
    c["market"]["secondary_timeframes"].append("1h")
    c["features"]["enabled"].append({"id": "rsi", "timeframe": "1h"})
    with pytest.raises(ValueError, match="missing"):
        d.bind(c)


def test_bad_context_sequence_and_no_valid_rows_do_not_publish(tmp_path):
    path = tmp_path / "dataset"
    exported_dataset(path)
    d, c = Dataset(path, source_snapshot()), small_config()
    n = fit(feature_rows(d.bind(c), c), c, d.manifest, START, START + 60 * 60000)
    root = tmp_path / "features"
    with pytest.raises(ValueError, match="nonascending_context"):
        build_artifact(
            root, d, c, n, [flat(START + 60000), flat(START + 60000)], "fixture", "0" * 64
        )
    with pytest.raises(ValueError, match="no_valid"):
        build_artifact(root, d, c, n, [], "fixture", "0" * 64)
    assert list(root.iterdir()) == []


def test_feature_cli_rejects_path_ids_without_echoing_input():
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "bybit_quant",
            "features-fit",
            "--dataset",
            "../sensitive",
            "--config",
            "secret-value",
            "--train-start-ms",
            "0",
            "--train-end-ms",
            "1",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1 and result.stdout == ""
    assert "secret-value" not in result.stderr and "sensitive" not in result.stderr


def test_feature_variant_requires_verified_source_snapshot(tmp_path):
    exported_dataset(tmp_path)
    with pytest.raises(ValueError, match="source_snapshot_required"):
        Dataset(tmp_path).bind(small_config())
    snapshot = source_snapshot()
    snapshot["configuration"]["risk"]["initial_capital"] = "2000"
    with pytest.raises(ValueError, match="configuration_snapshot_checksum"):
        Dataset(tmp_path, snapshot)
