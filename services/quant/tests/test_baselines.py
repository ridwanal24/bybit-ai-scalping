import json
import subprocess
import sys
from copy import deepcopy
from uuid import uuid4

import pytest
from feature_helpers import START, source_snapshot
from jsonschema.exceptions import ValidationError
from simulation_helpers import MINUTE, config
from test_simulation_integration import inputs, revise_main

from bybit_quant.artifacts import save_normalizer
from bybit_quant.baselines.evaluator import compare, verify_comparison
from bybit_quant.baselines.metrics import metrics
from bybit_quant.baselines.strategies import Baseline
from bybit_quant.contracts import canonical, digest, validate
from bybit_quant.dataset import Dataset
from bybit_quant.simulation.artifacts import read_small
from bybit_quant.simulation.runner import run_dataset
from bybit_quant.simulation.state import MemorySink

STRATEGIES = [
    {"name": "hold"},
    {"name": "random", "seed": 42},
    {"name": "ema_crossover"},
    {"name": "buy_hold"},
]


def context(side="FLAT", allowed=True):
    return {"side": side, "trading_allowed": allowed}


def observe(agent, spread, gap=False):
    agent.observe({"values": {} if spread is None else {"ema_spread": spread}, "gap": gap})


def test_hold_and_single_attempt_buy_hold():
    rows = []
    hold = Baseline(STRATEGIES[0], config(), rows.append)
    assert [hold.decide(t, context()) for t in range(10)] == [0] * 10
    buy = Baseline(STRATEGIES[3], config(), rows.append)
    assert buy.decide(1, context(allowed=False)) == 0
    assert buy.decide(2, context()) == 1
    assert buy.decide(3, context("LONG")) == 0
    assert buy.decide(4, context()) == 0  # No retry/reentry after rejection or SL.
    assert rows[0] == {"decision_ms": 0, "action": 0}


@pytest.mark.parametrize("mode", ["AI_EXIT", "HYBRID", "FIXED_RR"])
def test_seeded_random_respects_position_and_exit_mode(mode):
    c = config()
    c["exit"]["mode"] = mode
    one = Baseline(STRATEGIES[1], c, lambda _: None)
    two = Baseline(STRATEGIES[1], c, lambda _: None)
    for side, allowed in (("FLAT", True), ("FLAT", False), ("LONG", True), ("SHORT", False)):
        expected = {0, 1, 2} if side == "FLAT" and allowed else {0}
        if side != "FLAT" and mode != "FIXED_RR":
            expected.add(3 if side == "LONG" else 4)
        a = [one.decide(t, context(side, allowed)) for t in range(100)]
        b = [two.decide(t, context(side, allowed)) for t in range(100)]
        assert a == b and set(a) == expected


def test_ema_strict_cross_close_then_entry_and_no_stop_reentry():
    agent = Baseline(STRATEGIES[2], config(), lambda _: None)
    observe(agent, None)
    observe(agent, -1)
    assert agent.decide(1, context()) == 0
    observe(agent, 0)
    observe(agent, 1)
    assert agent.decide(2, context("SHORT")) == 4
    assert agent.decide(3, context()) == 1
    assert agent.decide(4, context()) == 0
    observe(agent, -1)
    assert agent.decide(5, context("LONG")) == 3
    assert agent.decide(6, context()) == 2
    observe(agent, 1, gap=True)
    assert agent.decide(7, context()) == 0


def test_ema_fixed_rr_cannot_close_and_waits_for_risk_gate():
    c = config()
    c["exit"]["mode"] = "FIXED_RR"
    agent = Baseline(STRATEGIES[2], c, lambda _: None)
    observe(agent, -1)
    observe(agent, 1)
    assert agent.decide(1, context("SHORT")) == 0
    assert agent.decide(2, context(allowed=False)) == 0
    assert agent.decide(3, context()) == 1


@pytest.mark.parametrize(
    "spec",
    [
        {"name": "random"},
        {"name": "random", "seed": True},
        {"name": "random", "seed": -1},
        {"name": "random", "seed": 2**32},
        {"name": "hold", "seed": 0},
        {"name": "other"},
    ],
)
def test_strict_strategy_contract(spec):
    with pytest.raises(ValidationError):
        Baseline(spec, config(), lambda _: None)


