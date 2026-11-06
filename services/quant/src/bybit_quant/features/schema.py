"""Observation identity shared with TypeScript; does not mutate configuration."""

from bybit_quant.configuration import configuration, parameter_count
from bybit_quant.contracts import digest, validate


def observation_schema(c):
    c = configuration(c)
    f = c["features"]
    dimension = (
        f["observation_window"] * len(f["enabled"])
        + len(f["position_inputs"])
        + len(f["risk_inputs"])
    )
    if c["network"]["input_dimension"] not in (None, dimension):
        raise ValueError("input_dimension_mismatch")
    if parameter_count(c, dimension) > 2000000:
        raise ValueError("parameter_budget_exceeded")
    schema = {
        "version": "1",
        "formula_version": "1",
        "market": f["enabled"],
        "periods": f["periods"],
        "position": f["position_inputs"],
        "risk": f["risk_inputs"],
        "window": f["observation_window"],
        "dimension": dimension,
        "main_timeframe": c["market"]["timeframe"],
        "layout": "market_row_major_then_current_position_then_current_risk",
        "dtype": "float32-le",
        "normalization": "market_zscore_context_scaled_v1",
        "availability": "closed_asof_no_gap_fill_v1",
        "context_scale": {
            "initial_capital": c["risk"]["initial_capital"],
            "max_holding_bars": c["risk"]["max_holding_bars"],
            "risk_per_trade": c["risk"]["risk_per_trade"],
            "exit_mode": c["exit"]["mode"],
        },
    }
    validate("feature-v1", schema)
    return {"schema": schema, "sha256": digest(schema)}
