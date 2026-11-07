"""Bounded preregistered walk-forward research using persistent M8 jobs and M5 accounting."""

import time
from pathlib import Path
from uuid import uuid4

from bybit_quant.artifacts import identifier, publish_file
from bybit_quant.baselines.evaluator import compare
from bybit_quant.contracts import canonical, config_hash, digest
from bybit_quant.dataset import Dataset
from bybit_quant.evaluation.compatibility import review
from bybit_quant.evaluation.episodes import episode
from bybit_quant.evaluation.protocol import load_protocol
from bybit_quant.evaluation.screen import screen
from bybit_quant.evaluation.variants import EXPLORATORY, STRESSES, configured
from bybit_quant.simulation.artifacts import read_small
from bybit_quant.training import jobs
from bybit_quant.training.models import load_model, verify_model
from bybit_quant.training.runtime import Control, seed_runtime
from bybit_quant.training.storage import log


def trained(root, work, protocol, fold, seed, name, control):
    c = configured(protocol, seed, name)
    r = protocol["request"]
    descriptor = {
        "configuration_hash": config_hash(c),
        "dataset_fingerprint": protocol["dataset_fingerprint"],
        "fold": fold,
        "policy": r["policy"],
        "ppo_epochs": r["ppo_epochs"],
        "code_fingerprint": protocol["code_fingerprint"],
        "resources": r["resources"],
    }
    key = digest(descriptor)
    cache = root / "artifacts/evaluations/training-cache" / (key + ".json")
    if cache.exists():
        cached = read_small(cache)
        metadata, _, _ = verify_model(root / "artifacts/models" / identifier(cached["model_id"]))
        if (
            cached["descriptor"] != descriptor
            or metadata["configuration_hash"] != descriptor["configuration_hash"]
            or metadata["split"] != fold
            or metadata["code_fingerprint"] != protocol["code_fingerprint"]
            or metadata["dataset_fingerprint"] != protocol["dataset_fingerprint"]
            or metadata["simulation_policy"] != r["policy"]
        ):
            raise ValueError("evaluation_training_cache_mismatch")
        log(work, "model_cache_reused", model_id=cached["model_id"], key=key)
        return cached["model_id"]
    config_path = work / (key + "-config.json")
    source_path = work / "source.json"
    publish_file(config_path, (canonical(c) + "\n").encode("utf-8"))
    publish_file(source_path, (canonical(protocol["source_snapshot"]) + "\n").encode("utf-8"))
    request = {
        "version": "1",
        "dataset_id": r["dataset_id"],
        "configuration_file": str(config_path),
        "source_snapshot_file": str(source_path),
        "policy": r["policy"],
        "range_start_ms": r["range_start_ms"],
        "range_end_ms": r["range_end_ms"],
        "ppo_epochs": r["ppo_epochs"],
        "checkpoint_every_rollouts": 1,
        "resources": r["resources"],
        "research_scope": "advanced_evaluation_v1",
        "research_fold": fold,
    }
    path = work / (key + "-request.json")
    publish_file(path, (canonical(request) + "\n").encode("utf-8"))
    job_id = jobs.submit(root, path)["job_id"]
    log(work, "training_submitted", job_id=job_id, key=key)
    try:
        while True:
            control.check()
            status = jobs.status(root, job_id)
            if status["state"] in jobs.TERMINAL:
                break
            time.sleep(0.2)
        if status["state"] != "SUCCEEDED":
            raise ValueError("evaluation_training_job_failed")
        control.check()
        model_id = status["model_id"]
        publish_file(
            cache,
            (canonical({"model_id": model_id, "descriptor": descriptor}) + "\n").encode("utf-8"),
        )
        return model_id
    finally:
        jobs.cancel(root, job_id)