def test_hand_calculated_metrics_include_costs_and_undefined():
    report = {
        "status": "completed_restricted",
        "initial_capital": "1000",
        "net_equity_change": "5",
        "final_position": "FLAT",
        "trades": 3,
        "fees": "2",
        "funding": "-1",
    }
    trades = [
        {"net_pnl": p, "opened_ms": 0, "closed_ms": d}
        for p, d in (("10", 100), ("-5", 200), ("0", 300))
    ]
    equity = [
        {"equity": e, "phase": phase, "side": side}
        for e, phase, side in (
            ("1000", "open", "LONG"),
            ("1010", "close", "LONG"),
            ("1005", "open", "FLAT"),
            ("1005", "terminal", "FLAT"),
        )
    ]
    result = metrics(report, trades, equity, 0, 1000)
    assert result["net_return"]["value"] == "0.005"
    assert result["profit_factor"]["value"] == "2"
    assert result["average_win"]["value"] == "10"
    assert result["average_loss"]["value"] == "-5"
    assert result["average_holding_ms"]["value"] == "200"
    assert result["sampled_exposure"]["value"] == "0.5"
    assert float(result["max_drawdown"]["value"]) == pytest.approx(5 / 1010)
    assert float(result["win_rate"]["value"]) == pytest.approx(1 / 3)
    assert result["slippage_cost"]["value"] is None
    assert result["sharpe"]["reason"]
    validate("baseline-metrics-v1", result)


def test_zero_trades_and_invalid_are_not_infinite_or_success_metrics():
    report = {
        "status": "completed_restricted",
        "initial_capital": "1000",
        "net_equity_change": "0",
        "final_position": "FLAT",
        "trades": 0,
        "fees": "0",
        "funding": "0",
    }
    result = metrics(report, [], [], 0, 100)
    assert result["net_profit"]["value"] == "0"
    assert result["win_rate"] == {"value": None, "reason": "no_trades"}
    assert result["profit_factor"] == {"value": None, "reason": "no_losing_trades"}
    report["status"] = "invalid"
    assert all(
        m == {"value": None, "reason": "invalid_simulation"}
        for m in metrics(report, [], [], 0, 100).values()
    )


def test_four_baseline_pipeline_replay_reload_and_corruption(tmp_path):
    d, c, n, p, _, _ = inputs(tmp_path)
    root, sims = tmp_path / "comparisons", tmp_path / "simulations"
    args = (root, sims, d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, STRATEGIES)
    first = compare(*args)
    assert first == compare(*args)
    directory = root / first["comparison_id"]
    comparison = verify_comparison(directory, sims)
    assert comparison["status"] == "completed_restricted"
    hold, random, ema, buy = comparison["results"]
    assert hold["total_trades"] == 0 and hold["metrics"]["net_profit"]["value"] == "0"
    assert random["total_trades"] > 0 and ema["total_trades"] > 0
    assert buy["total_trades"] == 1
    assert all(r["metrics"]["fees"]["value"] != "0" for r in (random, ema, buy))
    curve = sims / random["simulation_id"] / "equity.jsonl"
    assert curve.exists()
    # A recomputed outer hash cannot make different execution policies comparable.
    alternative_policy = deepcopy(p)
    alternative_policy["execution_latency_ms"] = MINUTE
    alternative = compare(
        root,
        sims,
        d,
        c,
        n,
        alternative_policy,
        START + 20 * MINUTE,
        START + 100 * MINUTE,
        [STRATEGIES[0]],
    )
    mixed = deepcopy(comparison)
    mixed["results"][0] = alternative["results"][0]
    (directory / "comparison.json").write_text(canonical(mixed), "utf-8")
    with pytest.raises(ValueError, match="baseline_incomparable_runs"):
        verify_comparison(directory, sims, digest(mixed))
    # Metrics cannot be forged even if the outer comparison digest is recomputed.
    altered = deepcopy(comparison)
    altered["results"][1]["metrics"]["net_profit"]["value"] = "999"
    (directory / "comparison.json").write_text(canonical(altered), "utf-8")
    with pytest.raises(ValueError, match="baseline_result_mismatch"):
        verify_comparison(directory, sims, digest(altered))
    (directory / "comparison.json").write_text(canonical(comparison), "utf-8")
    (directory / "actions-0.jsonl").write_text("{}\n", "utf-8")
    with pytest.raises(ValueError, match="script_checksum"):
        verify_comparison(directory, sims)


