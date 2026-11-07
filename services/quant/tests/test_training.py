import os
import time
from copy import deepcopy
from uuid import uuid4

import psutil
import pytest
from feature_helpers import START, source_snapshot
from simulation_helpers import MINUTE
from test_rl_environment import setup
from test_simulation_integration import revise_main

from bybit_quant.configuration import parameter_count
from bybit_quant.contracts import canonical
from bybit_quant.dataset import file_hash
from bybit_quant.simulation.artifacts import read_small
from bybit_quant.training import jobs
from bybit_quant.training.engine import run_training
from bybit_quant.training.evaluation import evaluate
from bybit_quant.training.models import load_model, publish_model, verify_model
from bybit_quant.training.preparation import chronological_split, prepare, validate_training
from bybit_quant.training.runtime import (
    Cancelled,
    Control,
    GuardedEnv,
    InvalidEpisode,
    ResourceLimit,
    parameter_hash,
)


def resources(**changes):
    return {
        "cpu_threads": 1,
        "max_wall_seconds": 120,
        "max_memory_mb": 3072,
        "max_timesteps": 64,
        "max_checkpoints": 2,
        **changes,
    }


def inputs(tmp_path):
    d, c, _, p, _, _ = setup(tmp_path)
    c["training"].update(n_steps=16, batch_size=8, total_timesteps=64, episode_length_bars=20)
    request = {
        "version": "1",
        "dataset_id": str(uuid4()),
        "configuration_file": "configuration.json",
        "source_snapshot_file": "source.json",
        "range_start_ms": START,
        "range_end_ms": START + 120 * MINUTE,
        "policy": p,
        "ppo_epochs": 2,
        "checkpoint_every_rollouts": 1,
        "resources": resources(),
    }
    return d, c, request


def train(tmp_path, d, c, request):
    job_id = str(uuid4())
    directory = tmp_path / job_id
    directory.mkdir()
    identity = run_training(directory, d, c, request, job_id)
    return directory, identity


def test_chronological_split_aligned_half_open_and_rounding():
    split = chronological_split(0, 101 * MINUTE, MINUTE)
    assert split["train"] == [0, 70 * MINUTE]
    assert split["validation"] == [70 * MINUTE, 85 * MINUTE]
    assert split["holdout"] == [85 * MINUTE, 101 * MINUTE]
    assert split["holdout_evaluated"] is False


@pytest.mark.parametrize(
    "start,end,interval",
    [
        (0, 10 * MINUTE, MINUTE),
        (1, 120 * MINUTE, MINUTE),
        (0, 120 * MINUTE + 1, MINUTE),
        (100, 0, MINUTE),
        (0, 120, 0),
        (True, 120, 1),
    ],
)
def test_bad_split_rejected(start, end, interval):
    with pytest.raises(ValueError):
        chronological_split(start, end, interval)


def test_only_train_statistics_fitted_future_mutation_cannot_change_them(tmp_path):
    d, c, request = inputs(tmp_path)
    _, split, one = prepare(
        d,
        c,
        request["policy"],
        request["range_start_ms"],
        request["range_end_ms"],
        request["resources"],
    )
    assert split["train"] == [START, START + 84 * MINUTE]
    assert one.payload["train_end_ms"] == START + 84 * MINUTE

    def mutate(rows):
        for row in rows[84:]:
            row.update(open="200", high="210", low="190", close="205")

    d = revise_main(d, mutate)
    _, _, two = prepare(
        d,
        c,
        request["policy"],
        request["range_start_ms"],
        request["range_end_ms"],
        request["resources"],
    )
    for key in ("means", "scales", "constant", "count", "train_start_ms", "train_end_ms"):
        assert one.payload[key] == two.payload[key]
    assert one.payload["dataset_fingerprint"] != two.payload["dataset_fingerprint"]


@pytest.mark.parametrize(
    "mutate",
    [
        lambda c: c["training"].update(total_timesteps=65),
        lambda c: c["training"].update(total_timesteps=128),
        lambda c: c["training"].update(n_steps=4, batch_size=4),
        lambda c: c["training"].update(episode_length_bars=1),
        lambda c: c["features"]["normalization"].update(artifact_id="a" * 64),
        lambda c: c["network"].update(
            preset="Medium", policy_layers=[128, 128], value_layers=[128, 128]
        ),
    ],
)
def test_unsupported_or_overshooting_training_configuration_is_rejected(tmp_path, mutate):
    _, c, _ = inputs(tmp_path)
    mutate(c)
    with pytest.raises(ValueError):
        validate_training(c, resources())


