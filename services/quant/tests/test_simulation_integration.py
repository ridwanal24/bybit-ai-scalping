import json
import subprocess
import sys
from uuid import uuid4

import pytest
from feature_helpers import START, exported_dataset, source_snapshot
from jsonschema.exceptions import ValidationError
from simulation_helpers import MINUTE, config, policy

from bybit_quant.artifacts import save_normalizer
from bybit_quant.contracts import canonical, digest, strict_json
from bybit_quant.dataset import Dataset, file_hash
from bybit_quant.features.alignment import feature_rows
from bybit_quant.features.normalization import fit
from bybit_quant.simulation.artifacts import create_artifact, verify_artifact
from bybit_quant.simulation.runner import run_dataset
from bybit_quant.simulation.state import MemorySink


def inputs(tmp_path):
    data = tmp_path / "dataset"
    exported_dataset(data)
    dataset = Dataset(data, source_snapshot())
    c = config()
    normalizer = fit(
        feature_rows(dataset.bind(c), c), c, dataset.manifest, START, START + 20 * MINUTE
    )
    p = policy(end=START + 120 * MINUTE)
    p["funding_schedule"][0]["anchor_ms"] = START + 8 * 3600000
    # A declared fixed-rate event at START is prehistory for the trading episode.
    c["execution"]["funding"] = {"mode": "fixed_rate", "rate": "0.0001"}
    actions = [
        {"decision_ms": START + i * MINUTE, "action": a}
        for i, a in ((20, 1), (24, 3), (32, 2), (36, 4))
    ]
    path = tmp_path / "actions.jsonl"
    path.write_text("".join(canonical(row) + "\n" for row in actions), "utf-8", newline="\n")
    return dataset, c, normalizer, p, actions, path


def test_full_pipeline_executes_long_short_replays_and_reloads_exactly(tmp_path):
    d, c, n, p, actions, path = inputs(tmp_path)
    sink = MemorySink()
    report = run_dataset(
        d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, actions=actions, sink=sink
    )
    assert report["status"] == "completed_restricted"
    assert {t["side"] for t in sink.rows["trades"]} == {"LONG", "SHORT"}
    assert report["trades"] == 2 and report["observations_valid"] > 0
    assert sum(float(t["net_pnl"]) for t in sink.rows["trades"]) == pytest.approx(
        float(report["net_equity_change"])
    )
    root = tmp_path / "runs"
    first = create_artifact(root, d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, path)
    second = create_artifact(root, d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, path)
    assert first == second
    assert verify_artifact(root / first["artifact_id"]) == first["report"] == report
    target = root / first["artifact_id"] / "trades.jsonl"
    target.write_bytes(target.read_bytes() + b"{}\n")
    with pytest.raises(ValueError, match="checksum"):
        verify_artifact(root / first["artifact_id"])


def test_callback_gets_real_current_position_context_and_no_execution_bar_information(tmp_path):
    d, c, n, p, _, _ = inputs(tmp_path)
    seen = []

    def callback(t, observation):
        seen.append((t, observation["values"][-11]))
        assert set(observation) == {
            "valid",
            "decision_ms",
            "schema_hash",
            "normalizer_id",
            "values",
        }
        return 1 if t == START + 20 * MINUTE else 3 if t == START + 24 * MINUTE else 0

    report = run_dataset(d, c, n, p, START + 20 * MINUTE, START + 40 * MINUTE, callback=callback)
    assert report["trades"] == 1
    assert seen[0] == (START + 20 * MINUTE, 0.0)
    assert seen[1][1] == 1.0


@pytest.mark.parametrize(
    "actions",
    [
        [{"decision_ms": START, "action": True}],
        [{"decision_ms": START + 1, "action": 1}],
        [{"decision_ms": START, "action": 1}, {"decision_ms": START, "action": 2}],
        [{"decision_ms": START + MINUTE, "action": 1}, {"decision_ms": START, "action": 2}],
    ],
)
def test_bad_action_scripts_fail_without_publishing(tmp_path, actions):
    d, c, n, p, _, path = inputs(tmp_path)
    path.write_text("".join(canonical(a) + "\n" for a in actions), "utf-8", newline="\n")
    root = tmp_path / "runs"
    with pytest.raises((ValueError, ValidationError)):
        create_artifact(root, d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, path)
    assert not root.exists()