def test_different_seed_has_different_actions_and_duplicate_rejected(tmp_path):
    d, c, n, p, _, _ = inputs(tmp_path)
    strategies = [{"name": "random", "seed": seed} for seed in (1, 2)]
    result = compare(
        tmp_path / "out",
        tmp_path / "sims",
        d,
        c,
        n,
        p,
        START + 20 * MINUTE,
        START + 100 * MINUTE,
        strategies,
    )
    assert result["results"][0]["actions_sha256"] != result["results"][1]["actions_sha256"]
    with pytest.raises(ValueError, match="duplicate_baseline"):
        compare(
            tmp_path / "bad",
            tmp_path / "sims",
            d,
            c,
            n,
            p,
            START,
            START + MINUTE,
            [STRATEGIES[0], STRATEGIES[0]],
        )
    assert not (tmp_path / "bad").exists()


@pytest.mark.parametrize("spec", STRATEGIES)
def test_future_mutation_preserves_earlier_decisions_and_fills(tmp_path, spec):
    d, c, n, p, _, _ = inputs(tmp_path)

    def run():
        actions, sink = [], MemorySink()
        agent = Baseline(spec, c, actions.append)
        run_dataset(
            d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, strategy=agent, sink=sink
        )
        cutoff = START + 60 * MINUTE
        return (
            [a for a in actions if a["decision_ms"] < cutoff],
            [e for e in sink.rows["events"] if e["time_ms"] < cutoff],
        )

    before = run()
    revise_main(d, lambda rows: rows[80].update(high="120"))
    assert run() == before


def test_invalid_run_persists_diagnostics_and_excludes_performance(tmp_path):
    d, c, n, p, _, _ = inputs(tmp_path)
    # Seed42 opens SHORT first. A high-price shock breaches its collateral;
    # a nonnegative LONG price cannot prove bankruptcy at <=50%/1x exposure.
    revise_main(d, lambda rows: rows[20].update(high="2000"))
    result = compare(
        tmp_path / "out",
        tmp_path / "sims",
        d,
        c,
        n,
        p,
        START + 20 * MINUTE,
        START + 100 * MINUTE,
        [STRATEGIES[1]],
    )
    assert result["status"] == "contains_invalid"
    assert result["results"][0]["status"] == "invalid"
    assert result["results"][0]["metrics"]["net_return"]["reason"] == "invalid_simulation"
    verify_comparison(tmp_path / "out" / result["comparison_id"], tmp_path / "sims")


def test_cli_replays_and_sanitizes_bad_request(tmp_path):
    d, c, n, p, _, _ = inputs(tmp_path)
    store = tmp_path / "store"
    dataset_id = str(uuid4())
    dest = store / "artifacts/datasets" / dataset_id
    dest.parent.mkdir(parents=True)
    d.directory.rename(dest)
    save_normalizer(store / "artifacts/features", n)
    (tmp_path / "config.json").write_text(canonical(c), "utf-8")
    (tmp_path / "snapshot.json").write_text(canonical(source_snapshot()), "utf-8")
    request = {
        "version": "1",
        "dataset_id": dataset_id,
        "configuration_file": "config.json",
        "source_snapshot_file": "snapshot.json",
        "normalizer_id": n.id,
        "episode_start_ms": START + 20 * MINUTE,
        "episode_end_ms": START + 100 * MINUTE,
        "policy": p,
        "strategies": STRATEGIES,
    }
    path = tmp_path / "request.json"
    path.write_text(canonical(request), "utf-8")
    code = (
        "from pathlib import Path; import sys; from bybit_quant.baselines import cli; "
        "cli.ROOT=Path(sys.argv[1]); sys.argv=['bybit-quant','baseline-run','--request',sys.argv[2]]; "
        "from bybit_quant.__main__ import main; main()"
    )

    def run():
        return subprocess.run(
            [sys.executable, "-c", code, str(store), str(path)],
            capture_output=True,
            text=True,
            check=False,
        )

    one, two = run(), run()
    assert one.returncode == two.returncode == 0, one.stderr
    assert json.loads(one.stdout) == json.loads(two.stdout)
    revised = Dataset(dest, source_snapshot())
    revise_main(revised, lambda rows: rows[20].update(high="2000"))
    diagnostic = run()
    assert diagnostic.returncode == 2 and not diagnostic.stderr
    assert json.loads(diagnostic.stdout)["status"] == "contains_invalid"
    request["strategies"][1]["seed"] = "secret-invalid-seed"
    path.write_text(canonical(request), "utf-8")
    bad = run()
    assert bad.returncode == 1 and "secret" not in bad.stderr and not bad.stdout
    assert (
        read_small(
            store
            / "artifacts/baselines"
            / json.loads(one.stdout)["comparison_id"]
            / "comparison.json"
        )["execution_ready"]
        is False
    )
