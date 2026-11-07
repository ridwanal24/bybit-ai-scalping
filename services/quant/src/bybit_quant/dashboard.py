"""Bounded local dashboard RPC. JSON stdin only; no client-supplied filesystem paths."""

import json
import sys
from itertools import islice
from pathlib import Path
from uuid import UUID, uuid4

from jsonschema.exceptions import ValidationError

from bybit_quant.artifacts import identifier, publish_file
from bybit_quant.contracts import canonical, config_hash, digest, validate
from bybit_quant.dataset import Dataset, records
from bybit_quant.simulation.artifacts import code_fingerprint, read_small, verify_artifact
from bybit_quant.training import jobs
from bybit_quant.training.models import verify_model
from bybit_quant.training.storage import now


def page(args):
    offset, limit = args.get("offset", 0), args.get("limit", 100)
    if (
        type(offset) is not int
        or type(limit) is not int
        or not 0 <= offset <= 1000000
        or not 1 <= limit <= 1000
    ):
        raise ValueError("invalid_pagination")
    return offset, limit


def directories(root, kind):
    path = root / "artifacts" / kind
    return sorted(
        (p for p in path.glob("*") if p.is_dir() and not p.name.startswith(".")),
        key=lambda p: p.stat().st_mtime_ns,
        reverse=True,
    )


def catalog(root, args):
    offset, limit = page({**args, "limit": min(args.get("limit", 40), 100)})
    result = {
        "datasets": [],
        "models": [],
        "evaluations": [],
        "jobs": [],
        "errors": [],
        "totals": {},
        "execution_ready": False,
    }
    kinds = {
        "datasets": "datasets",
        "models": "models",
        "evaluations": "evaluations/reports",
        "jobs": "training-jobs",
    }
    for name, kind in kinds.items():
        paths = directories(root, kind)
        result["totals"][name] = len(paths)
        for path in paths[offset : offset + limit]:
            try:
                if name == "datasets":
                    UUID(path.name)
                    dataset = Dataset(path)
                    result[name].append(
                        {"id": path.name, **dataset.export, "integrity": "verified_export"}
                    )
                elif name == "models":
                    identifier(path.name)
                    m = read_small(path / "metadata.json")
                    validate("model-metadata-v1", m)
                    result[name].append(
                        {
                            "id": path.name,
                            "metadata": m,
                            "validation": read_small(path / "validation.json"),
                            "integrity": "indexed",
                        }
                    )
                elif name == "evaluations":
                    identifier(path.name)
                    r = read_small(path / "report.json")
                    validate("evaluation-report-v1", r)
                    result[name].append(
                        {
                            "id": path.name,
                            "protocol_id": r["protocol_id"],
                            "status": r["status"],
                            "screen": r["screen"],
                            "rows": len(r["rows"]),
                            "integrity": "indexed",
                        }
                    )
                else:
                    result[name].append(jobs.status(root, str(UUID(path.name))))
            except (ValueError, OSError, KeyError, TypeError, ValidationError):
                result["errors"].append(
                    {"kind": name, "id": path.name, "code": "artifact_unavailable"}
                )
    return result


def dataset_detail(root, args):
    dataset = Dataset(root / "artifacts/datasets" / str(UUID(args["id"])))
    offset, limit = page(args)
    stream = args.get("stream", "last:1m")
    if stream not in dataset.streams:
        raise ValueError("unknown_dataset_stream")
    filename = stream.replace(":", "-") + ".jsonl"
    rows = list(islice(records(dataset.directory / filename), offset, offset + limit + 1))
    return {
        "id": args["id"],
        **dataset.export,
        "candles": rows[:limit],
        "has_more": len(rows) > limit,
        "offset": offset,
        "limit": limit,
        "stream": stream,
    }


