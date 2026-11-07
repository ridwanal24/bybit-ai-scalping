"""Local persistent single-job lease, hidden supervisor/worker and bounded cancellation."""

import os
import subprocess
import sys
import time
from pathlib import Path
from uuid import UUID, uuid4

import psutil

from bybit_quant.artifacts import publish_file
from bybit_quant.contracts import canonical, config_canonical, validate
from bybit_quant.dataset import Dataset
from bybit_quant.feature_cli import read_configuration
from bybit_quant.simulation.artifacts import read_small
from bybit_quant.training.models import publish_model
from bybit_quant.training.preparation import chronological_split, validate_training
from bybit_quant.training.storage import atomic_json, log, now

TERMINAL = {"SUCCEEDED", "CANCELLED", "FAILED", "RESOURCE_LIMIT", "INTERRUPTED"}


def paths(root, job_id):
    job_id = str(UUID(job_id))
    return Path(root) / "artifacts/training-jobs" / job_id


def owned_process(identity):
    if identity is None:
        return None
    try:
        process = psutil.Process(identity["pid"])
        if process.create_time() == identity["created"] and process.is_running():
            return process
    except psutil.NoSuchProcess:
        pass
    return None


def release(root, job_id):
    lease = Path(root) / "artifacts/training-jobs/active.json"
    if lease.exists() and read_small(lease)["job_id"] == job_id:
        lease.unlink(missing_ok=True)


def status(root, job_id):
    directory = paths(root, job_id)
    value = read_small(directory / "status.json")
    identity_file = directory / "supervisor.json"
    if (
        value["state"] not in TERMINAL
        and identity_file.exists()
        and owned_process(read_small(identity_file)) is None
    ):
        worker_identity = directory / "worker.json"
        if worker_identity.exists():
            kill_owned(read_small(worker_identity))
        value.update(state="INTERRUPTED", reason="supervisor_not_running", finished_at=now())
        atomic_json(directory / "status.json", value)
        release(root, value["job_id"])
    progress = directory / "progress.json"
    if progress.exists():
        value["progress"] = read_small(progress)
    if value["state"] not in TERMINAL and (directory / "cancel").exists():
        value["state"] = "CANCELLING"
    validate("training-job-v1", value)
    return value


def process_environment(root):
    cache = Path(root) / ".runtime/matplotlib-cache"
    cache.mkdir(parents=True, exist_ok=True)
    return {
        **os.environ,
        "OMP_NUM_THREADS": "1",
        "MKL_NUM_THREADS": "1",
        "OPENBLAS_NUM_THREADS": "1",
        "NUMEXPR_NUM_THREADS": "1",
        "CUDA_VISIBLE_DEVICES": "",
        "MPLCONFIGDIR": str(cache),
        "PYTHONHASHSEED": "0",
        "PYTHONUNBUFFERED": "1",
    }


def spawn(root, command, job_id, output):
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "bybit_quant",
            command,
            "--root",
            str(Path(root).resolve()),
            "--job",
            job_id,
        ],
        cwd=root,
        stdin=subprocess.DEVNULL,
        stdout=output,
        stderr=subprocess.STDOUT,
        env=process_environment(root),
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )


