"""Explicit bounded public-export smoke; fixed strategies/seed, no tuning or download."""

import json
import subprocess
import sys
import time
from datetime import UTC, datetime

from smoke_simulation import DATASET, END, NORMALIZER, ROOT, START

from bybit_quant.baselines.evaluator import verify_comparison
from bybit_quant.contracts import CONTRACTS, canonical, strict_json


def main():
    began = time.perf_counter()
    directory = ROOT / ".runtime/baselines-smoke"
    directory.mkdir(parents=True, exist_ok=True)
    request = {
        "version": "1",
        "dataset_id": DATASET,
        "configuration_file": str(CONTRACTS / "presets/research-small-hybrid-v1.json"),
        "source_snapshot_file": None,
        "normalizer_id": NORMALIZER,
        "episode_start_ms": START + 4 * 3600000,
        "episode_end_ms": END,
        "strategies": [
            {"name": "hold"},
            {"name": "random", "seed": 42},
            {"name": "ema_crossover"},
            {"name": "buy_hold"},
        ],
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
        run = subprocess.run(
            [sys.executable, "-m", "bybit_quant", "baseline-run", "--request", str(path)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        if run.returncode != 0:
            raise ValueError("baseline_cli_smoke_failed")
        outputs.append(strict_json(run.stdout))
    if outputs[0] != outputs[1]:
        raise ValueError("baseline_nondeterministic_replay")
    outcome = outputs[0]
    verified = verify_comparison(
        ROOT / "artifacts/baselines" / outcome["comparison_id"], ROOT / "artifacts/simulations"
    )
    assert verified["results"][0]["metrics"]["net_profit"]["value"] == "0"
    evidence = {
        "status": "passed",
        "finished_at": datetime.now(UTC).isoformat(),
        "elapsed_seconds": round(time.perf_counter() - began, 3),
        "dataset_id": DATASET,
        "normalizer_id": NORMALIZER,
        **outcome,
    }
    (ROOT / ".runtime/baselines-smoke.json").write_text(
        json.dumps(evidence, indent=2) + "\n", "utf-8", newline="\n"
    )
    print(
        json.dumps(
            {
                "smoke": "passed",
                "comparison_id": outcome["comparison_id"],
                "elapsed_seconds": evidence["elapsed_seconds"],
                "results": [
                    {
                        "strategy": r["strategy"],
                        "trades": r["total_trades"],
                        "net_pnl": r["metrics"]["net_profit"]["value"],
                    }
                    for r in outcome["results"]
                ],
            }
        )
    )


if __name__ == "__main__":
    main()
