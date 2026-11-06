"""Explicit local-only public M3 export smoke, including both production CLI commands."""

import json
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

from bybit_quant.artifacts import verify_artifact
from bybit_quant.contracts import CONTRACTS, canonical, strict_json
from bybit_quant.dataset import Dataset

ROOT = Path(__file__).resolve().parents[3]
DATASET = "3717d128-5be2-433f-90dc-ac21d3c35b54"


def run(*args):
    result = subprocess.run(
        [sys.executable, "-m", "bybit_quant", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return strict_json(result.stdout)


def main():
    began = time.perf_counter()
    directory = ROOT / "artifacts" / "datasets" / DATASET
    dataset = Dataset(directory)
    m = dataset.manifest
    runtime = ROOT / ".runtime" / "features-smoke"
    runtime.mkdir(parents=True, exist_ok=True)
    context = runtime / "context.jsonl"
    start, end = m["requested_start_ms"], m["requested_end_ms"]
    midpoint = start + (end - start) // 2
    # Explicit synthetic caller state. This is not a simulator or account observation.
    with context.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write(canonical({"label": "synthetic_flat_context_on_public_market_data"}) + "\n")
        for candle in dataset.candles("1m"):
            t = candle["close_time_ms"]
            stream.write(
                canonical(
                    {
                        "as_of_ms": t,
                        "side": "FLAT",
                        "mark": float(candle["close"]),
                        "entry": 0,
                        "quantity": 0,
                        "stop": 0,
                        "take_profit": None,
                        "duration_bars": 0,
                        "equity": 1000,
                        "high_water_equity": 1000,
                        "daily_start_equity": 1000,
                        "available_margin": 1000,
                        "remaining_daily_budget": 20,
                        "trading_allowed": True,
                    }
                )
                + "\n"
            )
    config = str(CONTRACTS / "presets" / "research-small-hybrid-v1.json")
    fitted = run(
        "features-fit",
        "--dataset",
        DATASET,
        "--config",
        config,
        "--train-start-ms",
        str(start),
        "--train-end-ms",
        str(midpoint),
    )
    args = (
        "features-build",
        "--dataset",
        DATASET,
        "--config",
        config,
        "--normalizer",
        fitted["normalizer_id"],
        "--context",
        str(context),
    )
    built = run(*args)
    if run(*args) != built:
        raise ValueError("nondeterministic_cli_replay")
    artifact = ROOT / "artifacts" / "features" / built["artifact_id"]
    manifest = verify_artifact(artifact)
    with (artifact / "decisions.jsonl").open("r", encoding="utf-8") as stream:
        decisions = [int(line) for line in stream]
    report = {
        "status": "passed",
        "finished_at": datetime.now(UTC).isoformat(),
        "elapsed_seconds": round(time.perf_counter() - began, 3),
        "dataset_id": DATASET,
        "dataset_fingerprint": dataset.export["fingerprint"],
        "normalizer_id": fitted["normalizer_id"],
        "fit_rows": fitted["count"],
        "train_start_ms": start,
        "train_end_ms": midpoint,
        "artifact_id": built["artifact_id"],
        "rows": manifest["rows"],
        "dimension": manifest["dimension"],
        "unavailable": manifest["unavailable"],
        "first_decision_ms": decisions[0],
        "last_decision_ms": decisions[-1],
        "heldout_decisions_in_half_open_second_half": sum(midpoint <= t < end for t in decisions),
        "context_label": manifest["context_label"],
        "files": manifest["files"],
    }
    (ROOT / ".runtime" / "features-smoke.json").write_text(
        json.dumps(report, indent=2) + "\n", "utf-8", newline="\n"
    )
    print(json.dumps(report))


if __name__ == "__main__":
    main()
