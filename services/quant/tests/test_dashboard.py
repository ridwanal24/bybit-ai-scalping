import json
import subprocess
import sys
import time

import pytest
from feature_helpers import source_snapshot
from test_training import inputs

from bybit_quant.contracts import canonical
from bybit_quant.dashboard import handle
from bybit_quant.training import jobs


@pytest.fixture(scope="module")
def store(tmp_path_factory):
    root = tmp_path_factory.mktemp("dashboard-store")
    dataset, c, request = inputs(root)
    target = root / "artifacts/datasets" / request["dataset_id"]
    target.parent.mkdir(parents=True)
    dataset.directory.rename(target)
    args = {
        **request,
        "configuration": c,
        "source_snapshot": source_snapshot(),
        "dataset_fingerprint": dataset.export["fingerprint"],
    }
    state = handle(root, {"operation": "start", "args": args})
    deadline = time.monotonic() + 120
    try:
        while state["state"] not in jobs.TERMINAL:
            assert time.monotonic() < deadline
            time.sleep(0.2)
            state = jobs.status(root, state["job_id"])
        assert state["state"] == "SUCCEEDED", state
        yield root, request, args, state
    finally:
        jobs.cancel(root, state["job_id"])


def test_actual_rpc_catalog_jobs_checkpoints_and_paginated_export(store):
    root, request, _, state = store
    catalog = handle(root, {"operation": "catalog", "args": {}})
    assert len(catalog["datasets"]) == len(catalog["models"]) == len(catalog["jobs"]) == 1
    assert catalog["errors"] == [] and catalog["execution_ready"] is False
    detail = handle(root, {"operation": "job", "args": {"id": state["job_id"]}})
    assert detail["state"] == "SUCCEEDED" and detail["checkpoints"] and detail["events"]
    first = handle(
        root, {"operation": "dataset", "args": {"id": request["dataset_id"], "limit": 10}}
    )
    second = handle(
        root,
        {"operation": "dataset", "args": {"id": request["dataset_id"], "limit": 10, "offset": 10}},
    )
    assert len(first["candles"]) == 10 and first["has_more"]
    assert first["candles"][-1]["open_time_ms"] < second["candles"][0]["open_time_ms"]


def test_verified_model_embedded_ledger_and_proposal_never_activate(store):
    root, _, _, state = store
    model = handle(root, {"operation": "model", "args": {"id": state["model_id"]}})
    assert model["integrity"] == "verified_archive" and model["compatibility"]["runtime_matches"]
    simulation = handle(
        root,
        {
            "operation": "simulation",
            "args": {
                "id": model["validation"]["simulation_id"],
                "model_id": state["model_id"],
                "kind": "equity",
                "limit": 5,
            },
        },
    )
    assert len(simulation["items"]) == 5 and simulation["has_more"]
    proposal = handle(
        root,
        {
            "operation": "propose",
            "args": {
                "model_id": state["model_id"],
                "target": "backtest",
                "note": "Synthetic integration review",
                "acknowledge_research_only": True,
            },
        },
    )
    assert proposal["status"] == "PROPOSED_RESEARCH" and proposal["execution_ready"] is False
    assert "operational_readiness_not_implemented" in proposal["blockers"]
    assert handle(root, {"operation": "proposals", "args": {}})["items"] == [proposal]
    assert not (root / "artifacts/deployments").exists()


@pytest.mark.parametrize(
    "operation,args",
    [
        ("activate", {}),
        ("model", {"id": "../secret"}),
        ("dataset", {"id": "../secret"}),
        ("catalog", {"offset": -1}),
        ("simulation", {"id": "a" * 64, "kind": "../../secret"}),
        ("propose", {"target": "real"}),
    ],
)
def test_rpc_rejects_paths_unsupported_modes_and_invalid_pagination(tmp_path, operation, args):
    with pytest.raises((ValueError, FileNotFoundError)):
        handle(tmp_path, {"operation": operation, "args": args})


def test_start_rejects_database_export_fingerprint_mismatch_before_job_admission(store):
    root, _, args, _ = store
    with pytest.raises(ValueError, match="database_export_mismatch"):
        handle(root, {"operation": "start", "args": {**args, "dataset_fingerprint": "a" * 64}})
    assert not (root / "artifacts/training-jobs/active.json").exists()


def test_rpc_cli_sanitizes_missing_artifact_errors(tmp_path):
    result = subprocess.run(
        [sys.executable, "-m", "bybit_quant.dashboard", "--root", str(tmp_path)],
        input=canonical({"operation": "model", "args": {"id": "a" * 64}}),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 2
    assert json.loads(result.stdout) == {"error": "artifact_not_found"}
    assert str(tmp_path) not in result.stdout and not result.stderr
