import json
import subprocess
import sys
import threading
from copy import deepcopy

import pytest
from feature_helpers import START, config, source_snapshot
from jsonschema.exceptions import ValidationError
from simulation_helpers import MINUTE
from test_training import inputs as training_inputs

from bybit_quant.contracts import canonical, digest
from bybit_quant.dataset import file_hash
from bybit_quant.evaluation.compatibility import protected_core
from bybit_quant.evaluation.holdout import consume_once, freeze
from bybit_quant.evaluation.protocol import (
    check_protocol,
    load_protocol,
    register,
    walk_forward,
)
from bybit_quant.evaluation.reports import verify_report
from bybit_quant.evaluation.runner import run
from bybit_quant.evaluation.screen import screen
from bybit_quant.evaluation.variants import EXPLORATORY, STRESSES, variant
from bybit_quant.simulation.artifacts import read_small
from bybit_quant.training.preparation import validate_research_fold, validate_training


def inputs(tmp_path):
    d, c, train = training_inputs(tmp_path)
    c["features"]["enabled"].append({"id": "close_location", "timeframe": "1m"})
    store = tmp_path / "store"
    target = store / "artifacts/datasets" / train["dataset_id"]
    target.parent.mkdir(parents=True)
    d.directory.rename(target)
    (tmp_path / "config.json").write_text(canonical(c), "utf-8")
    (tmp_path / "source.json").write_text(canonical(source_snapshot()), "utf-8")
    request = {
        "version": "1",
        "dataset_id": train["dataset_id"],
        "configuration_file": "config.json",
        "source_snapshot_file": "source.json",
        "policy": train["policy"],
        "range_start_ms": START,
        "range_end_ms": START + 120 * MINUTE,
        "seeds": [42, 43, 44],
        "folds": 2,
        "purge_bars": 1,
        "ablation": c["features"]["enabled"][-1],
        "train_timesteps": 64,
        "n_steps": 16,
        "batch_size": 8,
        "ppo_epochs": 2,
        "resources": train["resources"],
        "max_new_trainings": 12,
        "max_total_train_steps": 1000,
        "suite_wall_seconds": 240,
        "suite_memory_mb": 3072,
        "legacy_model_id": None,
    }
    path = tmp_path / "request.json"
    path.write_text(canonical(request), "utf-8")
    return store, path, request, c


def test_expanding_folds_purge_nonoverlap_and_locked_holdout():
    folds = walk_forward(START, START + 1440 * MINUTE, MINUTE, 2, 1)
    assert folds[0]["train"] == [START, START + 611 * MINUTE]
    assert folds[0]["validation"] == [START + 612 * MINUTE, START + 918 * MINUTE]
    assert folds[1]["train"] == [START, START + 917 * MINUTE]
    assert folds[1]["validation"] == [START + 918 * MINUTE, START + 1224 * MINUTE]
    assert all(f["holdout"] == [START + 1224 * MINUTE, START + 1440 * MINUTE] for f in folds)
    for fold in folds:
        validate_research_fold(config(), START, START + 1440 * MINUTE, fold)


@pytest.mark.parametrize(
    "change", ["duplicate_seed", "budget", "ablation", "gates", "fold", "scope"]
)
def test_protocol_rejects_mutation_weakening_and_budget_overrun(tmp_path, change):
    root, path, _, _ = inputs(tmp_path)
    identity = register(root, path)
    protocol = load_protocol(root, identity)
    if change == "duplicate_seed":
        protocol["request"]["seeds"][1] = 42
    elif change == "budget":
        protocol["request"]["max_new_trainings"] = 10
    elif change == "ablation":
        protocol["request"]["ablation"] = {"id": "rsi", "timeframe": "15m"}
    elif change == "gates":
        protocol["gates"]["min_oos_ms"] = 0
    elif change == "fold":
        protocol["folds"][0]["validation"][1] += MINUTE
    else:
        protocol["configuration"]["exit"].update(mode="AI_EXIT", fixed_tp_enabled=False, rr=None)
    with pytest.raises((ValueError, ValidationError)):
        check_protocol(protocol)


