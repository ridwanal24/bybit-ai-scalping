"""Predeclared conservative research screen; descriptive correlated seeds, no live promotion."""

from bybit_quant.contracts import validate
from bybit_quant.dataset import records
from bybit_quant.evaluation.protocol import GATES
from bybit_quant.evaluation.variants import STRESSES
from bybit_quant.simulation.artifacts import read_small
from bybit_quant.simulation.numeric import ZERO, decimal, exact, wire


@exact
def screen(root, protocol, rows, baselines, failures):
    request = protocol["request"]
    reasons = []
    duration = sum(f["validation"][1] - f["validation"][0] for f in protocol["folds"])
    if duration < GATES["min_oos_ms"]:
        reasons.append("insufficient_unique_oos_duration")
    if failures or any(r["report"]["status"] != "completed_restricted" for r in rows):
        reasons.append("invalid_or_failed_experiment")
    cap = decimal(protocol["configuration"]["risk"]["max_drawdown"])
    per_seed = []
    for seed in request["seeds"]:
        primary = [r for r in rows if r["group"] == "primary" and r["seed"] == seed]
        if len(primary) != len(protocol["folds"]) or len({r["fold"] for r in primary}) != len(
            primary
        ):
            reasons.append("missing_primary_folds")
            continue
        if any(r["metrics"]["net_return"]["value"] is None for r in primary):
            reasons.append("undefined_primary_metrics")
            continue
        returns = [decimal(r["metrics"]["net_return"]["value"]) for r in primary]
        mean = sum(returns, ZERO) / len(returns)
        positives, negatives = ZERO, ZERO
        trades = 0
        for r in primary:
            for trade in records(
                root / "artifacts/simulations" / r["simulation_id"] / "trades.jsonl"
            ):
                value = decimal(trade["net_pnl"])
                trades += 1
                positives += max(ZERO, value)
                negatives += max(ZERO, -value)
        pf = positives / negatives if negatives else None
        worst = max(decimal(r["metrics"]["max_drawdown"]["value"]) for r in primary)
        per_seed.append(
            {
                "seed": seed,
                "folds": len(primary),
                "trades": trades,
                "mean_return": wire(mean),
                "profit_factor": None if pf is None else wire(pf),
                "worst_drawdown": wire(worst),
            }
        )
        if trades < GATES["min_trades_per_seed"]:
            reasons.append("insufficient_trades_per_seed")
        if mean <= 0:
            reasons.append("nonpositive_primary_seed_return")
        if pf is None:
            reasons.append("undefined_required_profit_factor")
        elif pf < decimal(GATES["min_profit_factor"]):
            reasons.append("profit_factor_below_gate")
        matching = [b for b in baselines if b["seed"] == seed]
        if len(matching) != len(primary):
            reasons.append("missing_matched_baselines")
        else:
            for strategy in ("hold", "ema_crossover"):
                baseline_returns = []
                for b in matching:
                    comparison = read_small(
                        root / "artifacts/baselines" / b["comparison_id"] / "comparison.json"
                    )
                    result = next(
                        r for r in comparison["results"] if r["strategy"]["name"] == strategy
                    )
                    value = result["metrics"]["net_return"]["value"]
                    if value is None:
                        reasons.append("undefined_baseline_metrics")
                    else:
                        baseline_returns.append(decimal(value))
                if len(baseline_returns) != len(primary) or mean <= sum(
                    baseline_returns, ZERO
                ) / len(primary):
                    reasons.append("does_not_beat_" + strategy)
        for name in STRESSES:
            stress = [
                r
                for r in rows
                if r["group"] == "counterfactual" and r["name"] == name and r["seed"] == seed
            ]
            values = [
                decimal(r["metrics"]["net_return"]["value"])
                for r in stress
                if r["metrics"]["net_return"]["value"] is not None
            ]
            if len(values) != len(primary) or sum(values, ZERO) / len(primary) <= 0:
                reasons.append("nonpositive_or_missing_stress_" + name)
    for r in rows:
        if r["group"] not in ("primary", "counterfactual"):
            continue
        value = r["metrics"]["max_drawdown"]["value"]
        if value is None or decimal(value) > cap:
            reasons.append("drawdown_or_undefined_risk")
        if r["risk_breaches"]:
            reasons.append("daily_or_drawdown_risk_breach")
    values = sorted(decimal(r["mean_return"]) for r in per_seed)
    if values:
        mean = sum(values, ZERO) / len(values)
        median = (
            values[len(values) // 2]
            if len(values) % 2
            else (values[len(values) // 2 - 1] + values[len(values) // 2]) / 2
        )
        std = (
            (sum(((v - mean) ** 2 for v in values), ZERO) / (len(values) - 1)).sqrt()
            if len(values) > 1
            else None
        )
        dispersion = {
            "mean": wire(mean),
            "median": wire(median),
            "sample_std": None if std is None else wire(std),
        }
    else:
        dispersion = {"mean": None, "median": None, "sample_std": None}
    if len(per_seed) < GATES["min_seeds"]:
        reasons.append("insufficient_seed_results")
    reasons = sorted(set(reasons))
    insufficient = any(r.startswith(("insufficient", "missing")) for r in reasons)
    result = {
        "eligible_for_frozen_holdout": not reasons,
        "status": "research_screen_pass"
        if not reasons
        else "insufficient_evidence"
        if insufficient
        else "not_eligible",
        "reasons": reasons,
        "gates": GATES,
        "execution_ready": False,
        "unique_oos_ms": duration,
        "per_seed": per_seed,
        "dispersion": dispersion,
    }
    validate("evaluation-screen-v1", result)
    return result
