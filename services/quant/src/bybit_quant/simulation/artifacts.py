"""Content-addressed streaming simulation artifacts with independent ledger reload checks."""

import os
import platform
import sys
from collections import Counter
from pathlib import Path
from uuid import uuid4

from bybit_quant.artifacts import publish_file
from bybit_quant.configuration import configuration
from bybit_quant.contracts import CONTRACTS, canonical, config_hash, digest, strict_json, validate
from bybit_quant.dataset import file_hash, records
from bybit_quant.features.schema import observation_schema
from bybit_quant.simulation.numeric import ZERO, cash, decimal, exact
from bybit_quant.simulation.runner import run_dataset

ROOT = CONTRACTS.parent.parent
STREAMS = {
    "events": "simulation-event-v1",
    "trades": "simulation-trade-v1",
    "equity": "simulation-equity-v1",
}


def code_fingerprint():
    paths = list((ROOT / "services/quant/src").rglob("*.py")) + list(
        (CONTRACTS / "schemas").glob("*.json")
    )
    paths += list((CONTRACTS / "fixtures").glob("*.json"))
    paths += [ROOT / "services/quant/uv.lock", CONTRACTS / "package.json", ROOT / "toolchain.json"]
    return digest({p.relative_to(ROOT).as_posix(): file_hash(p) for p in sorted(paths)})


class FileSink:
    def __init__(self, directory):
        self.files = {}
        self.counts = {key: 0 for key in STREAMS}
        try:
            for key in STREAMS:
                self.files[key] = (directory / (key + ".jsonl")).open("xb")
        except BaseException:
            self.close()
            raise

    def write(self, stream, row):
        validate(STREAMS[stream], row)
        self.files[stream].write((canonical(row) + "\n").encode("utf-8"))
        self.counts[stream] += 1

    def close(self):
        for source in self.files.values():
            if not source.closed:
                source.flush()
                os.fsync(source.fileno())
                source.close()


def read_small(path, limit=2097152):
    if path.stat().st_size > limit:
        raise ValueError("oversized_simulation_document")
    return strict_json(path.read_text("utf-8"))


@exact
def create_artifact(root, dataset, c, normalizer, policy, start, end, action_path):
    c = configuration(c)
    from bybit_quant.simulation.runner import action_stream

    action_path = Path(action_path)
    action_hash = file_hash(action_path)
    from bybit_quant.contracts import INTERVALS

    for _ in action_stream(records(action_path), start, end, INTERVALS[c["market"]["timeframe"]]):
        pass
    schema = observation_schema(c)
    code = code_fingerprint()
    header = {
        "version": "1",
        "configuration_hash": config_hash(c),
        "dataset_fingerprint": dataset.export["fingerprint"],
        "configuration_snapshot_id": dataset.export["configuration_snapshot_id"],
        "source_configuration_hash": dataset.export["configuration_hash"],
        "normalizer_id": normalizer.id,
        "feature_schema_hash": schema["sha256"],
        "code_fingerprint": code,
        "actions_sha256": action_hash,
        "episode_start_ms": start,
        "episode_end_ms": end,
        "policy": policy,
    }
    descriptor = {
        **header,
        "configuration": c,
        "normalizer": normalizer.payload,
        "dataset_source": dataset.manifest["source"],
        "runtime": {
            "python": platform.python_version(),
            "implementation": platform.python_implementation(),
            "machine": platform.machine(),
            "byteorder": sys.byteorder,
        },
        "symbol": dataset.manifest["symbol"],
    }
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    directory = root / (".run-" + uuid4().hex)
    directory.mkdir()
    sink = None
    try:
        sink = FileSink(directory)
        report = run_dataset(
            dataset, c, normalizer, policy, start, end, actions=records(action_path), sink=sink
        )
        sink.close()
        if file_hash(action_path) != action_hash or code_fingerprint() != code:
            raise ValueError("simulation_inputs_changed")
        for name, payload in (("descriptor.json", descriptor), ("report.json", report)):
            publish_file(directory / name, (canonical(payload) + "\n").encode("utf-8"))
        files = [
            {
                "file": name,
                "sha256": file_hash(directory / name),
                "count": sink.counts[name.removesuffix(".jsonl")] if name.endswith(".jsonl") else 1,
            }
            for name in (
                "events.jsonl",
                "trades.jsonl",
                "equity.jsonl",
                "report.json",
                "descriptor.json",
            )
        ]
        manifest = {**header, "files": files}
        validate("simulation-manifest-v1", manifest)
        artifact_id = digest(manifest)
        publish_file(directory / "manifest.json", (canonical(manifest) + "\n").encode("utf-8"))
        verify_artifact(directory, artifact_id)
        destination = root / artifact_id
        if destination.exists():
            verify_artifact(destination)
            if (destination / "manifest.json").read_bytes() != (
                directory / "manifest.json"
            ).read_bytes():
                raise ValueError("immutable_simulation_conflict")
        else:
            directory.rename(destination)
        return {"artifact_id": artifact_id, "report": report}
    finally:
        if sink is not None:
            sink.close()
        if directory.exists():
            for name in (
                "events.jsonl",
                "trades.jsonl",
                "equity.jsonl",
                "report.json",
                "descriptor.json",
                "manifest.json",
            ):
                (directory / name).unlink(missing_ok=True)
            directory.rmdir()


