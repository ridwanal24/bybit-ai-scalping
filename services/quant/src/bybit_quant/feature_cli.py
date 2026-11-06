"""Offline feature commands; no credentials, network or database connection."""

import json
from pathlib import Path
from uuid import UUID

from bybit_quant.artifacts import build_artifact, load_normalizer, save_normalizer
from bybit_quant.configuration import configuration, snapshot_document
from bybit_quant.contracts import strict_json, validate
from bybit_quant.dataset import Dataset, file_hash, records
from bybit_quant.features.alignment import feature_rows
from bybit_quant.features.normalization import fit

ROOT = Path(__file__).resolve().parents[4]


def read_configuration(path):
    path = Path(path)
    if path.stat().st_size > 131072:
        raise ValueError("oversized_configuration")
    value = strict_json(path.read_text("utf-8"))
    if isinstance(value, dict) and ("configuration" in value or "payload" in value):
        return snapshot_document(value)["configuration"]
    return configuration(value)


def execute(args):
    dataset_id = str(UUID(args.dataset))
    source_snapshot = None
    if args.source_snapshot:
        path = Path(args.source_snapshot)
        if path.stat().st_size > 131072:
            raise ValueError("oversized_snapshot")
        source_snapshot = strict_json(path.read_text("utf-8"))
    dataset = Dataset(ROOT / "artifacts" / "datasets" / dataset_id, source_snapshot)
    c = read_configuration(args.config)
    artifact_root = ROOT / "artifacts" / "features"
    if args.command == "features-fit":
        normalizer = fit(
            feature_rows(dataset.bind(c), c),
            c,
            dataset.manifest,
            args.train_start_ms,
            args.train_end_ms,
        )
        normalizer.bind(c, dataset.manifest)
        save_normalizer(artifact_root, normalizer)
        print(json.dumps({"normalizer_id": normalizer.id, "count": normalizer.payload["count"]}))
    else:
        normalizer = load_normalizer(artifact_root, args.normalizer)
        context_path = Path(args.context)
        checksum = file_hash(context_path)
        iterator = records(context_path)
        header = next(iterator)
        if set(header) != {"label"} or not isinstance(header["label"], str):
            raise ValueError("invalid_context_header")

        def contexts():
            for ctx in iterator:
                validate("observation-context-v1", ctx)
                yield ctx
            if file_hash(context_path) != checksum:
                raise ValueError("context_file_changed")

        result = build_artifact(
            artifact_root, dataset, c, normalizer, contexts(), header["label"], checksum
        )
        print(
            json.dumps(
                {
                    "artifact_id": result["id"],
                    "rows": result["manifest"]["rows"],
                    "dimension": result["manifest"]["dimension"],
                }
            )
        )
