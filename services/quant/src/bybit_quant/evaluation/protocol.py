"""Immutable research protocol fixed before any decision-bearing evaluation."""

from copy import deepcopy
from pathlib import Path

from bybit_quant.artifacts import identifier, publish_file
from bybit_quant.configuration import snapshot_document
from bybit_quant.contracts import INTERVALS, canonical, config_hash, digest, validate
from bybit_quant.dataset import Dataset
from bybit_quant.feature_cli import read_configuration
from bybit_quant.simulation.artifacts import code_fingerprint, read_small
from bybit_quant.simulation.policy import capabilities
from bybit_quant.training.preparation import (
    chronological_split,
    validate_research_fold,
    validate_training,
)

GATES = {
    "version": "research_screen_v1",
    "min_seeds": 3,
    "min_folds": 2,
    "min_oos_ms": 2592000000,
    "min_trades_per_seed": 30,
    "min_profit_factor": "1.1",
    "require_positive_all_seeds": True,
    "require_stress_positive": True,
    "require_beat_hold_ema": True,
    "require_no_risk_breach": True,
    "holdout_min_trades": 30,
    "execution_ready": False,
}


def walk_forward(start, end, interval, folds=2, purge_bars=1):
    split = chronological_split(start, end, interval)
    limit = split["holdout"][0]
    bars = (limit - start) // interval
    first = bars // 2
    results = []
    for index in range(folds):
        a = start + (first + (bars - first) * index // folds) * interval
        b = start + (first + (bars - first) * (index + 1) // folds) * interval
        train_end = a - purge_bars * interval
        if min(train_end - start, b - a) < 2 * interval:
            raise ValueError("insufficient_walk_forward_history")
        results.append(
            {
                "version": "walk_forward_expanding_v1",
                "train": [start, train_end],
                "validation": [a, b],
                "holdout": split["holdout"],
                "interval_ms": interval,
                "purge_bars": purge_bars,
                "holdout_evaluated": False,
            }
        )
    return results


def check_protocol(protocol):
    validate("evaluation-protocol-v1", protocol)
    request, c = protocol["request"], protocol["configuration"]
    if c["network"]["preset"] != "Small" or c["exit"]["mode"] != "HYBRID":
        raise ValueError("protocol_requires_small_hybrid_reference")
    interval = INTERVALS[c["market"]["timeframe"]]
    folds = walk_forward(
        request["range_start_ms"],
        request["range_end_ms"],
        interval,
        request["folds"],
        request["purge_bars"],
    )
    planned = len(request["seeds"]) * len(folds) + 5
    if (
        protocol["folds"] != folds
        or protocol["gates"] != GATES
        or len(set(request["seeds"])) != len(request["seeds"])
        or request["ablation"] not in c["features"]["enabled"]
        or len(c["features"]["enabled"]) < 2
        or planned != protocol["planned_training_runs"]
        or planned * request["train_timesteps"] != protocol["planned_train_steps"]
        or planned > request["max_new_trainings"]
        or planned * request["train_timesteps"] > request["max_total_train_steps"]
    ):
        raise ValueError("invalid_or_over_budget_protocol")
    train = deepcopy(c)
    train["training"].update(
        total_timesteps=request["train_timesteps"],
        n_steps=request["n_steps"],
        batch_size=request["batch_size"],
    )
    validate_training(train, request["resources"], research=True)
    for fold in folds:
        validate_research_fold(c, request["range_start_ms"], request["range_end_ms"], fold)
    return protocol


def register(root, request_path):
    root, request_path = Path(root), Path(request_path).resolve(strict=True)
    request = read_small(request_path)
    validate("evaluation-request-v1", request)
    c = read_configuration(
        (request_path.parent / request["configuration_file"]).resolve(strict=True)
    )
    source = (
        None
        if request["source_snapshot_file"] is None
        else snapshot_document(
            read_small((request_path.parent / request["source_snapshot_file"]).resolve(strict=True))
        )
    )
    dataset = Dataset(root / "artifacts/datasets" / request["dataset_id"], source)
    if source is None:
        if config_hash(c) != dataset.export["configuration_hash"]:
            raise ValueError("source_snapshot_required_for_variant")
        # Reconstruct only the exact source payload whose hash/UUID the sealed export already pins.
        source = {
            "id": dataset.export["configuration_snapshot_id"],
            "config_hash": config_hash(c),
            "configuration": c,
        }
        Dataset(dataset.directory, source)
    capabilities(
        c,
        dataset.instrument(),
        request["policy"],
        request["range_start_ms"],
        request["range_end_ms"],
    )
    stream = dataset.streams.get("last:" + c["market"]["timeframe"])
    if (
        not stream
        or not stream["start_ms"]
        <= request["range_start_ms"]
        < request["range_end_ms"]
        <= stream["end_ms"]
    ):
        raise ValueError("evaluation_range_outside_dataset")
    normalized = {
        k: v for k, v in request.items() if k not in ("configuration_file", "source_snapshot_file")
    }
    folds = walk_forward(
        request["range_start_ms"],
        request["range_end_ms"],
        INTERVALS[c["market"]["timeframe"]],
        request["folds"],
        request["purge_bars"],
    )
    planned = len(folds) * len(request["seeds"]) + 5
    protocol = {
        "version": "advanced_evaluation_v1",
        "request": normalized,
        "configuration": c,
        "source_snapshot": source,
        "dataset_fingerprint": dataset.export["fingerprint"],
        "code_fingerprint": code_fingerprint(),
        "folds": folds,
        "gates": GATES,
        "planned_training_runs": planned,
        "planned_train_steps": planned * request["train_timesteps"],
    }
    check_protocol(protocol)
    from bybit_quant.evaluation.reservations import reserve_boundary

    reserve_boundary(root, dataset, c, folds[-1]["holdout"])
    identity = digest(protocol)
    publish_file(
        root / "artifacts/evaluations/protocols" / (identity + ".json"),
        (canonical(protocol) + "\n").encode("utf-8"),
    )
    return identity


def load_protocol(root, protocol_id, *, current=True):
    path = Path(root) / "artifacts/evaluations/protocols" / (identifier(protocol_id) + ".json")
    value = check_protocol(read_small(path))
    if digest(value) != protocol_id or current and value["code_fingerprint"] != code_fingerprint():
        raise ValueError("protocol_checksum_or_code_mismatch")
    return value