def test_real_training_checkpoint_compatibility_validation_and_reproducibility(tmp_path):
    d, c, request = inputs(tmp_path)
    directory, identity = train(tmp_path, d, c, request)
    metadata, n, validation = verify_model(directory / "model-stage", identity)
    assert metadata["initial_parameter_sha256"] != metadata["parameter_sha256"]
    assert metadata["parameters"] == parameter_count(c, 13) == 10502
    assert metadata["timesteps"] == 64 and metadata["hardware"]["torch_threads"] == "1"
    assert metadata["split"]["holdout_evaluated"] is False
    assert n.payload["train_end_ms"] == metadata["split"]["validation"][0]
    assert validation["start_ms"] == START + 84 * MINUTE
    assert validation["end_ms"] == START + 102 * MINUTE
    checkpoints = sorted((directory / "checkpoints").glob("*.zip"))
    assert len(checkpoints) == 2 and checkpoints[-1].stem == "step-000000064"
    for path in checkpoints:
        descriptor = read_small(path.with_suffix(".json"))
        assert descriptor["sha256"] == file_hash(path) and descriptor["normalizer_id"] == n.id
    assert (
        read_small(checkpoints[-1].with_suffix(".json"))["parameter_sha256"]
        == metadata["parameter_sha256"]
    )
    progress = read_small(directory / "progress.json")
    assert progress["phase"] == "finished" and progress["timesteps"] == 64
    assert progress["valid_actions"] == 64 and progress["metrics"]
    published = publish_model(directory / "model-stage", tmp_path / "models", identity)
    model, normalizer, saved_validation = load_model(published, c)
    evaluated, _, _ = evaluate(
        model,
        d,
        c,
        normalizer,
        request["policy"],
        metadata["split"]["validation"],
        Control(directory, resources()),
    )
    assert evaluated == saved_validation == validation
    assert parameter_hash(model) == metadata["parameter_sha256"]
    _, second_id = train(tmp_path, d, c, request)
    second_directory = next(
        p for p in tmp_path.iterdir() if p.is_dir() and (p / "model-stage/manifest.json").exists()
    )
    repeated, repeated_normalizer, repeated_validation = verify_model(
        second_directory / "model-stage", second_id
    )
    assert repeated["parameter_sha256"] == metadata["parameter_sha256"]
    assert repeated_normalizer.id == normalizer.id
    assert repeated_validation == saved_validation
    modified = deepcopy(c)
    modified["risk"]["cooldown_bars"] += 1
    with pytest.raises(ValueError, match="model_load_configuration"):
        load_model(published, modified)
    # Verify checksums before deserializing any ZIP/Pickle content.
    (published / "model.zip").write_bytes(b"untrusted-not-a-model")
    with pytest.raises(ValueError, match="model_file_checksum"):
        load_model(published, c)


def test_guard_blocks_invalid_rollout_before_learner_and_boundary_bootstrap(tmp_path):
    d, c, request = inputs(tmp_path)
    c, split, n = prepare(d, c, request["policy"], START, START + 120 * MINUTE, resources())
    d = revise_main(d, lambda rows: rows[21].update(high="2000"))
    env = GuardedEnv(
        d,
        c,
        n,
        request["policy"],
        [START + 20 * MINUTE, START + 25 * MINUTE],
        Control(tmp_path, resources()),
    )
    try:
        env.reset(seed=42)
        env.step(2)
        with pytest.raises(InvalidEpisode, match="invalid_simulation"):
            env.step(0)
    finally:
        env.close()
    env = GuardedEnv(
        d, c, n, request["policy"], split["validation"], Control(tmp_path, resources())
    )
    try:
        env.reset(seed=42)
        while True:
            _, _, terminated, truncated, info = env.step(0)
            if terminated or truncated:
                assert terminated and truncated and info["bootstrap_discount"] == 0
                break
    finally:
        env.close()


def test_train_episode_cycle_never_carries_into_validation(tmp_path):
    d, c, request = inputs(tmp_path)
    c, split, n = prepare(d, c, request["policy"], START, START + 120 * MINUTE, resources())
    env = GuardedEnv(
        d, c, n, request["policy"], split["train"], Control(tmp_path, resources()), training=True
    )
    try:
        starts = []
        for _ in range(6):
            env.reset()
            starts.append(env.unwrapped.start)
            assert env.unwrapped.end <= split["validation"][0]
            assert env.unwrapped.simulator.ledger.position is None
        assert starts[0] == starts[5] == START
        assert starts[1] == START + 20 * MINUTE
    finally:
        env.close()


def test_cooperative_control_cancellation_and_limits(tmp_path):
    control = Control(tmp_path, resources())
    (tmp_path / "cancel").write_text("cancel")
    with pytest.raises(Cancelled):
        control.check()
    (tmp_path / "cancel").unlink()
    control.started -= 121
    with pytest.raises(ResourceLimit, match="wall"):
        control.check()
    control.started = time.monotonic()
    control.resources["max_memory_mb"] = 0
    with pytest.raises(ResourceLimit, match="memory"):
        control.check()


def background_inputs(tmp_path):
    d, c, request = inputs(tmp_path)
    root = tmp_path / "store"
    target = root / "artifacts/datasets" / request["dataset_id"]
    target.parent.mkdir(parents=True)
    d.directory.rename(target)
    (tmp_path / "configuration.json").write_text(canonical(c), "utf-8")
    (tmp_path / "source.json").write_text(canonical(source_snapshot()), "utf-8")
    path = tmp_path / "request.json"
    path.write_text(canonical(request), "utf-8")
    return root, path, request