def test_invalid_capability_does_not_leave_partial_artifact(tmp_path):
    d, c, n, p, _, path = inputs(tmp_path)
    c["risk"]["max_leverage"] = 2
    root = tmp_path / "runs"
    with pytest.raises(ValueError, match="unsupported_leverage"):
        create_artifact(root, d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, path)
    assert list(root.iterdir()) == []


def test_cli_valid_request_replays_and_invalid_input_is_sanitized(tmp_path):
    d, c, n, p, _, actions = inputs(tmp_path)
    dataset_id = str(uuid4())
    store = tmp_path / "store"
    dest = store / "artifacts/datasets" / dataset_id
    dest.parent.mkdir(parents=True)
    d.directory.rename(dest)
    save_normalizer(store / "artifacts/features", n)
    config_path = tmp_path / "config.json"
    config_path.write_text(canonical(c), "utf-8")
    snapshot = tmp_path / "snapshot.json"
    snapshot.write_text(canonical(source_snapshot()), "utf-8")
    request = {
        "version": "1",
        "dataset_id": dataset_id,
        "configuration_file": str(config_path),
        "source_snapshot_file": str(snapshot),
        "normalizer_id": n.id,
        "actions_file": str(actions),
        "episode_start_ms": START + 20 * MINUTE,
        "episode_end_ms": START + 100 * MINUTE,
        "policy": p,
    }
    request_path = tmp_path / "request.json"
    request_path.write_text(canonical(request), "utf-8")
    code = "from pathlib import Path; import sys; from bybit_quant.simulation import cli; cli.ROOT=Path(sys.argv[1]); sys.argv=['bybit-quant','simulation-run','--request',sys.argv[2]]; from bybit_quant.__main__ import main; main()"

    def run():
        return subprocess.run(
            [sys.executable, "-c", code, str(store), str(request_path)],
            capture_output=True,
            text=True,
            check=False,
        )

    one, two = run(), run()
    assert one.returncode == two.returncode == 0, one.stderr
    assert json.loads(one.stdout) == json.loads(two.stdout)
    assert json.loads(one.stdout)["trades"] == 2
    revised = Dataset(dest, source_snapshot())
    revise_main(revised, lambda rows: rows[32].update(high="2000"))
    diagnostic = run()
    assert diagnostic.returncode == 2 and diagnostic.stderr == ""
    assert json.loads(diagnostic.stdout)["status"] == "invalid"
    assert json.loads(diagnostic.stdout)["reason"] == "bankruptcy"
    request["normalizer_id"] = "not-a-hash-secret"
    request_path.write_text(canonical(request), "utf-8")
    bad = run()
    assert bad.returncode == 1 and bad.stdout == "" and "secret" not in bad.stderr


def test_prehistory_has_no_position_or_cashflow_and_episode_end_cancels_future_actions(tmp_path):
    d, c, n, p, _, _ = inputs(tmp_path)
    sink = MemorySink()
    report = run_dataset(d, c, n, p, START + 20 * MINUTE, START + 40 * MINUTE, sink=sink)
    assert report["final_equity"] == "1000" and report["fees"] == "0" and report["trades"] == 0
    assert all(e["time_ms"] >= START + 20 * MINUTE for e in sink.rows["events"])


def revise_main(dataset, mutate):
    path = dataset.directory / "last-1m.jsonl"
    rows = [strict_json(line) for line in path.read_text("utf-8").splitlines()]
    mutate(rows)
    path.write_text("".join(canonical(row) + "\n" for row in rows), "utf-8", newline="\n")
    e = dataset.export
    for entry in e["files"]:
        if entry["file"] == path.name:
            entry["sha256"] = file_hash(path)
    for stream in e["manifest"]["streams"]:
        if stream["id"] == "last:1m":
            stream["sha256"] = file_hash(path)
    e["fingerprint"] = digest(e["manifest"])
    (dataset.directory / "manifest.json").write_text(canonical(e) + "\n", "utf-8", newline="\n")
    return Dataset(dataset.directory, source_snapshot())


