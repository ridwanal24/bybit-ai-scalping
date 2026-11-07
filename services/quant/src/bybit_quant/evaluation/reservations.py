"""Local append-only holdout boundaries and serialized consumption reservations."""

import time
from contextlib import contextmanager

from bybit_quant.artifacts import publish_file
from bybit_quant.contracts import canonical, digest
from bybit_quant.simulation.artifacts import read_small


@contextmanager
def namespace_lock(directory, namespace):
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / (".lock-" + digest(namespace))
    for _ in range(200):
        try:
            handle = lock.open("xb")
            break
        except FileExistsError:
            time.sleep(0.01)
    else:
        raise ValueError("holdout_registry_locked_manual_review_required")
    try:
        handle.close()
        yield
    finally:
        lock.unlink()


def reserve_boundary(root, dataset, configuration, holdout):
    namespace = {
        "source": dataset.manifest["source"],
        "symbol": dataset.manifest["symbol"],
        "timeframe": configuration["market"]["timeframe"],
        "source_range": [
            dataset.manifest["requested_start_ms"],
            dataset.manifest["requested_end_ms"],
        ],
    }
    # Existing M8 training metadata is prior evidence of the already designated boundary.
    for path in (root / "artifacts/models").glob("*/metadata.json"):
        metadata = read_small(path)
        if (
            metadata.get("dataset_fingerprint") == dataset.export["fingerprint"]
            and metadata["split"]["holdout"] != holdout
        ):
            raise ValueError("holdout_conflicts_with_prior_training_boundary")
    value = {"version": "holdout_boundary_v1", **namespace, "holdout": holdout}
    publish_file(
        root / "artifacts/evaluations/holdout-reservations" / (digest(namespace) + ".json"),
        (canonical(value) + "\n").encode("utf-8"),
    )