def submit(root, request_path):
    root, request_path = Path(root), Path(request_path).resolve(strict=True)
    request = config_canonical(read_small(request_path))
    validate("training-request-v1", request)
    c = validate_training(
        read_configuration(
            (request_path.parent / request["configuration_file"]).resolve(strict=True)
        ),
        request["resources"],
    )
    from bybit_quant.contracts import INTERVALS

    chronological_split(
        request["range_start_ms"], request["range_end_ms"], INTERVALS[c["market"]["timeframe"]]
    )
    source = None
    if request["source_snapshot_file"] is not None:
        source = read_small(
            (request_path.parent / request["source_snapshot_file"]).resolve(strict=True)
        )
    dataset_id = str(UUID(request["dataset_id"]))
    dataset = Dataset(root / "artifacts/datasets" / dataset_id, source)
    from bybit_quant.simulation.policy import capabilities

    capabilities(
        c,
        dataset.instrument(),
        request["policy"],
        request["range_start_ms"],
        request["range_end_ms"],
    )
    jobs = root / "artifacts/training-jobs"
    jobs.mkdir(parents=True, exist_ok=True)
    lease = jobs / "active.json"
    if lease.exists():
        previous = read_small(lease)["job_id"]
        previous_status = status(root, previous)
        if previous_status["state"] in TERMINAL:
            release(root, previous)
    job_id = str(uuid4())
    # Exclusive creation, not immutable publish_file (which is idempotent by bytes).
    with lease.open("xb") as output:
        output.write((canonical({"job_id": job_id}) + "\n").encode("utf-8"))
        output.flush()
        os.fsync(output.fileno())
    directory = paths(root, job_id)
    try:
        directory.mkdir()
        frozen = {
            **request,
            "configuration_file": "configuration.json",
            "source_snapshot_file": "source.json" if source is not None else None,
        }
        for name, document in (("request.json", frozen), ("configuration.json", c)):
            publish_file(directory / name, (canonical(document) + "\n").encode("utf-8"))
        if source is not None:
            publish_file(directory / "source.json", (canonical(source) + "\n").encode("utf-8"))
        state = {
            "version": "1",
            "job_id": job_id,
            "state": "QUEUED",
            "created_at": now(),
            "started_at": None,
            "finished_at": None,
            "supervisor_pid": None,
            "worker_pid": None,
            "reason": None,
            "model_id": None,
            "progress": None,
            "usage": None,
        }
        atomic_json(directory / "status.json", state)
        with (directory / "supervisor.log").open("ab") as output:
            process = spawn(root, "training-supervise", job_id, output)
        atomic_json(
            directory / "supervisor.json",
            {"pid": process.pid, "created": psutil.Process(process.pid).create_time()},
        )
        return status(root, job_id)
    except BaseException:
        release(root, job_id)
        raise


def cancel(root, job_id):
    value = status(root, job_id)
    if value["state"] not in TERMINAL:
        publish_file(paths(root, job_id) / "cancel", b"cancel\n")
    return status(root, job_id)


def kill_owned(identity):
    process = owned_process(identity)
    if process is None:
        return
    children = process.children(recursive=True)
    for child in reversed(children):
        try:
            child.kill()
        except psutil.NoSuchProcess:
            pass
    try:
        process.kill()
    except psutil.NoSuchProcess:
        pass
    psutil.wait_procs([process, *children], timeout=2)