def wait(root, job_id, timeout=40):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = jobs.status(root, job_id)
        if result["state"] in jobs.TERMINAL:
            return result
        time.sleep(0.1)
    jobs.cancel(root, job_id)
    raise AssertionError("background_job_timeout")


def test_real_background_job_persistent_status_publication_and_single_active_lease(tmp_path):
    root, path, request = background_inputs(tmp_path)
    submitted = jobs.submit(root, path)
    try:
        with pytest.raises(FileExistsError):
            jobs.submit(root, path)
        result = wait(root, submitted["job_id"])
        assert result["state"] == "SUCCEEDED", read_small(
            jobs.paths(root, submitted["job_id"]) / "outcome.json"
        )
        metadata, _, _ = verify_model(root / "artifacts/models" / result["model_id"])
        assert metadata["job_id"] == result["job_id"]
        assert result["progress"]["timesteps"] == request["resources"]["max_timesteps"]
        assert jobs.status(root, result["job_id"])["state"] == "SUCCEEDED"
        assert not (root / "artifacts/training-jobs/active.json").exists()
    finally:
        jobs.cancel(root, submitted["job_id"])


def test_real_background_cancel_does_not_publish_and_releases_lease(tmp_path):
    root, path, _ = background_inputs(tmp_path)
    submitted = jobs.submit(root, path)
    requested = jobs.cancel(root, submitted["job_id"])
    assert requested["state"] in ("CANCELLING", "CANCELLED")
    result = wait(root, submitted["job_id"])
    assert result["state"] == "CANCELLED" and result["model_id"] is None
    assert not (root / "artifacts/models").exists()
    assert not (root / "artifacts/training-jobs/active.json").exists()


@pytest.mark.parametrize(
    "limit,reason", [("max_wall_seconds", "wall_time_limit"), ("max_memory_mb", "memory_limit")]
)
def test_supervisor_enforces_actual_worker_resource_limits(tmp_path, limit, reason):
    root, path, request = background_inputs(tmp_path)
    request["resources"][limit] = 1 if limit == "max_wall_seconds" else 64
    path.write_text(canonical(request), "utf-8")
    submitted = jobs.submit(root, path)
    result = wait(root, submitted["job_id"])
    assert result["state"] == "RESOURCE_LIMIT" and result["reason"] == reason
    assert result["model_id"] is None and not (root / "artifacts/models").exists()


def test_worker_failure_is_persistent_and_sanitized(tmp_path):
    root, path, request = background_inputs(tmp_path)
    # Valid schema/policy but unsupported schedule coverage fails worker preparation/reset.
    request["policy"]["funding_schedule"][0]["end_ms"] -= MINUTE
    path.write_text(canonical(request), "utf-8")
    submitted = jobs.submit(root, path)
    result = wait(root, submitted["job_id"])
    assert result["state"] == "FAILED" and result["model_id"] is None
    log = (jobs.paths(root, submitted["job_id"]) / "events.jsonl").read_text("utf-8")
    assert "ValueError" in log and str(tmp_path) not in log


def test_dead_supervisor_recovery_and_uuid_path_gate(tmp_path):
    with pytest.raises(ValueError):
        jobs.status(tmp_path, "../other-user-process")
    job_id = str(uuid4())
    directory = jobs.paths(tmp_path, job_id)
    directory.mkdir(parents=True)
    from bybit_quant.training.storage import atomic_json, now

    state = {
        "version": "1",
        "job_id": job_id,
        "state": "RUNNING",
        "created_at": now(),
        "started_at": now(),
        "finished_at": None,
        "supervisor_pid": os.getpid(),
        "worker_pid": None,
        "reason": None,
        "model_id": None,
        "progress": None,
        "usage": None,
    }
    atomic_json(directory / "status.json", state)
    # Reused PID with a different create time must not be treated as owned or killed.
    atomic_json(
        directory / "supervisor.json",
        {"pid": os.getpid(), "created": psutil.Process().create_time() - 1},
    )
    atomic_json(directory.parent / "active.json", {"job_id": job_id})
    result = jobs.status(tmp_path, job_id)
    assert result["state"] == "INTERRUPTED" and psutil.pid_exists(os.getpid())
    assert not (directory.parent / "active.json").exists()


def test_atomic_progress_survives_a_concurrent_windows_reader(tmp_path):
    import threading

    from bybit_quant.training.storage import atomic_json

    path = tmp_path / "progress.json"
    atomic_json(path, {"step": 0})
    ready, release = threading.Event(), threading.Event()

    def reader():
        with path.open("rb"):
            ready.set()
            release.wait(timeout=2)

    thread = threading.Thread(target=reader)
    thread.start()
    assert ready.wait(timeout=2)
    timer = threading.Timer(0.05, release.set)
    timer.start()
    try:
        atomic_json(path, {"step": 1})
        assert read_small(path) == {"step": 1}
    finally:
        release.set()
        thread.join(timeout=2)
        timer.join(timeout=2)
    assert not list(tmp_path.glob(".atomic-*"))
