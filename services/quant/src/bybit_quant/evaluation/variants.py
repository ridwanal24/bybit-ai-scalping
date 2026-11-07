"""Frozen exploratory retraining and counterfactual execution stresses, never deployment promotion."""

from copy import deepcopy

from bybit_quant.configuration import configuration
from bybit_quant.simulation.numeric import decimal, wire


def configured(protocol, seed, name="base"):
    c = deepcopy(protocol["configuration"])
    r = protocol["request"]
    c["training"].update(
        seed=seed,
        total_timesteps=r["train_timesteps"],
        n_steps=r["n_steps"],
        batch_size=r["batch_size"],
    )
    return variant(c, name, r["ablation"])


STRESSES = ("fee_2x", "slippage_2x", "rr_1_5", "rr_3")
EXPLORATORY = ("ai_exit", "fixed_rr", "feature_drop", "medium", "large")


def variant(c, name, ablation=None):
    c = deepcopy(c)
    if name == "fee_2x":
        fee = decimal(c["execution"]["taker_fee_rate"]) * 2
        c["execution"]["taker_fee_rate"] = wire(fee)
        c["stop_loss"]["fee_allowance_rate"] = wire(
            max(decimal(c["stop_loss"]["fee_allowance_rate"]), 2 * fee)
        )
    elif name == "slippage_2x":
        slip = decimal(c["execution"]["slippage_bps"]) * 2
        c["execution"]["slippage_bps"] = wire(slip)
        c["stop_loss"]["slippage_allowance_bps"] = wire(
            max(
                decimal(c["stop_loss"]["slippage_allowance_bps"]),
                2 * slip + decimal(c["execution"]["spread_bps"]),
            )
        )
    elif name in ("rr_1_5", "rr_3"):
        if c["exit"]["mode"] == "AI_EXIT":
            raise ValueError("rr_stress_requires_fixed_target")
        c["exit"]["rr"] = "1.5" if name == "rr_1_5" else "3"
    elif name in ("ai_exit", "fixed_rr"):
        c["exit"] = {
            "mode": "AI_EXIT" if name == "ai_exit" else "FIXED_RR",
            "fixed_tp_enabled": name != "ai_exit",
            "ai_close_enabled": name == "ai_exit",
            "rr": None if name == "ai_exit" else c["exit"]["rr"],
        }
    elif name == "feature_drop":
        if ablation not in c["features"]["enabled"] or len(c["features"]["enabled"]) < 2:
            raise ValueError("invalid_feature_ablation")
        c["features"]["enabled"].remove(ablation)
        c["network"]["input_dimension"] = None
    elif name in ("medium", "large"):
        layers = [128, 64] if name == "medium" else [256, 128, 64]
        c["network"].update(preset=name.title(), policy_layers=layers, value_layers=layers)
    elif name != "base":
        raise ValueError("unknown_evaluation_variant")
    return configuration(c)