def supervise(root, job_id):
    root, directory = Path(root), paths(root, job_id)
    with (directory / "supervisor.lock").open("xb"):
        pass
    state = read_small(directory / "status.json")
    if state["state"] != "QUEUED":
        raise ValueError("job_not_queued")
    identity = None
    started, cancellation = time.monotonic(), None
    peak_rss = 0.0
    try:
        atomic_json(
            directory / "supervisor.json",
            {"pid": os.getpid(), "created": psutil.Process().create_time()},
        )
        if (directory / "cancel").exists():
            state.update(state="CANCELLED", reason="user_cancelled")
            return
        request = read_small(directory / "request.json")
        resources = request["resources"]
        state.update(state="RUNNING", started_at=now(), supervisor_pid=os.getpid())
        atomic_json(directory / "status.json", state)
        with (directory / "worker.log").open("ab") as output:
            worker = spawn(root, "training-worker", job_id, output)
        identity = {"pid": worker.pid, "created": psutil.Process(worker.pid).create_time()}
        atomic_json(directory / "worker.json", identity)
        state["worker_pid"] = worker.pid
        atomic_json(directory / "status.json", state)
        while worker.poll() is None:
            reason = None
            if (directory / "cancel").exists():
                if cancellation is None:
                    cancellation = time.monotonic()
                    state.update(state="CANCELLING")
                    atomic_json(directory / "status.json", state)
                if time.monotonic() - cancellation > 2:
                    reason = "cancellation_grace_exceeded"
            elif time.monotonic() - started > resources["max_wall_seconds"]:
                reason = "wall_time_limit"
            else:
                process = owned_process(identity)
                if process is not None:
                    try:
                        rss = sum(
                            p.memory_info().rss
                            for p in [process, *process.children(recursive=True)]
                        ) / (1024 * 1024)
                        peak_rss = max(peak_rss, rss)
                        if rss > resources["max_memory_mb"]:
                            reason = "memory_limit"
                    except psutil.NoSuchProcess:
                        pass
            if reason:
                kill_owned(identity)
                state.update(
                    state="CANCELLED" if cancellation is not None else "RESOURCE_LIMIT",
                    reason=reason,
                )
                return
            time.sleep(0.1)
        if (directory / "cancel").exists():
            state.update(state="CANCELLED", reason="user_cancelled")
            return
        outcome_path = directory / "outcome.json"
        outcome = (
            read_small(outcome_path)
            if outcome_path.exists()
            else {"state": "FAILED", "reason": "worker_exited_without_result"}
        )
        if outcome["state"] == "SUCCEEDED" and worker.returncode == 0:
            model_id = outcome["model_id"]
            publish_model(directory / "model-stage", root / "artifacts/models", model_id)
            state.update(state="SUCCEEDED", model_id=model_id, reason=None)
        else:
            state.update(
                state=outcome["state"] if outcome["state"] in TERMINAL else "FAILED",
                reason=outcome.get("reason", "worker_failed"),
            )
    except BaseException:  # noqa: BLE001 -- Supervisor process boundary must persist terminal state.
        kill_owned(identity)
        state.update(state="FAILED", reason="supervisor_failed")
    finally:
        state["finished_at"] = now()
        state["usage"] = {
            "elapsed_seconds": max(0.0, time.monotonic() - started),
            "sampled_peak_rss_mb": peak_rss,
        }
        atomic_json(directory / "status.json", state)
        release(root, job_id)


def work(root, job_id):
    root, directory = Path(root), paths(root, job_id)
    state = read_small(directory / "status.json")
    if (
        state["state"] not in ("RUNNING", "CANCELLING")
        or owned_process(read_small(directory / "supervisor.json")) is None
    ):
        return 2
    with (directory / "worker.lock").open("xb"):
        pass
    atomic_json(
        directory / "worker.json", {"pid": os.getpid(), "created": psutil.Process().create_time()}
    )
    outcome = {"state": "FAILED", "reason": "training_failed"}
    try:
        from bybit_quant.training.engine import run_training
        from bybit_quant.training.runtime import Cancelled, ResourceLimit

        request = read_small(directory / "request.json")
        c = read_configuration(directory / "configuration.json")
        source = (
            read_small(directory / "source.json")
            if request["source_snapshot_file"] is not None
            else None
        )
        dataset = Dataset(root / "artifacts/datasets" / str(UUID(request["dataset_id"])), source)
        try:
            model_id = run_training(directory, dataset, c, request, job_id)
            outcome = {"state": "SUCCEEDED", "model_id": model_id}
        except Cancelled:
            outcome = {"state": "CANCELLED", "reason": "user_cancelled"}
        except ResourceLimit as error:
            outcome = {"state": "RESOURCE_LIMIT", "reason": str(error)}
    except Exception as error:  # noqa: BLE001 -- Worker boundary logs only a sanitized exception type.
        log(directory, "failed", error_type=type(error).__name__)  # No raw input/error strings.
    finally:
        atomic_json(directory / "outcome.json", outcome)
    return 0 if outcome["state"] == "SUCCEEDED" else 2
