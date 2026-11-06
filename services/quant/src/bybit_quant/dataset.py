"""Verified, streaming M3 export consumer. Hashes are integrity, not signatures."""

import hashlib
import re
from decimal import Decimal
from pathlib import Path
from uuid import UUID

from bybit_quant.configuration import configuration, snapshot_document
from bybit_quant.contracts import INTERVALS, config_hash, digest, strict_json, validate

MAX_LINE = 65536


def records(path):
    with path.open("rb") as source:
        while line := source.readline(MAX_LINE + 1):
            if len(line) > MAX_LINE or not line.endswith(b"\n"):
                raise ValueError("invalid_record_size_or_newline")
            yield strict_json(line)


def file_hash(path):
    result = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(65536):
            result.update(chunk)
    return result.hexdigest()


class Dataset:
    def __init__(self, directory, source_snapshot=None):
        self.directory = Path(directory).resolve(strict=True)
        manifest_path = self.directory / "manifest.json"
        if manifest_path.stat().st_size > 2 * 1024 * 1024:
            raise ValueError("oversized_manifest")
        self.export = strict_json(manifest_path.read_text("utf-8"))
        e = self.export
        self.manifest = m = e["manifest"]
        validate("dataset-manifest-v1", m)
        validate("market-quality-v1", e["quality"])
        if digest(m) != e["fingerprint"] or not re.fullmatch(
            "[0-9a-f]{64}", e["configuration_hash"]
        ):
            raise ValueError("dataset_fingerprint_or_provenance")
        UUID(e["configuration_snapshot_id"])
        self.source_verified = False
        if source_snapshot is not None:
            source_snapshot = snapshot_document(source_snapshot)
            original = configuration(source_snapshot["configuration"])
            if source_snapshot["id"] != e["configuration_snapshot_id"] or not (
                source_snapshot["config_hash"] == config_hash(original) == e["configuration_hash"]
            ):
                raise ValueError("source_snapshot_mismatch")
            market = original["market"]
            if (
                market["symbol"] != m["symbol"]
                or not (
                    market["historical_start_ms"]
                    <= m["requested_start_ms"]
                    < m["requested_end_ms"]
                    <= market["historical_end_ms"]
                )
                or "last:" + market["timeframe"] not in {s["id"] for s in m["streams"]}
            ):
                raise ValueError("source_snapshot_market_mismatch")
            self.source_verified = True
        if not e["quality"]["candles_usable"]:
            raise ValueError("dataset_quality_failed")
        q = e["quality"]
        if q["counters"]["invalid"] or q["counters"]["conflicts"]:
            raise ValueError("dataset_quality_inconsistent")
        self.streams = {s["id"]: s for s in m["streams"]}
        if len(self.streams) != len(m["streams"]):
            raise ValueError("duplicate_stream")
        if {s["id"] for s in q["streams"]} != set(self.streams) or len(q["streams"]) != len(
            self.streams
        ):
            raise ValueError("quality_stream_set")
        for stream in q["streams"]:
            descriptor = self.streams[stream["id"]]
            if (
                stream["missing"]
                or stream["gaps"]
                or any(stream[key] != descriptor[key] for key in ("start_ms", "end_ms", "count"))
                or stream["expected"] != stream["count"]
            ):
                raise ValueError("quality_coverage")
        if q["funding"]["count"] != m["funding"]["count"]:
            raise ValueError("quality_funding_count")
        expected = {s["id"].replace(":", "-") + ".jsonl": s for s in m["streams"]}
        expected["funding.jsonl"] = m["funding"]
        expected["instrument.json"] = {"count": 1}
        if len(e["files"]) != len(expected) or len({x["file"] for x in e["files"]}) != len(
            expected
        ):
            raise ValueError("dataset_file_set")
        if not m["requested_start_ms"] < m["requested_end_ms"]:
            raise ValueError("dataset_range")
        for entry in e["files"]:
            name = entry["file"]
            path = (self.directory / name).resolve(strict=True)
            if name not in expected or path.parent != self.directory or path.name != name:
                raise ValueError("dataset_file_path")
            descriptor = expected[name]
            checksum = file_hash(path)
            if (
                checksum != entry["sha256"]
                or entry["count"] != descriptor["count"]
                or ("sha256" in descriptor and checksum != descriptor["sha256"])
            ):
                raise ValueError("dataset_file_checksum")
            previous, count = None, 0
            for row in records(path):
                count += 1
                kind = (
                    "instrument"
                    if name == "instrument.json"
                    else ("funding" if name == "funding.jsonl" else "market-candle")
                )
                validate(f"{kind}-v1", row)
                if row["symbol"] != m["symbol"] or row["source"] != m["source"]:
                    raise ValueError("dataset_identity")
                if kind == "instrument":
                    if digest(row) != m["instrument_hash"]:
                        raise ValueError("instrument_hash")
                    continue
                t = row.get("open_time_ms", row.get("timestamp_ms"))
                if previous is not None and t <= previous:
                    raise ValueError("dataset_order")
                if kind == "market-candle":
                    stream = row["price_type"] + ":" + row["timeframe"]
                    if stream.replace(":", "-") + ".jsonl" != name:
                        raise ValueError("dataset_stream")
                    interval = INTERVALS[row["timeframe"]]
                    if (
                        t % interval
                        or row["close_time_ms"] != t + interval
                        or t != descriptor["start_ms"] + (count - 1) * interval
                        or row["close_time_ms"] > descriptor["end_ms"]
                    ):
                        raise ValueError("dataset_coverage")
                    o, h, low, close = [Decimal(row[k]) for k in ("open", "high", "low", "close")]
                    if not 0 < low <= min(o, close) <= max(o, close) <= h:
                        raise ValueError("dataset_ohlc")
                elif not m["requested_start_ms"] <= t < m["requested_end_ms"]:
                    raise ValueError("funding_range")
                previous = t
            if count != entry["count"]:
                raise ValueError("dataset_count")
            if name.endswith(".jsonl") and name != "funding.jsonl":
                tf = name.removesuffix(".jsonl").split("-")[1]
                if count * INTERVALS[tf] != descriptor["end_ms"] - descriptor["start_ms"]:
                    raise ValueError("dataset_incomplete")

    def bind(self, c):
        c = configuration(c)
        if config_hash(c) != self.export["configuration_hash"] and not self.source_verified:
            raise ValueError("source_snapshot_required_for_variant")
        m, market = self.manifest, c["market"]
        if market["symbol"] != m["symbol"] or not (
            market["historical_start_ms"]
            <= m["requested_start_ms"]
            < m["requested_end_ms"]
            <= market["historical_end_ms"]
        ):
            raise ValueError("configuration_dataset_mismatch")
        required = {market["timeframe"]} | {x["timeframe"] for x in c["features"]["enabled"]}
        if any("last:" + tf not in self.streams for tf in required):
            raise ValueError("required_stream_missing")
        return {tf: self.candles(tf) for tf in required}

    def candles(self, timeframe):
        # Recheck before every pass: external edits cannot silently change a fit/build input.
        descriptor = self.streams["last:" + timeframe]
        path = self.directory / f"last-{timeframe}.jsonl"
        if file_hash(path) != descriptor["sha256"]:
            raise ValueError("dataset_changed")
        yield from records(path)
        if file_hash(path) != descriptor["sha256"]:
            raise ValueError("dataset_changed_during_read")

    def instrument(self):
        path = self.directory / "instrument.json"
        entry = next(item for item in self.export["files"] if item["file"] == path.name)
        if file_hash(path) != entry["sha256"]:
            raise ValueError("dataset_changed")
        (row,) = records(path)
        if digest(row) != self.manifest["instrument_hash"]:
            raise ValueError("instrument_hash")
        return row

    def funding(self):
        path = self.directory / "funding.jsonl"
        checksum = self.manifest["funding"]["sha256"]
        if file_hash(path) != checksum:
            raise ValueError("dataset_changed")
        yield from records(path)
        if file_hash(path) != checksum:
            raise ValueError("dataset_changed_during_read")

    def verify_files(self):
        for entry in self.export["files"]:
            path = (self.directory / entry["file"]).resolve(strict=True)
            if path.parent != self.directory or file_hash(path) != entry["sha256"]:
                raise ValueError("dataset_changed")