def job_detail(root, args):
    job_id = str(UUID(args["id"]))
    state = jobs.status(root, job_id)
    path = jobs.paths(root, job_id)
    log_file = path / "events.jsonl"
    # Training logs are allowlisted structured events, never raw worker stderr.
    events = (
        list(records(log_file))[-100:]
        if log_file.exists() and log_file.stat().st_size <= 2097152
        else []
    )
    checkpoints = sorted(p.name for p in (path / "checkpoints").glob("*.zip"))
    return {**state, "events": events, "checkpoints": checkpoints}


def start(root, args):
    c, source = args["configuration"], args["source_snapshot"]
    dataset_id = str(UUID(args["dataset_id"]))
    dataset = Dataset(root / "artifacts/datasets" / dataset_id, source)
    if dataset.export["fingerprint"] != args["dataset_fingerprint"]:
        raise ValueError("dataset_database_export_mismatch")
    from bybit_quant.training.preparation import prepare

    # Admission validates fit/range/resources before starting a hidden persistent job.
    prepare(
        dataset, c, args["policy"], args["range_start_ms"], args["range_end_ms"], args["resources"]
    )
    work = root / ".runtime/dashboard-requests" / uuid4().hex
    work.mkdir(parents=True)
    request = {
        "version": "1",
        "dataset_id": dataset_id,
        "configuration_file": "configuration.json",
        "source_snapshot_file": "source.json",
        "range_start_ms": args["range_start_ms"],
        "range_end_ms": args["range_end_ms"],
        "ppo_epochs": args["ppo_epochs"],
        "checkpoint_every_rollouts": 1,
        "resources": args["resources"],
        "policy": args["policy"],
    }
    for name, value in (
        ("configuration.json", c),
        ("source.json", source),
        ("request.json", request),
    ):
        publish_file(work / name, (canonical(value) + "\n").encode("utf-8"))
    return jobs.submit(root, work / "request.json")


def model_detail(root, args):
    model_id = identifier(args["id"])
    metadata, _, evaluation = verify_model(root / "artifacts/models" / model_id)
    blockers = ["operational_readiness_not_implemented", "manual_mode_approval_required"]
    from bybit_quant.training.runtime import runtime_versions

    runtime_matches = metadata["runtime"] == runtime_versions()
    if not runtime_matches:
        blockers.append("model_runtime_differs_from_current_runtime")
    if metadata["code_fingerprint"] != code_fingerprint():
        blockers.append("model_code_differs_from_current_runtime")
    return {
        "id": model_id,
        "metadata": metadata,
        "validation": evaluation,
        "integrity": "verified_archive",
        "compatibility": {
            "current_code": metadata["code_fingerprint"] == code_fingerprint(),
            "runtime_matches": runtime_matches,
            "blockers": blockers,
            "execution_ready": False,
        },
    }


def evaluation_detail(root, args):
    from bybit_quant.evaluation.reports import verify_report

    report_id = identifier(args["id"])
    return {
        "id": report_id,
        "integrity": "verified_report",
        **verify_report(root, root / "artifacts/evaluations/reports" / report_id),
    }


def simulation_detail(root, args):
    simulation_id = identifier(args["id"])
    directory = root / "artifacts/simulations" / simulation_id
    # Model validation can be self-contained and not have a top-level simulation copy.
    if args.get("model_id") is not None:
        model_id = identifier(args["model_id"])
        _, _, evaluation = verify_model(root / "artifacts/models" / model_id)
        if evaluation["simulation_id"] != simulation_id:
            raise ValueError("model_simulation_mismatch")
        directory = root / "artifacts/models" / model_id / "validation"
    report = verify_artifact(directory, simulation_id)
    offset, limit = page(args)
    kind = args.get("kind", "equity")
    if kind not in ("equity", "trades"):
        raise ValueError("invalid_simulation_stream")
    items = list(islice(records(directory / (kind + ".jsonl")), offset, offset + limit + 1))
    return {
        "id": simulation_id,
        "report": report,
        "items": items[:limit],
        "has_more": len(items) > limit,
        "offset": offset,
        "limit": limit,
        "kind": kind,
    }


