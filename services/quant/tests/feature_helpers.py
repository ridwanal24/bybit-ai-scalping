"""Labeled synthetic export factory, independent of local Bybit artifacts."""

from copy import deepcopy

from bybit_quant.contracts import CONTRACTS, INTERVALS, canonical, config_hash, digest, strict_json
from bybit_quant.dataset import file_hash

START = 1735689600000


def config():
    return strict_json((CONTRACTS / "presets/research-small-hybrid-v1.json").read_text("utf-8"))


def small_config():
    c = config()
    c["features"]["periods"].update(
        ema_fast=2,
        ema_slow=3,
        ema_long=4,
        rsi=2,
        macd_fast=2,
        macd_slow=3,
        macd_signal=2,
        atr=2,
        rolling_return=2,
        volatility=2,
        volume=2,
    )
    c["stop_loss"]["atr_period"] = 2
    c["features"]["observation_window"] = c["training"]["observation_window"] = 2
    return c


def source_snapshot():
    return {
        "id": "00000000-0000-4000-8000-000000000001",
        "config_hash": config_hash(config()),
        "configuration": config(),
    }


def candles(n=100, tf="1m", closes=None):
    interval = INTERVALS[tf]
    closes = closes if closes is not None else [100 + i % 13 for i in range(n)]
    return [
        {
            "schema_version": "1",
            "source": "fixture",
            "category": "linear",
            "symbol": "BTCUSDT",
            "price_type": "last",
            "timeframe": tf,
            "open_time_ms": START + i * interval,
            "close_time_ms": START + (i + 1) * interval,
            "open": str(close - 1),
            "high": str(close + 2),
            "low": str(close - 3),
            "close": str(close),
            "volume": str(i + 1),
            "turnover": str((i + 1) * close),
            "availability_policy": "closed_candle_assumption_v1",
        }
        for i, close in enumerate(closes)
    ]


def streams(n=120):
    return {tf: candles(n * 60000 // INTERVALS[tf], tf) for tf in ("1m", "5m", "15m")}


def flat(t):
    return {
        "as_of_ms": t,
        "side": "FLAT",
        "mark": 100,
        "entry": 0,
        "quantity": 0,
        "stop": 0,
        "take_profit": None,
        "duration_bars": 0,
        "equity": 1000,
        "high_water_equity": 1000,
        "daily_start_equity": 1000,
        "available_margin": 1000,
        "remaining_daily_budget": 20,
        "trading_allowed": True,
    }


def exported_dataset(directory, n=120):
    directory.mkdir(parents=True, exist_ok=True)
    files, descriptors, quality_streams = [], [], []
    for tf, rows in streams(n).items():
        path = directory / f"last-{tf}.jsonl"
        path.write_text("".join(canonical(row) + "\n" for row in rows), "utf-8", newline="\n")
        descriptor = {
            "id": "last:" + tf,
            "start_ms": START,
            "end_ms": START + len(rows) * INTERVALS[tf],
            "count": len(rows),
            "sha256": file_hash(path),
        }
        descriptors.append(descriptor)
        files.append({"file": path.name, "sha256": file_hash(path), "count": len(rows)})
        q = deepcopy(descriptor)
        q.pop("sha256")
        q.update(expected=len(rows), missing=0, gaps=[], gaps_truncated=False)
        quality_streams.append(q)
    instrument = {
        "schema_version": "1",
        "source": "fixture",
        "category": "linear",
        "symbol": "BTCUSDT",
        "contract_type": "LinearPerpetual",
        "settlement": "USDT",
        "status": "Trading",
        "launch_time_ms": 0,
        "delivery_time_ms": 0,
        "tick_size": "0.1",
        "quantity_step": "0.001",
        "min_quantity": "0.001",
        "min_notional": "5",
        "max_limit_quantity": "100",
        "max_market_quantity": "10",
        "min_leverage": "1",
        "max_leverage": "100",
        "leverage_step": "0.01",
        "funding_interval_minutes": 480,
        "historical_validity": "current_observation_reference_only",
    }
    for name, rows in (("funding.jsonl", []), ("instrument.json", [instrument])):
        path = directory / name
        path.write_text("".join(canonical(row) + "\n" for row in rows), "utf-8", newline="\n")
        files.append({"file": name, "sha256": file_hash(path), "count": len(rows)})
    m = {
        "format_version": "1",
        "quality_policy": "strict_closed_v1",
        "source": "fixture",
        "symbol": "BTCUSDT",
        "category": "linear",
        "requested_start_ms": START,
        "requested_end_ms": START + n * 60000,
        "instrument_hash": digest(instrument),
        "streams": descriptors,
        "funding": {
            "count": 0,
            "sha256": files[-2]["sha256"],
            "coverage": "queried_range_historical_cadence_unverified",
        },
    }
    q = {
        "final": True,
        "candles_usable": True,
        "execution_ready": False,
        "streams": quality_streams,
        "counters": {
            key: 0
            for key in (
                "pages",
                "invalid",
                "duplicates",
                "conflicts",
                "out_of_order",
                "outside_range",
                "incomplete",
                "retries",
                "resumes",
            )
        },
        "funding": {
            "count": 0,
            "queried_start_ms": START,
            "queried_end_ms": START + n * 60000,
            "cadence_anomalies_vs_current_interval": 0,
            "coverage": "historical_cadence_unverified_no_zero_fill",
        },
        "metadata": {
            "historical_validity": "current_observation_reference_only",
            "instrument_observed_at": "2026-11-06T00:00:00Z",
            "pre_launch_requested": False,
        },
        "cutoff_ms": START + n * 60000 + 2000,
        "safety_delay_ms": 2000,
        "requested_range_clipped": False,
    }
    e = {
        "configuration_snapshot_id": "00000000-0000-4000-8000-000000000001",
        "configuration_hash": config_hash(config()),
        "files": files,
        "manifest": m,
        "fingerprint": digest(m),
        "quality": q,
    }
    write_export(directory, e)
    return e


def write_export(directory, exported):
    (directory / "manifest.json").write_text(canonical(exported) + "\n", "utf-8", newline="\n")
