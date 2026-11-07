"""Explicit M8 migration attestation; strict default model loader remains unchanged."""

from pathlib import Path

from bybit_quant.artifacts import identifier, publish_file
from bybit_quant.contracts import CONTRACTS, canonical, digest
from bybit_quant.dataset import file_hash
from bybit_quant.simulation.artifacts import code_fingerprint, read_small
from bybit_quant.training.models import verify_model


def protected_core():
    rule = read_small(CONTRACTS / "fixtures/research-compatibility.json")
    root = CONTRACTS.parent.parent
    if any(
        file_hash(root / path) != expected for path, expected in rule["protected_files"].items()
    ):
        raise ValueError("reviewed_core_changed")
    return rule


def review(root, model_id, dataset, control):
    from bybit_quant.evaluation.episodes import episode
    from bybit_quant.training.runtime import parameter_hash, runtime_versions, seed_runtime

    rule = protected_core()
    path = Path(root) / "artifacts/models" / identifier(model_id)
    metadata, normalizer, archived = verify_model(path)
    if (
        metadata["code_fingerprint"] != rule["from_code_fingerprint"]
        or metadata["dataset_fingerprint"] != dataset.export["fingerprint"]
        or metadata["runtime"] != runtime_versions()
    ):
        raise ValueError("model_not_in_reviewed_m8_scope")
    seed_runtime(metadata["seed"])
    from sb3_contrib import MaskablePPO

    model = MaskablePPO.load(path / "model.zip", device="cpu")
    if parameter_hash(model) != metadata["parameter_sha256"]:
        raise ValueError("review_model_parameter_mismatch")
    actual = episode(
        model,
        dataset,
        metadata["configuration"],
        normalizer,
        metadata["simulation_policy"],
        metadata["split"]["validation"],
        control,
        Path(root) / "artifacts/simulations",
        control.directory / "legacy-actions.jsonl",
    )
    if any(
        actual[k] != archived[k] for k in ("action_sha256", "parameter_sha256", "report", "metrics")
    ):
        raise ValueError("legacy_validation_behavior_changed")
    certificate = {
        "version": "m8_review_v1",
        "model_id": model_id,
        "from_code_fingerprint": metadata["code_fingerprint"],
        "current_code_fingerprint": code_fingerprint(),
        "protected_core_sha256": digest(rule),
        "dataset_fingerprint": dataset.export["fingerprint"],
        "configuration_hash": metadata["configuration_hash"],
        "parameter_sha256": metadata["parameter_sha256"],
        "normalizer_id": normalizer.id,
        "archived_simulation_id": archived["simulation_id"],
        "current_simulation_id": actual["simulation_id"],
        "validation_action_sha256": actual["action_sha256"],
        "execution_ready": False,
    }
    identity = digest(certificate)
    publish_file(
        Path(root) / "artifacts/evaluations/reviews" / (identity + ".json"),
        (canonical(certificate) + "\n").encode("utf-8"),
    )
    return identity


def verify_review(root, review_id, *, current=True):
    certificate = read_small(
        Path(root) / "artifacts/evaluations/reviews" / (identifier(review_id) + ".json")
    )
    if (
        digest(certificate) != review_id
        or current
        and (
            certificate["current_code_fingerprint"] != code_fingerprint()
            or certificate["protected_core_sha256"] != digest(protected_core())
        )
    ):
        raise ValueError("review_certificate_mismatch")
    metadata, _, archived = verify_model(Path(root) / "artifacts/models" / certificate["model_id"])
    from bybit_quant.simulation.artifacts import verify_artifact

    report = verify_artifact(
        Path(root) / "artifacts/simulations" / certificate["current_simulation_id"]
    )
    if (
        metadata["parameter_sha256"] != certificate["parameter_sha256"]
        or report != archived["report"]
    ):
        raise ValueError("review_certificate_artifact_mismatch")
    return certificate
