"""Pre-registered CPU1024-step public smoke, two independent background jobs, no holdout eval."""

import json
import time
from datetime import UTC, datetime

from smoke_simulation import DATASET, END, ROOT, START

from bybit_quant.contracts import CONTRACTS, canonical
from bybit_quant.training import jobs
from bybit_quant.training.models import load_model, verify_model


def main():
    began = time.perf_counter()
    directory = ROOT / ".runtime/training-smoke"
    directory.mkdir(parents=True, exist_ok=True)
    request = {
        "version": "1",
        "dataset_id": DATASET,
        "configuration_file": str(CONTRACTS / "presets/research-small-hybrid-v1.json"),
        "source_snapshot_file": None,
        "range_start_ms": START,
        "range_end_ms": END,
        "ppo_epochs": 2,
        "checkpoint_every_rollouts": 1,
        "resources": {
            "cpu_threads": 1,
            "max_wall_seconds": 180,
            "max_memory_mb": 3072,
            "max_timesteps": 1024,
            "max_checkpoints": 8,
        },
        "policy": {
            "simulation_policy_version": "restricted_bar_v1",
            "acknowledge_research_only": True,
            "acknowledge_current_metadata": True,
            "acknowledge_declared_funding_schedule": True,
            "require_exchange_liquidation": False,
            "funding_price_proxy": "boundary_last_open",
            "execution_latency_ms": 0,
            "safety_reserve": "0",
            "funding_schedule": [
                {"start_ms": START, "end_ms": END, "interval_ms": 28800000, "anchor_ms": 0}
            ],
        },
    }
    path = directory / "request.json"
    path.write_text(canonical(request) + "\n", "utf-8", newline="\n")
    results = []
    active = None
    try:
        for run_index in range(2):
            active = jobs.submit(ROOT, path)["job_id"]
            deadline = time.monotonic() + 210
            while True:
                status = jobs.status(ROOT, active)
                if status["state"] in jobs.TERMINAL:
                    break
                if time.monotonic() > deadline:
                    raise ValueError("public_training_smoke_timeout")
                time.sleep(0.25)
            if status["state"] != "SUCCEEDED":
                raise ValueError("public_training_smoke_failed:" + status["state"])
            model_path = ROOT / "artifacts/models" / status["model_id"]
            metadata, normalizer, evaluation = verify_model(model_path)
            model, _, loaded_evaluation = load_model(model_path, metadata["configuration"])
            assert evaluation == loaded_evaluation
            assert metadata["timesteps"] == 1024 and metadata["parameters"] == 47110
            assert metadata["initial_parameter_sha256"] != metadata["parameter_sha256"]
            assert metadata["split"]["holdout_evaluated"] is False
            assert normalizer.payload["train_end_ms"] == metadata["split"]["validation"][0]
            assert evaluation["end_ms"] == metadata["split"]["holdout"][0]
            checkpoints = list((jobs.paths(ROOT, active) / "checkpoints").glob("*.zip"))
            assert len(checkpoints) == 8
            results.append(
                {
                    "job": status,
                    "metadata": metadata,
                    "validation": evaluation,
                    "normalizer_count": normalizer.payload["count"],
                    "checkpoints": len(checkpoints),
                }
            )
            print(
                json.dumps(
                    {
                        "run": run_index + 1,
                        "job_id": active,
                        "model_id": status["model_id"],
                        "parameter_sha256": metadata["parameter_sha256"],
                        "validation_net": evaluation["report"]["net_equity_change"],
                    }
                ),
                flush=True,
            )
            del model
        assert (
            results[0]["metadata"]["parameter_sha256"] == results[1]["metadata"]["parameter_sha256"]
        )
        assert results[0]["metadata"]["normalizer_id"] == results[1]["metadata"]["normalizer_id"]
        assert results[0]["validation"] == results[1]["validation"]
        evidence = {
            "status": "passed",
            "finished_at": datetime.now(UTC).isoformat(),
            "elapsed_seconds": round(time.perf_counter() - began, 3),
            "results": results,
        }
        (ROOT / ".runtime/training-smoke.json").write_text(
            json.dumps(evidence, indent=2) + "\n", "utf-8", newline="\n"
        )
        print(
            json.dumps(
                {
                    "smoke": "passed",
                    "elapsed_seconds": evidence["elapsed_seconds"],
                    "jobs": [r["job"]["job_id"] for r in results],
                    "parameter_sha256": results[0]["metadata"]["parameter_sha256"],
                    "validation": results[0]["validation"]["report"],
                }
            )
        )
    finally:
        if active is not None:
            jobs.cancel(ROOT, active)


if __name__ == "__main__":
    main()
