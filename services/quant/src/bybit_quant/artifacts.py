"""Atomic content-addressed artifacts and streaming observation export."""

import math
import os
import re
import struct
from pathlib import Path
from uuid import uuid4

from bybit_quant.contracts import canonical, config_hash, digest, strict_json, validate
from bybit_quant.dataset import file_hash
from bybit_quant.features.alignment import feature_rows
from bybit_quant.features.normalization import Normalizer
from bybit_quant.features.schema import observation_schema
from bybit_quant.observation import ObservationBuilder


def identifier(value):
    if not re.fullmatch(r"[0-9a-f]{64}", value):
        raise ValueError("invalid_artifact_id")
    return value


def publish_file(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name("." + uuid4().hex + ".tmp")
    try:
        with temporary.open("xb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, path)
        except FileExistsError:
            if path.read_bytes() != data:
                raise ValueError("immutable_artifact_conflict") from None
    finally:
        temporary.unlink(missing_ok=True)


def save_normalizer(root, normalizer):
    path = Path(root) / "normalizers" / (identifier(normalizer.id) + ".json")
    publish_file(path, (canonical(normalizer.payload) + "\n").encode("utf-8"))
    return normalizer.id


def load_normalizer(root, artifact_id):
    path = Path(root) / "normalizers" / (identifier(artifact_id) + ".json")
    if path.stat().st_size > 1024 * 1024:
        raise ValueError("oversized_normalizer")
    return Normalizer(strict_json(path.read_text("utf-8")), artifact_id)


def build_artifact(root, dataset, c, normalizer, contexts, context_label, context_sha256):
    normalizer.bind(c, dataset.manifest)
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    directory = root / (".build-" + uuid4().hex)
    directory.mkdir()
    builder = ObservationBuilder(c, dataset.manifest, normalizer)
    context_iterator = iter(contexts)
    current = next(context_iterator, None)
    previous_context = None
    count, unavailable = 0, {}
    schema = observation_schema(c)
    try:
        with (
            (directory / "observations.f32").open("xb") as binary,
            (directory / "decisions.jsonl").open("xb") as timestamps,
        ):
            for row in feature_rows(dataset.bind(c), c):
                t = row["decision_ms"]
                while current is not None and current["as_of_ms"] < t:
                    previous_context = current["as_of_ms"]
                    current = next(context_iterator, None)
                    if current is not None and current["as_of_ms"] <= previous_context:
                        raise ValueError("nonascending_context")
                ctx = current if current is not None and current["as_of_ms"] == t else None
                result = builder.push(row, ctx)
                if result["valid"]:
                    count += 1
                    binary.write(struct.pack(f"<{len(result['values'])}f", *result["values"]))
                    timestamps.write((str(t) + "\n").encode("ascii"))
                else:
                    reason = result["reason"]
                    unavailable[reason] = unavailable.get(reason, 0) + 1
            for remaining in context_iterator:
                if remaining["as_of_ms"] <= current["as_of_ms"]:
                    raise ValueError("nonascending_context")
                current = remaining
            for stream in (binary, timestamps):
                stream.flush()
                os.fsync(stream.fileno())
        if count == 0:
            raise ValueError("no_valid_observations")
        manifest = {
            "version": "1",
            "feature_schema_hash": schema["sha256"],
            "normalizer_id": normalizer.id,
            "configuration_hash": config_hash(c),
            "dataset_fingerprint": dataset.export["fingerprint"],
            "configuration_snapshot_id": dataset.export["configuration_snapshot_id"],
            "source_configuration_hash": dataset.export["configuration_hash"],
            "source": dataset.manifest["source"],
            "symbol": dataset.manifest["symbol"],
            "start_ms": dataset.manifest["requested_start_ms"],
            "end_ms": dataset.manifest["requested_end_ms"],
            "rows": count,
            "dimension": schema["schema"]["dimension"],
            "unavailable": unavailable,
            "context_label": context_label,
            "context_sha256": context_sha256,
            "files": [
                {"file": name, "sha256": file_hash(directory / name)}
                for name in ("observations.f32", "decisions.jsonl")
            ],
        }
        validate("feature-artifact-v1", manifest)
        artifact_id = digest(manifest)
        publish_file(directory / "schema.json", (canonical(schema) + "\n").encode("utf-8"))
        publish_file(directory / "manifest.json", (canonical(manifest) + "\n").encode("utf-8"))
        destination = root / artifact_id
        if destination.exists():
            verify_artifact(destination)
            if (destination / "manifest.json").read_bytes() != (
                directory / "manifest.json"
            ).read_bytes():
                raise ValueError("immutable_artifact_conflict")
        else:
            directory.rename(destination)
        verify_artifact(destination)
        return {"id": artifact_id, "manifest": manifest}
    finally:
        # Only explicitly known files in this invocation's unique directory are removed.
        if directory.exists():
            for name in ("observations.f32", "decisions.jsonl", "schema.json", "manifest.json"):
                (directory / name).unlink(missing_ok=True)
            directory.rmdir()


def verify_artifact(directory):
    directory = Path(directory)
    m = strict_json((directory / "manifest.json").read_text("utf-8"))
    validate("feature-artifact-v1", m)
    if digest(m) != directory.name:
        raise ValueError("feature_artifact_checksum")
    schema = strict_json((directory / "schema.json").read_text("utf-8"))
    validate("feature-v1", schema["schema"])
    shape = schema["schema"]
    dimension = shape["window"] * len(shape["market"]) + len(shape["position"]) + len(shape["risk"])
    if dimension != shape["dimension"]:
        raise ValueError("feature_schema_shape")
    if (
        digest(schema["schema"]) != schema["sha256"]
        or schema["sha256"] != m["feature_schema_hash"]
        or schema["schema"]["dimension"] != m["dimension"]
    ):
        raise ValueError("feature_schema_checksum")
    if {entry["file"] for entry in m["files"]} != {"observations.f32", "decisions.jsonl"}:
        raise ValueError("feature_file_set")
    for entry in m["files"]:
        if file_hash(directory / entry["file"]) != entry["sha256"]:
            raise ValueError("feature_file_checksum")
    if (directory / "observations.f32").stat().st_size != m["rows"] * m["dimension"] * 4:
        raise ValueError("feature_binary_size")
    with (directory / "observations.f32").open("rb") as binary:
        while chunk := binary.read(65536):
            if any(not math.isfinite(value[0]) for value in struct.iter_unpack("<f", chunk)):
                raise ValueError("feature_nonfinite")
    previous, count = None, 0
    with (directory / "decisions.jsonl").open("rb") as times:
        for line in times:
            t = strict_json(line)
            if (
                type(t) is not int
                or not m["start_ms"] <= t <= m["end_ms"]
                or (previous is not None and t <= previous)
            ):
                raise ValueError("feature_timestamp")
            previous, count = t, count + 1
    if count != m["rows"]:
        raise ValueError("feature_row_count")
    return m
