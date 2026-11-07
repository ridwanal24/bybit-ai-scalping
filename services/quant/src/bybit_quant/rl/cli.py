"""Explicit offline bounded environment episode smoke; no learner or model created."""

import json
from pathlib import Path
from uuid import UUID

from bybit_quant.artifacts import load_normalizer
from bybit_quant.contracts import CONTRACTS, config_canonical, validate
from bybit_quant.dataset import Dataset
from bybit_quant.feature_cli import read_configuration
from bybit_quant.rl.artifacts import create_episode
from bybit_quant.simulation.artifacts import read_small

ROOT = CONTRACTS.parent.parent


def execute(args):
    path = Path(args.request).resolve(strict=True)
    request = config_canonical(read_small(path))
    validate("rl-request-v1", request)
    c = read_configuration((path.parent / request["configuration_file"]).resolve(strict=True))
    source = None
    if request["source_snapshot_file"] is not None:
        source = read_small((path.parent / request["source_snapshot_file"]).resolve(strict=True))
    dataset = Dataset(ROOT / "artifacts/datasets" / str(UUID(request["dataset_id"])), source)
    normalizer = load_normalizer(ROOT / "artifacts/features", request["normalizer_id"])
    result = create_episode(
        ROOT / "artifacts/environments",
        ROOT / "artifacts/simulations",
        dataset,
        c,
        normalizer,
        request["policy"],
        request["episode_start_ms"],
        request["episode_end_ms"],
        request["seed"],
        request["agent"],
    )
    print(
        json.dumps(
            {
                "episode_id": result["episode_id"],
                "steps": result["steps"],
                "total_reward": result["total_reward"],
                "status": result["report"]["status"],
                "trades": result["report"]["trades"],
                "final_equity": result["report"]["final_equity"],
            }
        )
    )
    if result["report"]["status"] == "invalid":
        raise SystemExit(2)
