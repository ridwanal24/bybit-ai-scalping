"""Immutable research report, portable curves/figures and independent referenced-artifact verification."""

import csv
import io
import shutil
from pathlib import Path
from uuid import uuid4

from bybit_quant.artifacts import identifier, publish_file
from bybit_quant.baselines.evaluator import verify_comparison
from bybit_quant.baselines.metrics import artifact_metrics
from bybit_quant.contracts import canonical, config_hash, digest, validate
from bybit_quant.dataset import file_hash, records
from bybit_quant.evaluation.protocol import load_protocol
from bybit_quant.evaluation.screen import screen
from bybit_quant.evaluation.variants import EXPLORATORY, STRESSES
from bybit_quant.simulation.artifacts import read_small, verify_artifact
from bybit_quant.simulation.numeric import decimal, exact, wire
from bybit_quant.training.models import verify_model

FILES = ("report.json", "report.md", "curves.csv", "equity.png", "drawdown.png")


@exact
def curve_csv(root, rows):
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(
        ["fold", "seed", "simulation_id", "time_ms", "phase", "equity", "peak", "drawdown"]
    )
    for row in rows:
        if row["group"] != "primary":
            continue
        peak = decimal(row["report"]["initial_capital"])
        for point in records(
            root / "artifacts/simulations" / row["simulation_id"] / "equity.jsonl"
        ):
            equity = decimal(point["equity"])
            peak = max(peak, equity)
            writer.writerow(
                [
                    row["fold"],
                    row["seed"],
                    row["simulation_id"],
                    point["time_ms"],
                    point["phase"],
                    wire(equity),
                    wire(peak),
                    wire((peak - equity) / peak),
                ]
            )
    return output.getvalue()


def figures(root, directory, payload, protocol):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    chosen = next(
        (
            r
            for r in payload["rows"]
            if r["group"] == "primary"
            and r["fold"] == len(protocol["folds"]) - 1
            and r["seed"] == protocol["request"]["seeds"][0]
        ),
        None,
    )
    curves = []
    if chosen is not None:
        curves.append(("Model", chosen["simulation_id"]))
        paired = next(
            (
                b
                for b in payload["baselines"]
                if b["fold"] == chosen["fold"] and b["seed"] == chosen["seed"]
            ),
            None,
        )
        if paired:
            comparison = read_small(
                root / "artifacts/baselines" / paired["comparison_id"] / "comparison.json"
            )
            curves.extend(
                (r["strategy"]["name"], r["simulation_id"]) for r in comparison["results"]
            )
    for kind in ("equity", "drawdown"):
        figure, axes = plt.subplots(figsize=(9, 4), layout="constrained")
        for label, simulation_id in curves:
            points = list(records(root / "artifacts/simulations" / simulation_id / "equity.jsonl"))
            first = points[0]["time_ms"]
            values = [float(p["equity"]) for p in points]
            if kind == "drawdown":
                peak = 1000.0 if chosen is None else float(chosen["report"]["initial_capital"])
                values = []
                for p in points:
                    peak = max(peak, float(p["equity"]))
                    values.append((peak - float(p["equity"])) / peak)
            axes.plot([(p["time_ms"] - first) / 60000 for p in points], values, label=label)
        axes.set(
            xlabel="Minutes within reference OOS fold",
            ylabel="USDT" if kind == "equity" else "Drawdown fraction",
            title="Research reference fold - " + kind,
        )
        axes.grid(alpha=0.2)
        if curves:
            axes.legend(fontsize="small")
        else:
            axes.text(0.5, 0.5, "Reference episode unavailable", ha="center")
        figure.savefig(
            directory / (kind + ".png"), dpi=120, metadata={"Software": "bybit-quant-evaluation-v1"}
        )
        plt.close(figure)


