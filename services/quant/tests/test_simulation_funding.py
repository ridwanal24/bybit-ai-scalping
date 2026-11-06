from copy import deepcopy

import pytest
from feature_helpers import START
from jsonschema.exceptions import ValidationError
from simulation_helpers import MINUTE, config, policy

from bybit_quant.simulation.funding import FundingCalendar
from bybit_quant.simulation.numeric import D


def record(t, rate="0.001"):
    return {
        "schema_version": "1",
        "source": "fixture",
        "category": "linear",
        "symbol": "BTCUSDT",
        "timestamp_ms": t,
        "rate": rate,
    }


def calendar_setup():
    c, p = config(), policy(end=START + 6 * MINUTE)
    p["funding_schedule"][0].update(interval_ms=2 * MINUTE, anchor_ms=START)
    manifest = {"requested_start_ms": START, "requested_end_ms": START + 6 * MINUTE}
    rows = [record(START + i * MINUTE) for i in (0, 2, 4)]
    return c, p, manifest, rows


def test_actual_event_rates_and_half_open_schedule_not_current_instrument_interval():
    c, p, m, rows = calendar_setup()
    rows[1]["rate"] = "-0.001"
    calendar = FundingCalendar(p, c, m, lambda: iter(rows))
    assert list(calendar.events()) == [
        (START, D(".001")),
        (START + 2 * MINUTE, D("-.001")),
        (START + 4 * MINUTE, D(".001")),
    ]


@pytest.mark.parametrize(
    "case", ["missing", "extra", "duplicate", "shift", "rate", "intrabar", "gap", "overlap"]
)
def test_schedule_or_data_ambiguity_is_rejected_before_run(case):
    c, p, m, rows = calendar_setup()
    if case == "missing":
        rows.pop(1)
    if case == "extra":
        rows.append(record(START + 6 * MINUTE))
    if case == "duplicate":
        rows.insert(1, deepcopy(rows[0]))
    if case == "shift":
        rows[1]["timestamp_ms"] += MINUTE
    if case == "rate":
        rows[0]["rate"] = "1"
    if case == "intrabar":
        p["funding_schedule"][0]["interval_ms"] = 90000
    if case == "gap":
        p["funding_schedule"][0]["start_ms"] += MINUTE
    if case == "overlap":
        p["funding_schedule"].append(deepcopy(p["funding_schedule"][0]))
    with pytest.raises((ValueError, ValidationError)):
        FundingCalendar(p, c, m, lambda: iter(rows))


def test_fixed_rate_requires_explicit_schedule_and_does_not_fabricate_historical_records():
    c, p, m, _ = calendar_setup()
    c["execution"]["funding"] = {"mode": "fixed_rate", "rate": "-0.002"}
    calendar = FundingCalendar(p, c, m, lambda: iter(()))
    assert list(calendar.events()) == [(START + i * MINUTE, D("-.002")) for i in (0, 2, 4)]


def test_changed_funding_input_is_rechecked_after_preflight():
    c, p, m, rows = calendar_setup()
    calendar = FundingCalendar(p, c, m, lambda: iter(rows))
    rows.pop()
    with pytest.raises(ValueError, match="missing_declared"):
        list(calendar.events())
