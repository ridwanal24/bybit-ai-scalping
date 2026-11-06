"""Offline explicit request file; never opens network, DB or arbitrary Python callbacks."""

import json
from pathlib import Path
from uuid import UUID

from bybit_quant.artifacts import load_normalizer
from bybit_quant.contracts import CONTRACTS, config_canonical, validate
from bybit_quant.dataset import Dataset
from bybit_quant.feature_cli import read_configuration
from bybit_quant.simulation.artifacts import create_artifact, read_small

ROOT = CONTRACTS.parent.parent


def execute(args):
    path = Path(args.request).resolve(strict=True)
    request = config_canonical(read_small(path))
    validate("simulation-request-v1", request)

    def input_file(name):
        return (path.parent / request[name]).resolve(strict=True)

    c = read_configuration(input_file("configuration_file"))
    source = None
    if request["source_snapshot_file"] is not None:
        source = read_small(input_file("source_snapshot_file"))
    dataset = Dataset(ROOT / "artifacts/datasets" / str(UUID(request["dataset_id"])), source)
    normalizer = load_normalizer(ROOT / "artifacts/features", request["normalizer_id"])
    result = create_artifact(
        ROOT / "artifacts/simulations",
        dataset,
        c,
        normalizer,
        request["policy"],
        request["episode_start_ms"],
        request["episode_end_ms"],
        input_file("actions_file"),
    )
    print(
        json.dumps(
            {
                "artifact_id": result["artifact_id"],
                "status": result["report"]["status"],
                "reason": result["report"]["reason"],
                "trades": result["report"]["trades"],
                "final_equity": result["report"]["final_equity"],
            }
        )
    )
    if result["report"]["status"] == "invalid":
        raise SystemExit(2)
