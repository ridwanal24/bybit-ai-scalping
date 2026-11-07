"""Strict offline baseline request; no database, downloads or exchange credentials."""

import json
from pathlib import Path
from uuid import UUID

from bybit_quant.artifacts import load_normalizer
from bybit_quant.baselines.evaluator import compare
from bybit_quant.contracts import CONTRACTS, config_canonical, validate
from bybit_quant.dataset import Dataset
from bybit_quant.feature_cli import read_configuration
from bybit_quant.simulation.artifacts import read_small

ROOT = CONTRACTS.parent.parent


def execute(args):
    path = Path(args.request).resolve(strict=True)
    request = config_canonical(read_small(path))
    validate("baseline-request-v1", request)

    def input_file(name):
        return (path.parent / request[name]).resolve(strict=True)

    c = read_configuration(input_file("configuration_file"))
    source = None
    if request["source_snapshot_file"] is not None:
        source = read_small(input_file("source_snapshot_file"))
    dataset = Dataset(ROOT / "artifacts/datasets" / str(UUID(request["dataset_id"])), source)
    normalizer = load_normalizer(ROOT / "artifacts/features", request["normalizer_id"])
    result = compare(
        ROOT / "artifacts/baselines",
        ROOT / "artifacts/simulations",
        dataset,
        c,
        normalizer,
        request["policy"],
        request["episode_start_ms"],
        request["episode_end_ms"],
        request["strategies"],
    )
    print(json.dumps(result))
    if result["status"] == "contains_invalid":
        raise SystemExit(2)