def test_registered_protocol_is_immutable_and_path_independent(tmp_path):
    root, path, _, _ = inputs(tmp_path)
    identity = register(root, path)
    assert register(root, path) == identity
    target = root / "artifacts/evaluations/protocols" / (identity + ".json")
    value = read_small(target)
    assert value["planned_training_runs"] == 11 and value["planned_train_steps"] == 704
    assert "configuration_file" not in value["request"]
    value["request"]["seeds"] = [1, 2, 3]
    target.write_text(canonical(value), "utf-8")
    with pytest.raises(ValueError, match="checksum"):
        load_protocol(root, identity)


def test_registration_cannot_move_reserved_holdout(tmp_path):
    root, path, request, _ = inputs(tmp_path)
    register(root, path)
    request["range_start_ms"] += MINUTE
    path.write_text(canonical(request), "utf-8")
    with pytest.raises(ValueError):
        register(root, path)


def test_holdout_consumption_blocks_overlapping_periods_across_protocols(tmp_path):
    scope = {"source": "bybit-mainnet", "symbol": "BTCUSDT", "timeframe": "1m", "range": [100, 200]}
    consume_once(tmp_path, digest("first"), "selection_a", lambda: "ok", scope=scope)
    with pytest.raises(ValueError, match="overlapping"):
        consume_once(
            tmp_path,
            digest("second"),
            "selection_b",
            lambda: pytest.fail("must not infer"),
            scope={**scope, "range": [150, 250]},
        )
    assert (
        consume_once(
            tmp_path,
            digest("third"),
            "selection_c",
            lambda: "next_period",
            scope={**scope, "range": [200, 300]},
        )
        == "next_period"
    )


def test_counterfactuals_change_costs_or_rr_but_not_hard_risk_and_retraining_shapes():
    c = config()
    fees = variant(c, "fee_2x")
    assert fees["execution"]["taker_fee_rate"] == "0.002"
    assert fees["stop_loss"]["fee_allowance_rate"] == "0.004"
    slip = variant(c, "slippage_2x")
    assert slip["execution"]["slippage_bps"] == "10"
    assert all(variant(c, n)["risk"] == c["risk"] for n in STRESSES)
    assert variant(c, "rr_1_5")["exit"]["rr"] == "1.5"
    assert variant(c, "rr_3")["exit"]["rr"] == "3"
    assert variant(c, "ai_exit")["exit"]["rr"] is None
    assert not variant(c, "fixed_rr")["exit"]["ai_close_enabled"]
    assert (
        len(variant(c, "feature_drop", c["features"]["enabled"][-1])["features"]["enabled"])
        == len(c["features"]["enabled"]) - 1
    )
    assert variant(c, "medium")["network"]["policy_layers"] == [128, 64]
    assert variant(c, "large")["network"]["policy_layers"] == [256, 128, 64]


def test_architectures_require_explicit_research_scope(tmp_path):
    _, c, t = training_inputs(tmp_path)
    for name in ("medium", "large"):
        changed = variant(c, name)
        with pytest.raises(ValueError, match="unsupported_training_architecture"):
            validate_training(changed, t["resources"])
        assert validate_training(changed, t["resources"], research=True) == changed


def test_exact_protected_m8_core_is_unchanged():
    rule = protected_core()
    assert (
        rule["from_code_fingerprint"]
        == "472b5acd801b17c326148c35affa4e62ab6a02307728f7ab3889ff405dc0af7c"
    )
    assert len(rule["protected_files"]) == 59


