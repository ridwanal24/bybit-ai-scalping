"""Exact net-trade metrics; sampled exposure is a declared OHLC approximation."""

from bybit_quant.contracts import validate
from bybit_quant.dataset import records
from bybit_quant.simulation.numeric import ZERO, D, decimal, exact, wire


def defined(value=None, reason=None):
    return {"value": None if value is None else wire(value), "reason": reason}


@exact
def metrics(report, trades, equity, start, end):
    names = (
        "net_profit",
        "net_return",
        "max_drawdown",
        "profit_factor",
        "win_rate",
        "average_win",
        "average_loss",
        "expectancy",
        "average_holding_ms",
        "sampled_exposure",
        "fees",
        "funding",
        "slippage_cost",
        "sharpe",
    )
    if report["status"] == "invalid":
        return {name: defined(reason="invalid_simulation") for name in names}
    count = wins = losses = 0
    positive = negative = net = duration = ZERO
    for trade in trades:
        value = decimal(trade["net_pnl"])
        count += 1
        net += value
        duration += D(trade["closed_ms"] - trade["opened_ms"])
        if value > 0:
            wins += 1
            positive += value
        elif value < 0:
            losses += 1
            negative -= value
    initial = decimal(report["initial_capital"])
    peak, drawdown, exposed, sampled = initial, ZERO, 0, 0
    for point in equity:
        value = decimal(point["equity"])
        peak = max(peak, value)
        drawdown = max(drawdown, (peak - value) / peak)
        if point["phase"] == "open":
            sampled += 1
            exposed += point["side"] != "FLAT"
    change = decimal(report["net_equity_change"])
    if count != report["trades"] or net != change or report["final_position"] != "FLAT":
        raise ValueError("baseline_metric_reconciliation")
    result = {
        "net_profit": defined(change),
        "net_return": defined(change / initial),
        "max_drawdown": defined(drawdown),
        "profit_factor": defined(positive / negative)
        if losses
        else defined(reason="no_losing_trades"),
        "win_rate": defined(D(wins) / count) if count else defined(reason="no_trades"),
        "average_win": defined(positive / wins) if wins else defined(reason="no_winning_trades"),
        "average_loss": defined(-negative / losses)
        if losses
        else defined(reason="no_losing_trades"),
        "expectancy": defined(net / count) if count else defined(reason="no_trades"),
        "average_holding_ms": defined(duration / count) if count else defined(reason="no_trades"),
        "sampled_exposure": defined(D(exposed) / sampled)
        if sampled
        else defined(reason="no_open_samples"),
        "fees": defined(decimal(report["fees"])),
        "funding": defined(decimal(report["funding"])),
        "slippage_cost": defined(reason="embedded_in_fills_not_separately_recorded"),
        "sharpe": defined(reason="annualization_and_sampling_not_established"),
    }
    if not start < end:
        raise ValueError("invalid_metric_range")
    validate("baseline-metrics-v1", result)
    return result


def artifact_metrics(directory, report, start, end):
    return metrics(
        report, records(directory / "trades.jsonl"), records(directory / "equity.jsonl"), start, end
    )