@exact
def verify_artifact(directory, expected_id=None):
    directory = Path(directory)
    manifest = read_small(directory / "manifest.json")
    validate("simulation-manifest-v1", manifest)
    if digest(manifest) != (expected_id or directory.name):
        raise ValueError("simulation_manifest_checksum")
    expected = {"events.jsonl", "trades.jsonl", "equity.jsonl", "report.json", "descriptor.json"}
    if {f["file"] for f in manifest["files"]} != expected:
        raise ValueError("simulation_file_set")
    for entry in manifest["files"]:
        path = (directory / entry["file"]).resolve(strict=True)
        if path.parent != directory.resolve() or file_hash(path) != entry["sha256"]:
            raise ValueError("simulation_file_checksum")
        if path.suffix == ".jsonl":
            count = sum(1 for _ in records(path))
        else:
            # A segmented policy can exceed the bounded JSONL market-record size.
            read_small(path)
            count = 1
        if count != entry["count"]:
            raise ValueError("simulation_file_count")
    report = read_small(directory / "report.json")
    validate("simulation-report-v1", report)
    descriptor = read_small(directory / "descriptor.json")
    for key, value in manifest.items():
        if key != "files" and descriptor.get(key) != value:
            raise ValueError("simulation_descriptor_mismatch")
    c = configuration(descriptor["configuration"])
    if (
        config_hash(c) != manifest["configuration_hash"]
        or observation_schema(c)["sha256"] != manifest["feature_schema_hash"]
        or report["policy"] != manifest["policy"]
    ):
        raise ValueError("simulation_configuration_mismatch")
    from bybit_quant.features.normalization import Normalizer

    normalizer = Normalizer(descriptor["normalizer"], manifest["normalizer_id"])
    normalizer.bind(c, {"source": descriptor["dataset_source"], "symbol": descriptor["symbol"]})
    initial = decimal(c["risk"]["initial_capital"])
    if initial != decimal(report["initial_capital"]):
        raise ValueError("simulation_initial_capital")
    wallet, fees, funding, realized = initial, ZERO, ZERO, ZERO
    previous, seq, active = None, 0, None
    rejected = Counter()
    for row in records(directory / "events.jsonl"):
        validate("simulation-event-v1", row)
        seq += 1
        if row["seq"] != seq or previous is not None and row["time_ms"] < previous:
            raise ValueError("simulation_event_order")
        previous = row["time_ms"]
        amount = decimal(row["amount"])
        if row["kind"] not in ("fee", "funding", "realized") and amount != 0:
            raise ValueError("nonfinancial_event_amount")
        if row["kind"] == "fee":
            if amount > 0:
                raise ValueError("market_fee_credit")
            fees -= amount
        elif row["kind"] == "funding":
            funding += amount
        elif row["kind"] == "realized":
            realized += amount
        elif row["kind"] == "rejected":
            rejected[row["reason"]] += 1
        elif row["kind"] == "entry":
            if active is not None or row["position_id"] is None or decimal(row["quantity"]) <= 0:
                raise ValueError("simulation_position_stacking")
            active = row
        elif row["kind"] == "exit":
            if (
                active is None
                or active["position_id"] != row["position_id"]
                or (active["quantity"] != row["quantity"] or active["side"] != row["side"])
            ):
                raise ValueError("simulation_exit_without_position")
            active = None
        wallet += amount
        if decimal(row["wallet"]) != wallet:
            raise ValueError("simulation_wallet_reconciliation")
    if (
        seq != report["events"]
        or dict(rejected) != report["rejections"]
        or (
            wallet != decimal(report["final_wallet"])
            or fees != decimal(report["fees"])
            or funding != decimal(report["funding"])
            or realized != decimal(report["realized"])
        )
    ):
        raise ValueError("simulation_ledger_totals")
    side = active["side"] if active else "FLAT"
    if side != report["final_position"] or report["status"] != "invalid" and active:
        raise ValueError("simulation_terminal_position")
    gross_sum = fee_sum = funding_sum = ZERO
    trade_count = 0
    exits = (r for r in records(directory / "events.jsonl") if r["kind"] == "exit")
    for trade, exit_event in zip(records(directory / "trades.jsonl"), exits, strict=True):
        validate("simulation-trade-v1", trade)
        trade_count += 1
        gross = decimal(trade["gross_pnl"])
        q = decimal(trade["quantity"])
        entry, exit_price = decimal(trade["entry"]), decimal(trade["exit"])
        s = 1 if trade["side"] == "LONG" else -1
        if (
            trade["position_id"] != exit_event["position_id"]
            or exit_price != decimal(exit_event["price"])
            or q != decimal(exit_event["quantity"])
            or (gross != cash(s * q * (exit_price - entry)))
        ):
            raise ValueError("simulation_trade_fill_mismatch")
        total_fees = decimal(trade["entry_fee"]) + decimal(trade["exit_fee"])
        f = decimal(trade["funding"])
        if decimal(trade["net_pnl"]) != gross - total_fees + f:
            raise ValueError("simulation_trade_reconciliation")
        gross_sum += gross
        fee_sum += total_fees
        funding_sum += f
    if (
        trade_count != report["trades"]
        or gross_sum != realized
        or (active is None and (fee_sum != fees or funding_sum != funding))
    ):
        raise ValueError("simulation_trade_totals")
    last, points = None, 0
    reserve = decimal(manifest["policy"]["safety_reserve"])
    for row in records(directory / "equity.jsonl"):
        validate("simulation-equity-v1", row)
        points += 1
        if last is not None and row["time_ms"] < last["time_ms"]:
            raise ValueError("simulation_equity_order")
        if decimal(row["equity"]) != decimal(row["wallet"]) + decimal(row["unrealized"]) or (
            decimal(row["available_margin"])
            != decimal(row["equity"]) - decimal(row["initial_margin"]) - reserve
        ):
            raise ValueError("simulation_equity_reconciliation")
        last = row
    if (
        points != report["equity_points"]
        or last is None
        or (
            last["wallet"] != report["final_wallet"]
            or last["equity"] != report["final_equity"]
            or decimal(report["net_equity_change"]) != decimal(report["final_equity"]) - initial
        )
    ):
        raise ValueError("simulation_final_equity")
    return report