def baseline_detail(root, args):
    from bybit_quant.baselines.evaluator import verify_comparison

    identity = identifier(args["id"])
    return {
        "id": identity,
        **verify_comparison(
            root / "artifacts/baselines" / identity, root / "artifacts/simulations"
        ),
    }


def proposals(root, args):
    offset, limit = page(args)
    paths = sorted(
        (root / "artifacts/deployment-proposals").glob("*.json"),
        key=lambda p: p.stat().st_mtime_ns,
        reverse=True,
    )
    items = []
    for path in paths[offset : offset + limit]:
        UUID(path.stem)
        value = read_small(path)
        if (
            digest({k: v for k, v in value.items() if k != "sha256"}) != value["sha256"]
            or value["execution_ready"] is not False
        ):
            raise ValueError("deployment_proposal_integrity")
        items.append(value)
    return {"items": items, "total": len(paths)}


def propose(root, args):
    if args.get("target") != "backtest" or args.get("acknowledge_research_only") is not True:
        raise ValueError("deployment_mode_not_available")
    note = args.get("note")
    if not isinstance(note, str) or not 8 <= len(note.strip()) <= 500:
        raise ValueError("manual_proposal_note_required")
    model = model_detail(root, {"id": args["model_id"]})
    m = model["metadata"]
    value = {
        "id": str(uuid4()),
        "version": "research_proposal_v1",
        "created_at": now(),
        "model_id": model["id"],
        "configuration_hash": config_hash(m["configuration"]),
        "configuration": m["configuration"],
        "parameter_sha256": m["parameter_sha256"],
        "validation_simulation_id": model["validation"]["simulation_id"],
        "validation_sha256": digest(model["validation"]),
        "code_fingerprint": m["code_fingerprint"],
        "runtime": m["runtime"],
        "normalizer_id": m["normalizer_id"],
        "dataset_fingerprint": m["dataset_fingerprint"],
        "target": "backtest",
        "status": "PROPOSED_RESEARCH",
        "note": note.strip(),
        "blockers": model["compatibility"]["blockers"],
        "execution_ready": False,
    }
    value["sha256"] = digest(value)
    publish_file(
        root / "artifacts/deployment-proposals" / (value["id"] + ".json"),
        (canonical(value) + "\n").encode("utf-8"),
    )
    return value


OPERATIONS = {
    "catalog": catalog,
    "dataset": dataset_detail,
    "job": job_detail,
    "start": start,
    "model": model_detail,
    "evaluation": evaluation_detail,
    "simulation": simulation_detail,
    "baseline": baseline_detail,
    "proposals": proposals,
    "propose": propose,
}


def handle(root, request):
    if set(request) != {"operation", "args"} or not isinstance(request["args"], dict):
        raise ValueError("invalid_dashboard_request")
    root = Path(root)
    if request["operation"] == "cancel":
        return jobs.cancel(root, str(UUID(request["args"]["id"])))
    if request["operation"] not in OPERATIONS:
        raise ValueError("unsupported_dashboard_operation")
    return OPERATIONS[request["operation"]](root, request["args"])


def main():
    import argparse

    from jsonschema.exceptions import ValidationError

    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    args = parser.parse_args()
    try:
        payload = sys.stdin.buffer.read(262145)
        if len(payload) > 262144:
            raise ValueError("dashboard_request_too_large")
        request = json.loads(payload)
        result = handle(Path(args.root).resolve(strict=True), request)
        print(json.dumps(result, allow_nan=False))
    except FileExistsError:
        print(json.dumps({"error": "training_worker_busy"}))
        raise SystemExit(3) from None
    except FileNotFoundError:
        print(json.dumps({"error": "artifact_not_found"}))
        raise SystemExit(2) from None
    except (
        ValueError,
        KeyError,
        TypeError,
        OSError,
        ArithmeticError,
        ValidationError,
        StopIteration,
    ):
        print(json.dumps({"error": "invalid_or_unavailable_research_artifact"}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