def run(root, protocol_id):
    root = Path(root)
    protocol = load_protocol(root, protocol_id)
    r = protocol["request"]
    dataset = Dataset(root / "artifacts/datasets" / r["dataset_id"], protocol["source_snapshot"])
    if dataset.export["fingerprint"] != protocol["dataset_fingerprint"]:
        raise ValueError("protocol_dataset_changed")
    work = root / ".runtime/evaluation-work" / uuid4().hex
    work.mkdir(parents=True)
    control = Control(
        work, {"max_wall_seconds": r["suite_wall_seconds"], "max_memory_mb": r["suite_memory_mb"]}
    )
    seed_runtime(r["seeds"][0])
    rows, baselines, failures, action_paths = [], [], [], []
    simulations = root / "artifacts/simulations"
    legacy = review(root, r["legacy_model_id"], dataset, control) if r["legacy_model_id"] else None

    def result(model_id, fold_index, seed, name, group):
        model, normalizer, _ = load_model(
            root / "artifacts/models" / model_id,
            configured(protocol, seed, "base" if group == "counterfactual" else name),
        )
        c = configured(protocol, seed, name)
        fold = protocol["folds"][fold_index]
        action_path = work / f"actions-{len(rows)}.jsonl"
        actual = episode(
            model,
            dataset,
            c,
            normalizer,
            r["policy"],
            fold["validation"],
            control,
            simulations,
            action_path,
        )
        row = {
            "group": group,
            "name": name,
            "fold": fold_index,
            "seed": seed,
            "model_id": model_id,
            "configuration": c,
            "normalizer_id": normalizer.id,
            **actual,
            "deployment_compatible": group != "counterfactual",
        }
        rows.append(row)
        action_paths.append(action_path)
        log(
            work,
            "evaluated",
            group=group,
            name=name,
            fold=fold_index,
            seed=seed,
            simulation_id=actual["simulation_id"],
        )
        return model, normalizer, c

    for fold_index, fold in enumerate(protocol["folds"]):
        for seed in r["seeds"]:
            control.check()
            try:
                model_id = trained(root, work, protocol, fold, seed, "base", control)
                _, normalizer, c = result(model_id, fold_index, seed, "base", "primary")
                comparison = compare(
                    root / "artifacts/baselines",
                    simulations,
                    dataset,
                    c,
                    normalizer,
                    r["policy"],
                    *fold["validation"],
                    [
                        {"name": "hold"},
                        {"name": "random", "seed": seed},
                        {"name": "ema_crossover"},
                        {"name": "buy_hold"},
                    ],
                )
                baselines.append(
                    {"fold": fold_index, "seed": seed, "comparison_id": comparison["comparison_id"]}
                )
                for name in STRESSES:
                    result(model_id, fold_index, seed, name, "counterfactual")
            except (ValueError, OSError, ArithmeticError) as error:
                failures.append(
                    {
                        "fold": fold_index,
                        "seed": seed,
                        "name": "base_or_stress",
                        "error_type": type(error).__name__,
                    }
                )
                log(work, "cell_failed", **failures[-1])
    fold_index = len(protocol["folds"]) - 1
    seed = r["seeds"][0]
    for name in EXPLORATORY:
        control.check()
        try:
            model_id = trained(
                root, work, protocol, protocol["folds"][fold_index], seed, name, control
            )
            result(model_id, fold_index, seed, name, "exploratory")
        except (ValueError, OSError, ArithmeticError) as error:
            failures.append(
                {"fold": fold_index, "seed": seed, "name": name, "error_type": type(error).__name__}
            )
            log(work, "cell_failed", **failures[-1])
    gate = screen(root, protocol, rows, baselines, failures)
    payload = {
        "version": "advanced_evaluation_v1",
        "protocol_id": protocol_id,
        "code_fingerprint": protocol["code_fingerprint"],
        "rows": rows,
        "baselines": baselines,
        "failures": failures,
        "screen": gate,
        "legacy_review_id": legacy,
        "status": "contains_failures"
        if failures or any(x["report"]["status"] == "invalid" for x in rows)
        else "completed_research",
        "execution_ready": False,
    }
    payload["semantic_sha256"] = digest(payload)
    from bybit_quant.evaluation.reports import publish_report

    control.check()
    return publish_report(root, payload, action_paths)