def markdown(root, payload):
    lines = [
        "# Advanced Evaluation",
        "",
        "Protocol: `" + payload["protocol_id"] + "`",
        "",
        "Status: **" + payload["screen"]["status"] + "**. Research only; execution_ready=false.",
        "",
        "Reasons: "
        + (", ".join(payload["screen"]["reasons"]) or "predeclared research screen passed"),
        "",
        "| Group | Variant | Fold | Seed | Trades | Net USDT | Return | Max DD |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in payload["rows"]:
        lines.append(
            "| "
            + " | ".join(
                str(v)
                for v in (
                    r["group"],
                    r["name"],
                    r["fold"],
                    r["seed"],
                    r["report"]["trades"],
                    r["metrics"]["net_profit"]["value"],
                    r["metrics"]["net_return"]["value"],
                    r["metrics"]["max_drawdown"]["value"],
                )
            )
            + " |"
        )
    lines.extend(
        [
            "",
            "| Baseline | Fold | Seed | Trades | Net USDT | Return | Max DD |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for paired in payload["baselines"]:
        comparison = read_small(
            root / "artifacts/baselines" / paired["comparison_id"] / "comparison.json"
        )
        for result in comparison["results"]:
            m = result["metrics"]
            lines.append(
                "| "
                + " | ".join(
                    str(v)
                    for v in (
                        result["strategy"]["name"],
                        paired["fold"],
                        paired["seed"],
                        result["total_trades"],
                        m["net_profit"]["value"],
                        m["net_return"]["value"],
                        m["max_drawdown"]["value"],
                    )
                )
                + " |"
            )
    lines.extend(
        [
            "",
            "Curves: [CSV](curves.csv), [equity](equity.png), [drawdown](drawdown.png).",
            "",
            "Per-fold accounts reset; curves/returns are not a continuous compounded portfolio.",
            "Exploratory one-seed variants do not establish multi-seed superiority. Counterfactuals are not deployment-compatible.",
            "Final holdout is locked and is never evaluated by this report.",
            "",
        ]
    )
    return "\n".join(lines)


def publish_report(root, payload, action_paths):
    root = Path(root)
    validate("evaluation-report-v1", payload)
    protocol = load_protocol(root, payload["protocol_id"])
    parent = root / "artifacts/evaluations/reports"
    parent.mkdir(parents=True, exist_ok=True)
    directory = parent / (".report-" + uuid4().hex)
    directory.mkdir()
    (directory / "actions").mkdir()
    names = [*FILES, *(f"actions/{i}.jsonl" for i in range(len(action_paths)))]
    try:
        publish_file(directory / "report.json", (canonical(payload) + "\n").encode("utf-8"))
        publish_file(directory / "report.md", markdown(root, payload).encode("utf-8"))
        publish_file(directory / "curves.csv", curve_csv(root, payload["rows"]).encode("utf-8"))
        figures(root, directory, payload, protocol)
        for i, path in enumerate(action_paths):
            shutil.copyfile(path, directory / f"actions/{i}.jsonl")
        manifest = {name: file_hash(directory / name) for name in names}
        identity = digest(manifest)
        publish_file(directory / "manifest.json", (canonical(manifest) + "\n").encode("utf-8"))
        verify_report(root, directory, identity)
        target = parent / identity
        if target.exists():
            verify_report(root, target)
        else:
            directory.rename(target)
        return {
            "report_id": identity,
            "screen": payload["screen"],
            "semantic_sha256": payload["semantic_sha256"],
            "status": payload["status"],
        }
    finally:
        if directory.exists():
            for name in (*names, "manifest.json"):
                (directory / name).unlink(missing_ok=True)
            (directory / "actions").rmdir()
            directory.rmdir()


def verify_report(root, directory, expected_id=None):
    root, directory = Path(root), Path(directory)
    manifest = read_small(directory / "manifest.json")
    if digest(manifest) != (expected_id or directory.name):
        raise ValueError("evaluation_manifest_checksum")
    payload = read_small(directory / "report.json")
    validate("evaluation-report-v1", payload)
    expected = set(FILES) | {f"actions/{i}.jsonl" for i in range(len(payload["rows"]))}
    if set(manifest) != expected or any(
        file_hash(directory / name) != manifest[name] for name in expected
    ):
        raise ValueError("evaluation_file_checksum")
    semantic = {k: v for k, v in payload.items() if k != "semantic_sha256"}
    if digest(semantic) != payload["semantic_sha256"]:
        raise ValueError("evaluation_semantic_checksum")
    protocol = load_protocol(root, payload["protocol_id"], current=False)
    if payload["code_fingerprint"] != protocol["code_fingerprint"]:
        raise ValueError("evaluation_protocol_code_mismatch")
    from bybit_quant.evaluation.variants import configured

    seen = set()
    expected_keys = {
        (f, s, "base", "primary")
        for f in range(len(protocol["folds"]))
        for s in protocol["request"]["seeds"]
    }
    expected_keys |= {
        (f, s, n, "counterfactual")
        for f in range(len(protocol["folds"]))
        for s in protocol["request"]["seeds"]
        for n in STRESSES
    }
    expected_keys |= {
        (len(protocol["folds"]) - 1, protocol["request"]["seeds"][0], n, "exploratory")
        for n in EXPLORATORY
    }
    for i, row in enumerate(payload["rows"]):
        key = (row["fold"], row["seed"], row["name"], row["group"])
        if key not in expected_keys or key in seen:
            raise ValueError("evaluation_duplicate_or_unregistered_cell")
        seen.add(key)
        c = configured(protocol, row["seed"], row["name"])
        metadata, _, _ = verify_model(root / "artifacts/models" / identifier(row["model_id"]))
        trained = configured(
            protocol, row["seed"], "base" if row["group"] == "counterfactual" else row["name"]
        )
        path = root / "artifacts/simulations" / row["simulation_id"]
        report = verify_artifact(path)
        source = read_small(path / "manifest.json")
        scope = protocol["folds"][row["fold"]]["validation"]
        actions = list(records(directory / f"actions/{i}.jsonl"))
        risk = sorted(
            {
                r["reason"]
                for r in records(path / "events.jsonl")
                if r["kind"] == "risk" and r["reason"] in ("daily_loss_limit", "drawdown_limit")
            }
        )
        if (
            row["configuration"] != c
            or metadata["configuration_hash"] != config_hash(trained)
            or metadata["split"] != protocol["folds"][row["fold"]]
            or metadata["code_fingerprint"] != payload["code_fingerprint"]
            or metadata["dataset_fingerprint"] != protocol["dataset_fingerprint"]
            or metadata["simulation_policy"] != protocol["request"]["policy"]
            or metadata["parameter_sha256"] != row["parameter_sha256"]
            or metadata["normalizer_id"] != row["normalizer_id"]
            or row["deployment_compatible"] != (row["group"] != "counterfactual")
            or report != row["report"]
            or row["risk_breaches"] != risk
            or row["metrics"] != artifact_metrics(path, report, *scope)
            or [source["episode_start_ms"], source["episode_end_ms"]] != scope
            or source["configuration_hash"] != config_hash(c)
            or source["normalizer_id"] != row["normalizer_id"]
            or source["dataset_fingerprint"] != protocol["dataset_fingerprint"]
            or source["policy"] != protocol["request"]["policy"]
            or file_hash(directory / f"actions/{i}.jsonl") != source["actions_sha256"]
            or digest(actions) != row["action_sha256"]
        ):
            raise ValueError("evaluation_row_provenance_or_metric_mismatch")
    paired = set()
    for b in payload["baselines"]:
        key = (b["fold"], b["seed"])
        if key in paired or (*key, "base", "primary") not in seen:
            raise ValueError("evaluation_baseline_pair_mismatch")
        paired.add(key)
        comparison = verify_comparison(
            root / "artifacts/baselines" / b["comparison_id"], root / "artifacts/simulations"
        )
        primary = next(
            r
            for r in payload["rows"]
            if (r["fold"], r["seed"], r["name"], r["group"]) == (*key, "base", "primary")
        )
        for result in comparison["results"]:
            source = read_small(
                root / "artifacts/simulations" / result["simulation_id"] / "manifest.json"
            )
            if (
                source["configuration_hash"] != config_hash(primary["configuration"])
                or source["normalizer_id"] != primary["normalizer_id"]
                or source["dataset_fingerprint"] != protocol["dataset_fingerprint"]
                or source["policy"] != protocol["request"]["policy"]
                or [source["episode_start_ms"], source["episode_end_ms"]]
                != protocol["folds"][b["fold"]]["validation"]
            ):
                raise ValueError("unmatched_baseline_costs_or_scope")
    if not payload["failures"] and (
        seen != expected_keys
        or len(paired) != len(protocol["folds"]) * len(protocol["request"]["seeds"])
    ):
        raise ValueError("evaluation_missing_expected_experiments")
    expected_status = (
        "contains_failures"
        if payload["failures"] or any(r["report"]["status"] == "invalid" for r in payload["rows"])
        else "completed_research"
    )
    if payload["status"] != expected_status or payload["screen"] != screen(
        root, protocol, payload["rows"], payload["baselines"], payload["failures"]
    ):
        raise ValueError("evaluation_screen_recomputation_mismatch")
    if (directory / "curves.csv").read_text("utf-8") != curve_csv(root, payload["rows"]):
        raise ValueError("evaluation_curve_mismatch")
    if payload["legacy_review_id"]:
        from bybit_quant.evaluation.compatibility import verify_review

        verify_review(root, payload["legacy_review_id"], current=False)
    return payload
