"""Freeze before final inference; atomic once-only use survives failed/interrupted evaluations."""

from pathlib import Path

from bybit_quant.artifacts import identifier, publish_file
from bybit_quant.contracts import canonical, digest
from bybit_quant.dataset import Dataset
from bybit_quant.evaluation.episodes import episode
from bybit_quant.evaluation.protocol import GATES, load_protocol
from bybit_quant.evaluation.reports import verify_report
from bybit_quant.simulation.artifacts import code_fingerprint, read_small
from bybit_quant.simulation.numeric import decimal
from bybit_quant.training.models import load_model
from bybit_quant.training.runtime import Control
from bybit_quant.training.storage import atomic_json


def freeze(root, report_id):
    root = Path(root)
    report = verify_report(root, root / "artifacts/evaluations/reports" / identifier(report_id))
    if not report["screen"]["eligible_for_frozen_holdout"]:
        raise ValueError("research_screen_does_not_allow_holdout")
    protocol = load_protocol(root, report["protocol_id"])
    # Deterministic reference model, never post-hoc best seed/variant selection.
    candidate = next(
        r
        for r in report["rows"]
        if r["group"] == "primary"
        and r["seed"] == protocol["request"]["seeds"][0]
        and r["fold"] == len(protocol["folds"]) - 1
    )
    selection = {
        "version": "frozen_holdout_v1",
        "report_id": report_id,
        "protocol_id": report["protocol_id"],
        "model_id": candidate["model_id"],
        "parameter_sha256": candidate["parameter_sha256"],
        "configuration_hash": digest(candidate["configuration"]),
        "normalizer_id": candidate["normalizer_id"],
        "holdout": protocol["folds"][-1]["holdout"],
        "code_fingerprint": code_fingerprint(),
        "gates": GATES,
        "execution_ready": False,
    }
    identity = digest(selection)
    publish_file(
        root / "artifacts/evaluations/selections" / (identity + ".json"),
        (canonical(selection) + "\n").encode("utf-8"),
    )
    return identity


def consume_once(directory, key, selection_id, operation, *, scope=None):
    """Internal mechanism; operation cannot be supplied through the CLI/request."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    marker = directory / (identifier(key) + ".json")
    state = {"version": "holdout_use_v1", "selection_id": selection_id, "state": "started"}
    # Reserve and fsync before any holdout prediction. Crash leaves a consumed marker.
    import os
    from contextlib import nullcontext

    from bybit_quant.evaluation.reservations import namespace_lock

    if scope is not None:
        state["scope"] = scope
    namespace = None if scope is None else {k: v for k, v in scope.items() if k != "range"}
    with nullcontext() if scope is None else namespace_lock(directory, namespace):
        if scope is not None:
            for path in directory.glob("*.json"):
                previous = read_small(path).get("scope")
                if previous is None:
                    raise ValueError("holdout_unscoped_prior_use_requires_review")
                if {k: v for k, v in previous.items() if k != "range"} == namespace and max(
                    previous["range"][0], scope["range"][0]
                ) < min(previous["range"][1], scope["range"][1]):
                    raise ValueError("holdout_overlapping_consumption")
        with marker.open("xb") as output:
            output.write((canonical(state) + "\n").encode("utf-8"))
            output.flush()
            os.fsync(output.fileno())
    try:
        result = operation()
        atomic_json(marker, {**state, "state": "complete", "result": result})
        return result
    except BaseException:
        atomic_json(marker, {**state, "state": "failed_consumed"})
        raise


def evaluate_holdout(root, selection_id):
    root = Path(root)
    selection = read_small(
        root / "artifacts/evaluations/selections" / (identifier(selection_id) + ".json")
    )
    if (
        digest(selection) != selection_id
        or selection["code_fingerprint"] != code_fingerprint()
        or selection["gates"] != GATES
    ):
        raise ValueError("frozen_selection_changed")
    # Re-derive the frozen selection from the fully checked report; no arbitrary model swap.
    if freeze(root, selection["report_id"]) != selection_id:
        raise ValueError("holdout_selection_not_from_eligible_report")
    protocol = load_protocol(root, selection["protocol_id"])
    request = protocol["request"]
    dataset = Dataset(
        root / "artifacts/datasets" / request["dataset_id"], protocol["source_snapshot"]
    )
    if dataset.export["fingerprint"] != protocol["dataset_fingerprint"]:
        raise ValueError("holdout_dataset_changed")
    # Exclude whole-dataset fingerprint: revising train data must not reset access to the same period.
    scope = {
        "source": dataset.manifest["source"],
        "symbol": dataset.manifest["symbol"],
        "timeframe": protocol["configuration"]["market"]["timeframe"],
        "range": selection["holdout"],
    }
    key = digest(scope)

    def operation():
        work = root / "artifacts/evaluations/holdout-results" / selection_id
        work.mkdir(parents=True, exist_ok=True)
        control = Control(
            work,
            {
                "max_wall_seconds": request["suite_wall_seconds"],
                "max_memory_mb": request["suite_memory_mb"],
            },
        )
        candidate = next(
            r
            for r in verify_report(
                root, root / "artifacts/evaluations/reports" / selection["report_id"]
            )["rows"]
            if r["model_id"] == selection["model_id"] and r["group"] == "primary"
        )
        model, n, _ = load_model(
            root / "artifacts/models" / selection["model_id"], candidate["configuration"]
        )
        actual = episode(
            model,
            dataset,
            candidate["configuration"],
            n,
            request["policy"],
            selection["holdout"],
            control,
            root / "artifacts/simulations",
            work / "actions.jsonl",
        )
        reasons = []
        for name in ("net_return", "profit_factor", "max_drawdown"):
            if actual["metrics"][name]["value"] is None:
                reasons.append("undefined_" + name)
        if actual["report"]["status"] != "completed_restricted" or actual["risk_breaches"]:
            reasons.append("invalid_or_risk_breach")
        if actual["report"]["trades"] < GATES["holdout_min_trades"]:
            reasons.append("insufficient_holdout_trades")
        m = actual["metrics"]
        if m["net_return"]["value"] is not None and decimal(m["net_return"]["value"]) <= 0:
            reasons.append("nonpositive_holdout_return")
        if m["profit_factor"]["value"] is not None and decimal(
            m["profit_factor"]["value"]
        ) < decimal(GATES["min_profit_factor"]):
            reasons.append("holdout_profit_factor_below_gate")
        if m["max_drawdown"]["value"] is not None and decimal(m["max_drawdown"]["value"]) > decimal(
            candidate["configuration"]["risk"]["max_drawdown"]
        ):
            reasons.append("holdout_drawdown_exceeded")
        result = {
            "version": "final_holdout_v1",
            "selection_id": selection_id,
            **actual,
            "status": "eligible_for_manual_research_review" if not reasons else "not_eligible",
            "reasons": sorted(set(reasons)),
            "execution_ready": False,
        }
        publish_file(work / "result.json", (canonical(result) + "\n").encode("utf-8"))
        return result

    return consume_once(
        root / "artifacts/evaluations/holdout-use", key, selection_id, operation, scope=scope
    )
