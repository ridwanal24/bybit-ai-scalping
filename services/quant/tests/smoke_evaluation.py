"""Preregistered M9 public-data smoke; cached rerun is inference reproducibility only."""

import json
import time
from datetime import UTC, datetime

from smoke_simulation import DATASET, END, ROOT, START

from bybit_quant.contracts import CONTRACTS, canonical
from bybit_quant.evaluation.holdout import freeze
from bybit_quant.evaluation.protocol import load_protocol, register
from bybit_quant.evaluation.reports import verify_report
from bybit_quant.evaluation.runner import run
from bybit_quant.simulation.artifacts import read_small

LEGACY = "b99a2434ebc90505f454da79eb18ee4673b15f86ddacd4b9b923a1a742609d6d"


def main():
    began = time.perf_counter()
    directory = ROOT / ".runtime/evaluation-smoke"
    directory.mkdir(parents=True, exist_ok=True)
    preset = CONTRACTS / "presets/research-small-hybrid-v1.json"
    original = read_small(ROOT / "artifacts/models" / LEGACY / "metadata.json")
    request = {
        "version": "1",
        "dataset_id": DATASET,
        "configuration_file": str(preset),
        "source_snapshot_file": None,
        "policy": original["simulation_policy"],
        "range_start_ms": START,
        "range_end_ms": END,
        "seeds": [42, 43, 44],
        "folds": 2,
        "purge_bars": 1,
        "ablation": read_small(preset)["features"]["enabled"][-1],
        "train_timesteps": 384,
        "n_steps": 128,
        "batch_size": 64,
        "ppo_epochs": 2,
        "resources": {
            "cpu_threads": 1,
            "max_wall_seconds": 120,
            "max_memory_mb": 3072,
            "max_timesteps": 384,
            "max_checkpoints": 2,
        },
        "max_new_trainings": 12,
        "max_total_train_steps": 5000,
        "suite_wall_seconds": 900,
        "suite_memory_mb": 3072,
        "legacy_model_id": LEGACY,
    }
    path = directory / "request.json"
    path.write_text(canonical(request) + "\n", "utf-8")
    protocol_id = register(ROOT, path)
    print(json.dumps({"protocol_id": protocol_id, "stage": "registered"}), flush=True)
    first = run(ROOT, protocol_id)
    print(json.dumps({"stage": "first_complete", **first}), flush=True)
    report = verify_report(ROOT, ROOT / "artifacts/evaluations/reports" / first["report_id"])
    assert len(report["rows"]) == 35 and len(report["baselines"]) == 6
    assert not report["failures"] and report["legacy_review_id"]
    assert report["screen"]["status"] == "insufficient_evidence"
    assert report["screen"]["eligible_for_frozen_holdout"] is False
    try:
        freeze(ROOT, first["report_id"])
    except ValueError as error:
        assert str(error) == "research_screen_does_not_allow_holdout"
    else:
        raise AssertionError("short_public_smoke_must_not_open_holdout")
    before = set((ROOT / "artifacts/training-jobs").glob("*"))
    second = run(ROOT, protocol_id)
    assert second == first
    assert before == set((ROOT / "artifacts/training-jobs").glob("*"))
    evidence = {
        "status": "passed",
        "finished_at": datetime.now(UTC).isoformat(),
        "elapsed_seconds": round(time.perf_counter() - began, 3),
        "protocol_id": protocol_id,
        "protocol": load_protocol(ROOT, protocol_id),
        "result": first,
        "cached_rerun_identical": True,
        "holdout_executed": False,
        "report": report,
    }
    (ROOT / ".runtime/evaluation-smoke.json").write_text(
        json.dumps(evidence, indent=2) + "\n", "utf-8"
    )
    print(
        json.dumps(
            {
                "smoke": "passed",
                "elapsed_seconds": evidence["elapsed_seconds"],
                "report_id": first["report_id"],
                "screen": report["screen"],
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
