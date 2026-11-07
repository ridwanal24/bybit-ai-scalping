"""Local public-export M7 smoke: fixed20h, HOLD/masked-random42, no learner/download."""

import json
import subprocess
import sys
import time
from datetime import UTC, datetime

from smoke_simulation import DATASET, END, NORMALIZER, ROOT, START

from bybit_quant.contracts import CONTRACTS, canonical, strict_json
from bybit_quant.rl.artifacts import verify_episode


def main():
    began = time.perf_counter()
    directory = ROOT / ".runtime/environment-smoke"
    directory.mkdir(parents=True, exist_ok=True)
    base = {
        "version": "1",
        "dataset_id": DATASET,
        "configuration_file": str(CONTRACTS / "presets/research-small-hybrid-v1.json"),
        "source_snapshot_file": None,
        "normalizer_id": NORMALIZER,
        "episode_start_ms": START + 4 * 3600000,
        "episode_end_ms": END,
        "seed": 42,
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
    results = []
    for agent in ("hold", "masked_random"):
        path = directory / (agent + ".json")
        path.write_text(canonical({**base, "agent": agent}) + "\n", "utf-8", newline="\n")
        outputs = []
        for _ in range(2):
            run = subprocess.run(
                [sys.executable, "-m", "bybit_quant", "environment-run", "--request", str(path)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            if run.returncode != 0:
                raise ValueError("environment_public_smoke_failed")
            outputs.append(strict_json(run.stdout))
        if outputs[0] != outputs[1]:
            raise ValueError("environment_public_replay_mismatch")
        result = outputs[0]
        episode = verify_episode(
            ROOT / "artifacts/environments" / result["episode_id"], ROOT / "artifacts/simulations"
        )
        assert episode["steps"] == 1200 and episode["truncated"] and not episode["terminated"]
        if agent == "hold":
            assert episode["total_reward"] == "0" and episode["report"]["trades"] == 0
        results.append({"episode_id": result["episode_id"], **episode})
    evidence = {
        "status": "passed",
        "finished_at": datetime.now(UTC).isoformat(),
        "elapsed_seconds": round(time.perf_counter() - began, 3),
        "results": results,
    }
    (ROOT / ".runtime/environment-smoke.json").write_text(
        json.dumps(evidence, indent=2) + "\n", "utf-8", newline="\n"
    )
    print(
        json.dumps(
            {
                "smoke": "passed",
                "elapsed_seconds": evidence["elapsed_seconds"],
                "results": [
                    {
                        "agent": r["agent"],
                        "episode_id": r["episode_id"],
                        "steps": r["steps"],
                        "reward": r["total_reward"],
                        "trades": r["report"]["trades"],
                        "net": r["report"]["net_equity_change"],
                    }
                    for r in results
                ],
            }
        )
    )


if __name__ == "__main__":
    main()
