"""Immutable managed model storage; verify metadata/checksums before SB3 deserialization."""

import shutil
from pathlib import Path

from bybit_quant.artifacts import identifier, publish_file
from bybit_quant.configuration import configuration
from bybit_quant.contracts import canonical, config_hash, digest, validate
from bybit_quant.dataset import file_hash
from bybit_quant.features.normalization import Normalizer
from bybit_quant.features.schema import observation_schema
from bybit_quant.simulation.artifacts import code_fingerprint, read_small, verify_artifact

SIMULATION_FILES = (
    "events.jsonl",
    "trades.jsonl",
    "equity.jsonl",
    "report.json",
    "descriptor.json",
    "manifest.json",
)
FILES = (
    "model.zip",
    "normalizer.json",
    "metadata.json",
    "validation.json",
    "validation-actions.jsonl",
    *("validation/" + name for name in SIMULATION_FILES),
)


def seal_model(directory, metadata, normalizer, validation, actions, simulation_directory):
    validate("model-metadata-v1", metadata)
    for name, payload in (
        ("metadata.json", metadata),
        ("normalizer.json", normalizer.payload),
        ("validation.json", validation),
    ):
        publish_file(directory / name, (canonical(payload) + "\n").encode("utf-8"))
    publish_file(
        directory / "validation-actions.jsonl",
        "".join(canonical(a) + "\n" for a in actions).encode("utf-8"),
    )
    (directory / "validation").mkdir()
    for name in SIMULATION_FILES:
        shutil.copyfile(simulation_directory / name, directory / "validation" / name)
    manifest = {name: file_hash(directory / name) for name in FILES}
    identity = digest(manifest)
    publish_file(directory / "manifest.json", (canonical(manifest) + "\n").encode("utf-8"))
    verify_model(directory, identity)
    return identity


def verify_model(directory, expected_id=None):
    directory = Path(directory)
    manifest = read_small(directory / "manifest.json")
    if set(manifest) != set(FILES) or digest(manifest) != (expected_id or directory.name):
        raise ValueError("model_manifest_checksum")
    if any(file_hash(directory / name) != manifest[name] for name in FILES):
        raise ValueError("model_file_checksum")
    metadata = read_small(directory / "metadata.json")
    validate("model-metadata-v1", metadata)
    c = configuration(metadata["configuration"])
    from bybit_quant.contracts import INTERVALS
    from bybit_quant.training.preparation import (
        chronological_split,
        validate_research_fold,
        validate_training,
    )

    research = metadata.get("research_scope") == "advanced_evaluation_v1"
    validate_training(c, metadata["resources"], research=research)
    split = chronological_split(
        metadata["split"]["train"][0],
        metadata["split"]["holdout"][1],
        INTERVALS[c["market"]["timeframe"]],
    )
    if metadata["split"]["version"] == "walk_forward_expanding_v1":
        if not research:
            raise ValueError("model_research_scope_required")
        split = validate_research_fold(
            c, metadata["split"]["train"][0], metadata["split"]["holdout"][1], metadata["split"]
        )
    if (
        metadata["split"] != split
        or metadata["seed"] != c["training"]["seed"]
        or metadata["timesteps"] != c["training"]["total_timesteps"]
    ):
        raise ValueError("model_training_scope_mismatch")
    schema = observation_schema(c)
    normalizer = Normalizer(read_small(directory / "normalizer.json"), metadata["normalizer_id"])
    normalizer.bind(c, {"source": normalizer.payload["source"], "symbol": c["market"]["symbol"]})
    if (
        metadata["configuration_hash"] != config_hash(c)
        or schema["sha256"] != metadata["feature_schema_hash"]
        or [normalizer.payload["train_start_ms"], normalizer.payload["train_end_ms"]]
        != metadata["split"]["train"]
        or normalizer.payload["dataset_fingerprint"] != metadata["dataset_fingerprint"]
    ):
        raise ValueError("model_metadata_incompatible")
    evaluation = read_small(directory / "validation.json")
    validate("training-validation-v1", evaluation)
    report = verify_artifact(directory / "validation", evaluation["simulation_id"])
    from bybit_quant.baselines.metrics import artifact_metrics

    manifest_source = read_small(directory / "validation/manifest.json")
    if (
        report != evaluation["report"]
        or evaluation["metrics"]
        != artifact_metrics(
            directory / "validation", report, evaluation["start_ms"], evaluation["end_ms"]
        )
        or manifest_source["configuration_hash"] != metadata["configuration_hash"]
        or manifest_source["normalizer_id"] != metadata["normalizer_id"]
        or manifest_source["dataset_fingerprint"] != metadata["dataset_fingerprint"]
        or manifest_source["code_fingerprint"] != metadata["code_fingerprint"]
        or file_hash(directory / "validation-actions.jsonl") != manifest_source["actions_sha256"]
    ):
        raise ValueError("model_validation_provenance")
    from bybit_quant.dataset import records

    actions = list(records(directory / "validation-actions.jsonl"))
    if (
        digest(actions) != evaluation["action_sha256"]
        or len(actions) != evaluation["steps"]
        or metadata["validation_action_sha256"] != evaluation["action_sha256"]
        or metadata["parameter_sha256"] != evaluation["parameter_sha256"]
        or [evaluation["start_ms"], evaluation["end_ms"]] != metadata["split"]["validation"]
        or evaluation["report"]["status"] == "invalid"
    ):
        raise ValueError("model_validation_mismatch")
    return metadata, normalizer, evaluation


def load_model(directory, c, expected_id=None):
    metadata, normalizer, evaluation = verify_model(directory, expected_id)
    if (
        config_hash(configuration(c)) != metadata["configuration_hash"]
        or metadata["code_fingerprint"] != code_fingerprint()
    ):
        raise ValueError("model_load_configuration_or_code_mismatch")
    from sb3_contrib import MaskablePPO

    from bybit_quant.training.runtime import parameter_hash, runtime_versions

    if metadata["runtime"] != runtime_versions():
        raise ValueError("model_load_runtime_mismatch")
    model = MaskablePPO.load(Path(directory) / "model.zip", device="cpu")
    if parameter_hash(model) != metadata["parameter_sha256"]:
        raise ValueError("model_parameter_checksum")
    return model, normalizer, evaluation


def publish_model(stage, models, model_id):
    model_id = identifier(model_id)
    stage, models = Path(stage), Path(models)
    verify_model(stage, model_id)
    models.mkdir(parents=True, exist_ok=True)
    destination = models / model_id
    if destination.exists():
        verify_model(destination)
    else:
        stage.rename(destination)
    return destination
