"""Generate causal action scripts, replay M5, publish and independently verify comparison."""

import os
from pathlib import Path
from uuid import uuid4

from bybit_quant.artifacts import publish_file
from bybit_quant.baselines.metrics import artifact_metrics
from bybit_quant.baselines.strategies import Baseline
from bybit_quant.contracts import INTERVALS, canonical, digest, validate
from bybit_quant.dataset import file_hash, records
from bybit_quant.simulation.artifacts import (
    code_fingerprint,
    create_artifact,
    read_small,
    verify_artifact,
)
from bybit_quant.simulation.runner import action_stream, run_dataset


class CountSink:
    def __init__(self):
        self.counts = {key: 0 for key in ("events", "equity", "trades")}

    def write(self, stream, row):
        self.counts[stream] += 1


def _strategies(strategies):
    if not 1 <= len(strategies) <= 32:
        raise ValueError("invalid_baseline_count")
    for spec in strategies:
        validate("baseline-strategy-v1", spec)
    if len({digest(spec) for spec in strategies}) != len(strategies):
        raise ValueError("duplicate_baseline_strategy")


def compare(root, simulations, dataset, c, normalizer, policy, start, end, strategies):
    _strategies(strategies)
    root, simulations = Path(root), Path(simulations)
    root.mkdir(parents=True, exist_ok=True)
    directory = root / (".comparison-" + uuid4().hex)
    directory.mkdir()
    code = code_fingerprint()
    try:
        results = []
        for index, spec in enumerate(strategies):
            script = directory / f"actions-{index}.jsonl"
            with script.open("xb") as output:

                def write(row):
                    output.write((canonical(row) + "\n").encode("utf-8"))

                strategy = Baseline(spec, c, write)
                first = run_dataset(
                    dataset,
                    c,
                    normalizer,
                    policy,
                    start,
                    end,
                    strategy=strategy,
                    sink=CountSink(),
                )
                output.flush()
                os.fsync(output.fileno())
            replay = create_artifact(
                simulations, dataset, c, normalizer, policy, start, end, script
            )
            if first != replay["report"]:
                raise ValueError("baseline_action_replay_mismatch")
            results.append(
                {
                    "strategy": spec,
                    "actions_sha256": file_hash(script),
                    "simulation_id": replay["artifact_id"],
                    "status": first["status"],
                    "total_trades": first["trades"],
                    "metrics": artifact_metrics(
                        simulations / replay["artifact_id"], first, start, end
                    ),
                }
            )
        if code_fingerprint() != code:
            raise ValueError("baseline_code_changed")
        comparison = {
            "version": "1",
            "evaluator_version": "baseline_v1",
            "execution_ready": False,
            "status": "contains_invalid"
            if any(r["status"] == "invalid" for r in results)
            else "completed_restricted",
            "reference_policy": "single_attempt_long_same_risk_stops_costs_no_reentry",
            "exposure_policy": "fraction_of_open_samples_with_position",
            "ema_policy": "m4_main_fast_slow_cross_close_then_enter_no_stop_reentry",
            "results": results,
        }
        validate("baseline-comparison-v1", comparison)
        identity = digest(comparison)
        publish_file(directory / "comparison.json", (canonical(comparison) + "\n").encode("utf-8"))
        verify_comparison(directory, simulations, identity)
        target = root / identity
        if target.exists():
            verify_comparison(target, simulations)
        else:
            directory.rename(target)
        return {"comparison_id": identity, **comparison}
    finally:
        if directory.exists():
            for index in range(len(strategies)):
                (directory / f"actions-{index}.jsonl").unlink(missing_ok=True)
            (directory / "comparison.json").unlink(missing_ok=True)
            directory.rmdir()


def verify_comparison(directory, simulations, expected_id=None):
    directory, simulations = Path(directory), Path(simulations)
    comparison = read_small(directory / "comparison.json")
    validate("baseline-comparison-v1", comparison)
    if digest(comparison) != (expected_id or directory.name):
        raise ValueError("baseline_comparison_checksum")
    _strategies([r["strategy"] for r in comparison["results"]])
    common = None
    invalid = False
    for index, result in enumerate(comparison["results"]):
        path = simulations / result["simulation_id"]
        report = verify_artifact(path)
        manifest = read_small(path / "manifest.json")
        descriptor = read_small(path / "descriptor.json")
        provenance = {k: v for k, v in manifest.items() if k not in ("files", "actions_sha256")}
        if common is not None and common != provenance:
            raise ValueError("baseline_incomparable_runs")
        common = provenance
        script = directory / f"actions-{index}.jsonl"
        if file_hash(script) != result["actions_sha256"] or (
            manifest["actions_sha256"] != result["actions_sha256"]
        ):
            raise ValueError("baseline_script_checksum")
        start, end = manifest["episode_start_ms"], manifest["episode_end_ms"]
        interval = INTERVALS[descriptor["configuration"]["market"]["timeframe"]]
        for _ in action_stream(records(script), start, end, interval):
            pass
        if (
            result["status"] != report["status"]
            or result["total_trades"] != report["trades"]
            or result["metrics"] != artifact_metrics(path, report, start, end)
        ):
            raise ValueError("baseline_result_mismatch")
        invalid |= report["status"] == "invalid"
    expected_status = "contains_invalid" if invalid else "completed_restricted"
    if comparison["status"] != expected_status:
        raise ValueError("baseline_status_mismatch")
    return comparison