def gate_fixture(root, *, positive=True):
    protocol = {
        "request": {"seeds": [42, 43, 44]},
        "configuration": config(),
        "folds": walk_forward(START, START + 100 * 86400000, MINUTE, 2, 1),
    }
    rows, baselines = [], []
    for f in range(2):
        for seed in (42, 43, 44):
            sim = digest([f, seed])
            path = root / "artifacts/simulations" / sim
            path.mkdir(parents=True)
            trades = [{"net_pnl": "3" if i % 2 else "-1"} for i in range(30)] if positive else []
            (path / "trades.jsonl").write_text(
                "".join(canonical(t) + "\n" for t in trades), "utf-8"
            )
            base = {
                "group": "primary",
                "name": "base",
                "fold": f,
                "seed": seed,
                "simulation_id": sim,
                "report": {"status": "completed_restricted"},
                "metrics": {
                    "net_return": {"value": "0.03" if positive else "0"},
                    "max_drawdown": {"value": "0.01"},
                },
                "risk_breaches": [],
            }
            rows.append(base)
            rows.extend({**base, "group": "counterfactual", "name": name} for name in STRESSES)
            comparison_id = digest(["baseline", f, seed])
            directory = root / "artifacts/baselines" / comparison_id
            directory.mkdir(parents=True)
            (directory / "comparison.json").write_text(
                canonical(
                    {
                        "results": [
                            {"strategy": {"name": name}, "metrics": {"net_return": {"value": "0"}}}
                            for name in ("hold", "ema_crossover")
                        ]
                    }
                ),
                "utf-8",
            )
            baselines.append({"fold": f, "seed": seed, "comparison_id": comparison_id})
    return protocol, rows, baselines


def test_prespecified_gate_pass_and_statistics_use_all_seeds_not_best(tmp_path):
    protocol, rows, baselines = gate_fixture(tmp_path)
    result = screen(tmp_path, protocol, rows, baselines, [])
    assert result["status"] == "research_screen_pass" and result["eligible_for_frozen_holdout"]
    assert len(result["per_seed"]) == 3 and all(
        s["profit_factor"] == "3" for s in result["per_seed"]
    )
    assert result["dispersion"] == {"mean": "0.03", "median": "0.03", "sample_std": "0"}
    for row in rows:
        if row["seed"] == 44 and row["group"] == "primary":
            row["metrics"] = deepcopy(row["metrics"])
            row["metrics"]["net_return"]["value"] = "-0.01"
    result = screen(tmp_path, protocol, rows, baselines, [])
    assert not result["eligible_for_frozen_holdout"]
    assert "nonpositive_primary_seed_return" in result["reasons"]
    assert result["dispersion"]["sample_std"] != "0"


def test_sparse_undefined_metrics_and_risk_cannot_promote(tmp_path):
    protocol, rows, baselines = gate_fixture(tmp_path, positive=False)
    rows[0]["risk_breaches"] = ["daily_loss_limit"]
    result = screen(tmp_path, protocol, rows, baselines, [])
    assert result["status"] == "insufficient_evidence"
    assert "undefined_required_profit_factor" in result["reasons"]
    assert "daily_or_drawdown_risk_breach" in result["reasons"]
    assert all(s["profit_factor"] is None for s in result["per_seed"])


def test_eligible_freeze_uses_reference_seed_and_last_fold_not_best(tmp_path, monkeypatch):
    from bybit_quant.evaluation import holdout

    candidate = {
        "group": "primary",
        "seed": 42,
        "fold": 1,
        "model_id": digest("reference"),
        "parameter_sha256": digest("weights"),
        "configuration": config(),
        "normalizer_id": digest("normalizer"),
    }
    report = {
        "screen": {"eligible_for_frozen_holdout": True},
        "protocol_id": digest("protocol"),
        "rows": [{**candidate, "seed": 44, "model_id": digest("best")}, candidate],
    }
    protocol = {
        "request": {"seeds": [42, 43, 44]},
        "folds": [{"holdout": [100, 200]}, {"holdout": [100, 200]}],
    }
    monkeypatch.setattr(holdout, "verify_report", lambda *args: report)
    monkeypatch.setattr(holdout, "load_protocol", lambda *args: protocol)
    identity = freeze(tmp_path, digest("report"))
    selection = read_small(tmp_path / "artifacts/evaluations/selections" / (identity + ".json"))
    assert selection["model_id"] == candidate["model_id"]
    assert selection["holdout"] == [100, 200] and selection["execution_ready"] is False
    assert freeze(tmp_path, digest("report")) == identity


