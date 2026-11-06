"""Explicit local-only restricted simulation on the existing public M3 export."""

import json
import subprocess
import sys
import time
from datetime import UTC, datetime

from bybit_quant.contracts import CONTRACTS, canonical, strict_json
from bybit_quant.simulation.artifacts import verify_artifact

ROOT = CONTRACTS.parent.parent
DATASET = "3717d128-5be2-433f-90dc-ac21d3c35b54"
NORMALIZER = "e9313eebe60972c72d972987e279757bfd3016b8faca0c3652db06c7a39bcfd9"
START, END = 1735689600000, 1735776000000


def main():
    began = time.perf_counter()
    directory = ROOT / ".runtime/simulation-smoke"
    directory.mkdir(parents=True, exist_ok=True)
    actions = []
    # Predetermined timestamps/sides, independent of outcomes or future prices.
    for index, hour in enumerate((6, 8, 10, 12, 14, 16, 18, 20)):
        side = 1 if index % 2 == 0 else 2
        actions += [
            {"decision_ms": START + hour * 3600000, "action": side},
            {"decision_ms": START + hour * 3600000 + 30 * 60000, "action": side + 2},
        ]
    action_path = directory / "actions.jsonl"
    action_path.write_text("".join(canonical(a) + "\n" for a in actions), "utf-8", newline="\n")
    request = {
        "version": "1",
        "dataset_id": DATASET,
        "configuration_file": str(CONTRACTS / "presets/research-small-hybrid-v1.json"),
        "source_snapshot_file": None,
        "normalizer_id": NORMALIZER,
        "actions_file": str(action_path),
        "episode_start_ms": START + 4 * 3600000,
        "episode_end_ms": END,
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
    outputs = []
    for _ in range(2):
        result = subprocess.run(
            [sys.executable, "-m", "bybit_quant", "simulation-run", "--request", str(path)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode not in (0, 2):
            raise ValueError("simulation_cli_smoke_failed")
        outputs.append(strict_json(result.stdout))
    if outputs[0] != outputs[1]:
        raise ValueError("nondeterministic_simulation_replay")
    outcome = outputs[0]
    report = verify_artifact(ROOT / "artifacts/simulations" / outcome["artifact_id"])
    evidence = {
        "status": "passed",
        "finished_at": datetime.now(UTC).isoformat(),
        "elapsed_seconds": round(time.perf_counter() - began, 3),
        "dataset_id": DATASET,
        "context": "simulator_ledger_generated",
        "artifact_id": outcome["artifact_id"],
        "simulation": report,
    }
    (ROOT / ".runtime/simulation-smoke.json").write_text(
        json.dumps(evidence, indent=2) + "\n", "utf-8", newline="\n"
    )
    print(json.dumps({"smoke": "passed", **outcome, "rejections": report["rejections"]}))


if __name__ == "__main__":
    main()
