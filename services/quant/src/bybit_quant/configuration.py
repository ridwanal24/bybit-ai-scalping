"""M2 semantic rules mirrored with exact Decimal arithmetic; conformance is shared."""

from decimal import Decimal, localcontext
from uuid import UUID

from bybit_quant.contracts import INTERVALS, canonical, config_canonical, config_hash, validate


def issues(c):
    with localcontext() as ctx:
        ctx.prec = 80
        return _issues(c)


def _issues(c):
    if len(canonical(c).encode("utf-8")) > 65536:
        return [("", "payload_too_large")]
    validate("configuration-v1", c)
    found = []

    def check(ok, field, code):
        if not ok:
            found.append((field, code))

    def positive(v, field):
        check(Decimal(v) > 0, field, "positive_required")

    def fraction(v, field, zero=False, one=False):
        n = Decimal(v)
        check((n >= 0 if zero else n > 0) and (n <= 1 if one else n < 1), field, "fraction_range")

    def unique(values, field):
        check(len(values) == len(set(values)), field, "duplicate_value")

    r, m, s, e, x, f, n, t = (
        c[k]
        for k in (
            "risk",
            "market",
            "stop_loss",
            "exit",
            "execution",
            "features",
            "network",
            "training",
        )
    )
    positive(r["initial_capital"], "risk.initial_capital")
    positive(r["max_position_notional"], "risk.max_position_notional")
    for key in ("risk_per_trade", "daily_loss_limit", "max_drawdown"):
        fraction(r[key], f"risk.{key}")
    fraction(r["max_margin_fraction"], "risk.max_margin_fraction", one=True)
    check(
        Decimal(r["risk_per_trade"]) <= Decimal(r["daily_loss_limit"]),
        "risk.risk_per_trade",
        "risk_budget_order",
    )
    check(
        Decimal(r["daily_loss_limit"]) <= Decimal(r["max_drawdown"]),
        "risk.daily_loss_limit",
        "risk_budget_order",
    )
    check(
        Decimal(r["min_available_margin"]) < Decimal(r["initial_capital"]),
        "risk.min_available_margin",
        "margin_vs_capital",
    )
    check(
        m["historical_start_ms"] < m["historical_end_ms"],
        "market.historical_end_ms",
        "historical_range",
    )
    check(
        all(
            m[k] % INTERVALS[m["timeframe"]] == 0
            for k in ("historical_start_ms", "historical_end_ms")
        ),
        "market",
        "candle_boundary",
    )
    unique(m["secondary_timeframes"], "market.secondary_timeframes")
    check(
        all(INTERVALS[tf] > INTERVALS[m["timeframe"]] for tf in m["secondary_timeframes"]),
        "market.secondary_timeframes",
        "higher_timeframe_required",
    )
    positive(s["atr_multiplier"], "stop_loss.atr_multiplier")
    for key in ("min_stop_fraction", "max_stop_fraction"):
        fraction(s[key], f"stop_loss.{key}")
    check(
        Decimal(s["min_stop_fraction"]) <= Decimal(s["max_stop_fraction"]),
        "stop_loss.min_stop_fraction",
        "stop_distance_order",
    )
    if e["rr"] is not None:
        positive(e["rr"], "exit.rr")
    tp = e["mode"] != "AI_EXIT"
    check(
        e["fixed_tp_enabled"] == tp and e["ai_close_enabled"] == (e["mode"] != "FIXED_RR"),
        "exit",
        "exit_mode_conflict",
    )
    check(not tp or e["rr"] is not None, "exit.rr", "rr_required")
    fraction(x["taker_fee_rate"], "execution.taker_fee_rate", zero=True)
    maker = Decimal(x["maker_fee_rate"])
    check(-1 < maker < 1, "execution.maker_fee_rate", "fee_range")
    for key in ("spread_bps", "slippage_bps"):
        check(Decimal(x[key]) < 10000, f"execution.{key}", "bps_range")
    funding = x["funding"]
    check(
        (funding["rate"] is None) == (funding["mode"] == "historical"),
        "execution.funding.rate",
        "funding_mode_conflict",
    )
    if funding["rate"] is not None:
        check(-1 < Decimal(funding["rate"]) < 1, "execution.funding.rate", "funding_range")
    check(
        Decimal(s["fee_allowance_rate"]) >= 2 * max(maker, Decimal(x["taker_fee_rate"])),
        "stop_loss.fee_allowance_rate",
        "fee_allowance_insufficient",
    )
    check(
        Decimal(s["slippage_allowance_bps"])
        >= Decimal(x["slippage_bps"]) + Decimal(x["spread_bps"]),
        "stop_loss.slippage_allowance_bps",
        "slippage_allowance_insufficient",
    )
    check(
        s["trigger_reference"] == x["stop_trigger_reference"],
        "execution.stop_trigger_reference",
        "trigger_reference_conflict",
    )
    unique([item["id"] + ":" + item["timeframe"] for item in f["enabled"]], "features.enabled")
    check(
        all(
            item["timeframe"] in [m["timeframe"], *m["secondary_timeframes"]]
            for item in f["enabled"]
        ),
        "features.enabled",
        "feature_timeframe_missing",
    )
    for key in ("position_inputs", "risk_inputs"):
        unique(f[key], f"features.{key}")
    p = f["periods"]
    check(p["ema_fast"] < p["ema_slow"] < p["ema_long"], "features.periods", "ema_period_order")
    check(p["macd_fast"] < p["macd_slow"], "features.periods", "macd_period_order")
    check(s["atr_period"] == p["atr"], "features.periods.atr", "atr_period_conflict")
    presets = {"Small": [64, 64], "Medium": [128, 64], "Large": [256, 128, 64]}
    if n["preset"] != "Custom":
        check(
            n["policy_layers"] == n["value_layers"] == presets[n["preset"]],
            "network",
            "network_preset_conflict",
        )
    if n["input_dimension"] is not None:
        check(
            parameter_count(c, n["input_dimension"]) <= 2000000,
            "network.input_dimension",
            "parameter_budget_exceeded",
        )
    positive(t["learning_rate"], "training.learning_rate")
    fraction(t["gamma"], "training.gamma", one=True)
    fraction(t["gae_lambda"], "training.gae_lambda", zero=True, one=True)
    fraction(t["clip_range"], "training.clip_range")
    fraction(t["entropy_coefficient"], "training.entropy_coefficient", zero=True)
    check(
        t["batch_size"] <= t["n_steps"] and t["n_steps"] % t["batch_size"] == 0,
        "training.batch_size",
        "batch_rollout_conflict",
    )
    check(
        t["observation_window"] == f["observation_window"],
        "training.observation_window",
        "window_conflict",
    )
    check(
        t["episode_length_bars"] > t["observation_window"],
        "training.episode_length_bars",
        "episode_too_short",
    )
    return found


def parameter_count(c, dimension):
    total = 0
    for key, output in (("policy_layers", 5), ("value_layers", 1)):
        previous = dimension
        for size in [*c["network"][key], output]:
            total += (previous + 1) * size
            previous = size
    return total


def configuration(c):
    errors = issues(c)
    if errors:
        raise ValueError(f"invalid_configuration:{errors}")
    return config_canonical(c)


def snapshot_document(value):
    """Accept API camelCase/payload or the explicit portable snake_case envelope."""
    if "payload" in value:
        if "configuration" in value or "config_hash" in value:
            raise ValueError("ambiguous_snapshot_envelope")
        c, expected = configuration(value["payload"]), value["configHash"]
    else:
        c, expected = configuration(value["configuration"]), value["config_hash"]
    UUID(value["id"])
    if expected != config_hash(c):
        raise ValueError("configuration_snapshot_checksum")
    return {"id": value["id"], "config_hash": expected, "configuration": c}