def test_final_holdout_once_only_and_failure_is_consumed(tmp_path):
    key = digest("source/pair/timeframe/holdout-range")
    calls = []
    assert consume_once(tmp_path, key, "selection", lambda: calls.append(1) or {"pnl": "-1"}) == {
        "pnl": "-1"
    }
    with pytest.raises(FileExistsError):
        consume_once(tmp_path, key, "different-protocol", lambda: calls.append(2))
    assert calls == [1]
    failed = digest("other-period")
    with pytest.raises(ValueError):
        consume_once(
            tmp_path, failed, "selection", lambda: (_ for _ in ()).throw(ValueError("invalid"))
        )
    assert read_small(tmp_path / (failed + ".json"))["state"] == "failed_consumed"
    with pytest.raises(FileExistsError):
        consume_once(tmp_path, failed, "retry", lambda: True)


def test_holdout_racing_consumers_get_one_reservation(tmp_path):
    barrier = threading.Barrier(2)
    results = []
    key = digest("race")

    def call():
        barrier.wait()
        try:
            consume_once(tmp_path, key, "selection", lambda: {"complete": True})
            results.append("won")
        except FileExistsError:
            results.append("consumed")

    threads = [threading.Thread(target=call) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=3)
    assert sorted(results) == ["consumed", "won"]


def test_full_walk_forward_baselines_stresses_retraining_cache_report_and_cli(tmp_path):
    root, path, _, _ = inputs(tmp_path)
    protocol_id = register(root, path)
    first = run(root, protocol_id)
    directory = root / "artifacts/evaluations/reports" / first["report_id"]
    report = verify_report(root, directory)
    assert report["status"] == "completed_research", report["failures"]
    assert len(report["rows"]) == 35 and len(report["baselines"]) == 6
    assert len([r for r in report["rows"] if r["group"] == "primary"]) == 6
    assert {r["name"] for r in report["rows"] if r["group"] == "exploratory"} == set(EXPLORATORY)
    assert all(
        not r["deployment_compatible"] for r in report["rows"] if r["group"] == "counterfactual"
    )
    assert not report["screen"]["eligible_for_frozen_holdout"]
    assert "insufficient_unique_oos_duration" in report["screen"]["reasons"]
    assert (directory / "equity.png").stat().st_size > 1000 and (
        directory / "drawdown.png"
    ).stat().st_size > 1000
    assert (
        "fold,seed,simulation_id,time_ms,phase,equity,peak,drawdown"
        in (directory / "curves.csv").read_text()
    )
    assert run(root, protocol_id) == first  # Verified model cache; no second gradient training.
    assert len(list((root / "artifacts/training-jobs").glob("*/status.json"))) == 11
    with pytest.raises(ValueError, match="does_not_allow_holdout"):
        freeze(root, first["report_id"])
    assert not (root / "artifacts/evaluations/holdout-use").exists()
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "bybit_quant",
            "evaluation-report",
            "--root",
            str(root),
            "--report",
            first["report_id"],
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["report_id"] == first["report_id"]
    # A rewritten outer hash cannot make falsified financial metrics legitimate.
    forged = deepcopy(report)
    forged["rows"][0]["metrics"]["net_return"]["value"] = "123"
    forged["semantic_sha256"] = digest({k: v for k, v in forged.items() if k != "semantic_sha256"})
    (directory / "report.json").write_text(canonical(forged), "utf-8")
    manifest = read_small(directory / "manifest.json")
    manifest["report.json"] = file_hash(directory / "report.json")
    (directory / "manifest.json").write_text(canonical(manifest), "utf-8")
    with pytest.raises(ValueError, match="row_provenance_or_metric"):
        verify_report(root, directory, digest(manifest))