def test_invalid_envelope_artifact_remains_diagnostic_and_reloads_without_fake_close(tmp_path):
    d, c, n, p, _, path = inputs(tmp_path)
    d = revise_main(d, lambda rows: rows[32].update(high="2000"))
    result = create_artifact(
        tmp_path / "runs", d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, path
    )
    report = verify_artifact(tmp_path / "runs" / result["artifact_id"])
    assert report["status"] == "invalid" and report["reason"] == "bankruptcy"
    assert report["final_position"] == "SHORT" and report["trades"] == 1


def test_future_dataset_changes_cannot_change_prefix_intents_or_executions(tmp_path):
    d, c, n, p, actions, _ = inputs(tmp_path)
    before = MemorySink()
    run_dataset(d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, actions=actions, sink=before)

    def mutate(rows):
        for row in rows[40:]:
            row.update(open="200", high="210", low="190", close="205")

    d = revise_main(d, mutate)
    after = MemorySink()
    run_dataset(d, c, n, p, START + 20 * MINUTE, START + 100 * MINUTE, actions=actions, sink=after)
    cutoff = START + 40 * MINUTE
    assert [e for e in before.rows["events"] if e["time_ms"] < cutoff] == [
        e for e in after.rows["events"] if e["time_ms"] < cutoff
    ]


def test_delayed_main_and_its_dependent_window_block_early_script_entries(tmp_path):
    d, c, n, p, _, _ = inputs(tmp_path)

    class Delayed:
        def __getattr__(self, key):
            return getattr(d, key)

        def candles(self, tf):
            for row in d.candles(tf):
                if tf == "1m" and row["close_time_ms"] == START + 20 * MINUTE:
                    row["available_at_ms"] = START + 22 * MINUTE
                yield row

        def bind(self, configuration):
            return {tf: self.candles(tf) for tf in d.bind(configuration)}

    sink = MemorySink()
    actions = [{"decision_ms": START + i * MINUTE, "action": 1} for i in (20, 21, 23)]
    report = run_dataset(
        Delayed(), c, n, p, START + 20 * MINUTE, START + 30 * MINUTE, actions=actions, sink=sink
    )
    entries = [e for e in sink.rows["events"] if e["kind"] == "entry"]
    assert entries and entries[0]["time_ms"] == START + 23 * MINUTE
    assert report["rejections"]["observation_unavailable"] == 2


def test_terminal_boundary_does_not_charge_next_episode_funding(tmp_path):
    d, c, n, p, _, _ = inputs(tmp_path)
    p["funding_schedule"][0]["interval_ms"] = 2 * MINUTE
    sink = MemorySink()
    run_dataset(
        d,
        c,
        n,
        p,
        START + 20 * MINUTE,
        START + 24 * MINUTE,
        actions=[{"decision_ms": START + 20 * MINUTE, "action": 1}],
        sink=sink,
    )
    assert [e["time_ms"] for e in sink.rows["events"] if e["kind"] == "funding"] == [
        START + 22 * MINUTE
    ]


def test_large_declared_schedule_report_is_a_json_document_not_a_market_record(tmp_path):
    data = tmp_path / "dataset"
    exported_dataset(data, 1020)
    d = Dataset(data, source_snapshot())
    c = config()
    c["execution"]["funding"] = {"mode": "fixed_rate", "rate": "0.0001"}
    n = fit(feature_rows(d.bind(c), c), c, d.manifest, START, START + 20 * MINUTE)
    p = policy(end=START + 1020 * MINUTE)
    first = dict(p["funding_schedule"][0])
    first["end_ms"] = START + 21 * MINUTE
    p["funding_schedule"] = [first] + [
        {**first, "start_ms": START + i * MINUTE, "end_ms": START + (i + 1) * MINUTE}
        for i in range(21, 1020)
    ]
    path = tmp_path / "actions.jsonl"
    path.write_bytes(b"")
    result = create_artifact(
        tmp_path / "runs", d, c, n, p, START + 20 * MINUTE, START + 25 * MINUTE, path
    )
    destination = tmp_path / "runs" / result["artifact_id"]
    assert (destination / "report.json").stat().st_size > 65536
    assert verify_artifact(destination)["status"] == "completed_restricted"
