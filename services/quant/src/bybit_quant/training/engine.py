"""One bounded Small CPU MaskablePPO job; only the supervisor publishes its candidate."""

import math
import os
import platform
import subprocess
import time

import numpy as np
import psutil
import torch
from sb3_contrib import MaskablePPO
from stable_baselines3.common.callbacks import BaseCallback

from bybit_quant.artifacts import publish_file
from bybit_quant.configuration import parameter_count
from bybit_quant.contracts import canonical, config_hash, validate
from bybit_quant.dataset import file_hash
from bybit_quant.features.schema import observation_schema
from bybit_quant.simulation.artifacts import code_fingerprint
from bybit_quant.training.evaluation import evaluate
from bybit_quant.training.models import seal_model
from bybit_quant.training.preparation import prepare
from bybit_quant.training.runtime import (
    Control,
    GuardedEnv,
    parameter_hash,
    runtime_versions,
    seed_runtime,
)
from bybit_quant.training.storage import atomic_json, log


class Progress(BaseCallback):
    def __init__(self, directory, c, normalizer, request, control, env):
        super().__init__(verbose=0)
        self.directory, self.c, self.normalizer, self.request = directory, c, normalizer, request
        self.control, self.env = control, env
        self.rollouts = self.valid_actions = 0
        self.last_checkpoint = 0
        (directory / "checkpoints").mkdir(exist_ok=True)

    def report(self, phase):
        metrics = {}
        if self.model is not None:
            for key, value in self.model.logger.name_to_value.items():
                if isinstance(value, (float, int, np.number)) and math.isfinite(float(value)):
                    metrics[key] = float(value)
        progress = {
            "version": "1",
            "phase": phase,
            "timesteps": self.num_timesteps,
            "total_timesteps": self.c["training"]["total_timesteps"],
            "rollouts": self.rollouts,
            "episode_count": self.env.episode_count,
            "valid_actions": self.valid_actions,
            "elapsed_seconds": max(0.0, time.monotonic() - self.control.started),
            "rss_mb": self.control.rss_mb(),
            "metrics": metrics,
        }
        validate("training-progress-v1", progress)
        atomic_json(self.directory / "progress.json", progress)
        return progress

    def checkpoint(self):
        steps = self.num_timesteps
        if steps == self.last_checkpoint or steps < self.c["training"]["n_steps"]:
            return
        self.control.check()
        directory = self.directory / "checkpoints"
        path = directory / f"step-{steps:09d}.zip"
        temporary = directory / f".step-{steps:09d}.zip"
        self.model.save(temporary)
        os.replace(temporary, path)
        atomic_json(
            path.with_suffix(".json"),
            {
                "version": "1",
                "timesteps": steps,
                "sha256": file_hash(path),
                "parameter_sha256": parameter_hash(self.model),
                "normalizer_id": self.normalizer.id,
                "configuration_hash": config_hash(self.c),
                "runtime": runtime_versions(),
            },
        )
        self.last_checkpoint = steps
        retained = sorted(directory.glob("step-*.zip"))
        for old in retained[: -self.request["resources"]["max_checkpoints"]]:
            old.with_suffix(".json").unlink(missing_ok=True)
            old.unlink()
        log(self.directory, "checkpoint", timesteps=steps, sha256=file_hash(path))

    def _on_rollout_start(self):
        every = self.request["checkpoint_every_rollouts"] * self.c["training"]["n_steps"]
        if self.num_timesteps and self.num_timesteps % every == 0:
            self.checkpoint()  # Previous rollout has already been optimized.

    def _on_rollout_end(self):
        self.rollouts += 1
        log(self.directory, "rollout", **self.report("training"))

    def _on_step(self):
        self.control.check()
        self.valid_actions += 1
        if self.num_timesteps % 16 == 0:
            self.report("training")
        return True

    def _on_training_end(self):
        self.checkpoint()
        self.report("validation")


def git_state(root):
    options = {
        "cwd": root,
        "capture_output": True,
        "text": True,
        "creationflags": subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    }
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], check=False, **options)
        dirty = subprocess.run(
            ["git", "status", "--porcelain", "--untracked-files=no"], check=False, **options
        )
        return head.stdout.strip() if head.returncode == 0 else None, bool(dirty.stdout.strip())
    except OSError:
        return None, True


def run_training(directory, dataset, c, request, job_id):
    validate("training-request-v1", request)
    control = Control(directory, request["resources"])
    control.check()
    code = code_fingerprint()
    atomic_json(
        directory / "progress.json",
        {
            "version": "1",
            "phase": "preparing",
            "timesteps": 0,
            "total_timesteps": c["training"]["total_timesteps"],
            "rollouts": 0,
            "episode_count": 0,
            "valid_actions": 0,
            "elapsed_seconds": 0.0,
            "rss_mb": control.rss_mb(),
            "metrics": {},
        },
    )
    seed_runtime(c["training"]["seed"])
    c, split, normalizer = prepare(
        dataset,
        c,
        request["policy"],
        request["range_start_ms"],
        request["range_end_ms"],
        request["resources"],
        research=request.get("research_scope") == "advanced_evaluation_v1",
        research_fold=request.get("research_fold"),
    )
    publish_file(
        directory / "normalizer.json", (canonical(normalizer.payload) + "\n").encode("utf-8")
    )
    publish_file(directory / "split.json", (canonical(split) + "\n").encode("utf-8"))
    env = GuardedEnv(
        dataset, c, normalizer, request["policy"], split["train"], control, training=True
    )
    t, n = c["training"], c["network"]
    model = None
    try:
        model = MaskablePPO(
            "MlpPolicy",
            env,
            learning_rate=float(t["learning_rate"]),
            n_steps=t["n_steps"],
            batch_size=t["batch_size"],
            n_epochs=request["ppo_epochs"],
            gamma=float(t["gamma"]),
            gae_lambda=float(t["gae_lambda"]),
            ent_coef=float(t["entropy_coefficient"]),
            clip_range=float(t["clip_range"]),
            seed=t["seed"],
            device="cpu",
            verbose=0,
            policy_kwargs={
                "net_arch": {"pi": n["policy_layers"], "vf": n["value_layers"]},
                "activation_fn": torch.nn.Tanh if n["activation"] == "Tanh" else torch.nn.ReLU,
            },
        )
        actual_parameters = sum(p.numel() for p in model.policy.parameters())
        schema = observation_schema(c)
        if actual_parameters != parameter_count(c, schema["schema"]["dimension"]):
            raise ValueError("actual_parameter_count_mismatch")
        initial_hash = parameter_hash(model)
        callback = Progress(directory, c, normalizer, request, control, env)
        log(
            directory,
            "training_started",
            seed=t["seed"],
            parameters=actual_parameters,
            total_timesteps=t["total_timesteps"],
        )
        model.learn(t["total_timesteps"], callback=callback, progress_bar=False)
        control.check()
        if model.num_timesteps != t["total_timesteps"]:
            raise ValueError("training_timesteps_mismatch")
        trained_hash = parameter_hash(model)
        if trained_hash == initial_hash:
            raise ValueError("model_parameters_unchanged")
        stage = directory / "model-stage"
        stage.mkdir()
        model.save(stage / "model.zip")
        original, actions, simulation_directory = evaluate(
            model, dataset, c, normalizer, request["policy"], split["validation"], control
        )
        reloaded = MaskablePPO.load(stage / "model.zip", device="cpu")
        repeated, repeated_actions, _ = evaluate(
            reloaded, dataset, c, normalizer, request["policy"], split["validation"], control
        )
        if (
            original != repeated
            or actions != repeated_actions
            or parameter_hash(reloaded) != trained_hash
        ):
            raise ValueError("model_save_load_prediction_mismatch")
        from bybit_quant.contracts import CONTRACTS

        commit, dirty = git_state(CONTRACTS.parent.parent)
        metadata = {
            "version": "1",
            "status": "candidate_research_only",
            "execution_ready": False,
            "algorithm": "MaskablePPO",
            "policy": "MlpPolicy",
            "configuration": c,
            "configuration_hash": config_hash(c),
            "dataset_id": request["dataset_id"],
            "dataset_fingerprint": dataset.export["fingerprint"],
            "configuration_snapshot_id": dataset.export["configuration_snapshot_id"],
            "source_configuration_hash": dataset.export["configuration_hash"],
            "split": split,
            "normalizer_id": normalizer.id,
            "feature_schema_hash": schema["sha256"],
            "action_schema": "hold-long-short-close_long-close_short-v1",
            "reward_version": "net_equity_initial_v1",
            "environment_version": "restricted_gym_v1",
            "bootstrap_policy": "settled_absorbing_v1",
            "simulation_policy": request["policy"],
            "code_fingerprint": code,
            "git_commit": commit,
            "git_dirty": dirty,
            "runtime": runtime_versions(),
            "hardware": {
                "machine": platform.machine(),
                "processor": platform.processor() or "unknown",
                "logical_cpus": str(psutil.cpu_count()),
                "torch_threads": str(torch.get_num_threads()),
                "torch_interop_threads": str(torch.get_num_interop_threads()),
            },
            "resources": request["resources"],
            "ppo_epochs": request["ppo_epochs"],
            "seed": t["seed"],
            "timesteps": model.num_timesteps,
            "parameters": actual_parameters,
            "initial_parameter_sha256": initial_hash,
            "parameter_sha256": trained_hash,
            "validation_action_sha256": original["action_sha256"],
            "job_id": job_id,
            "checkpoint_every_rollouts": request["checkpoint_every_rollouts"],
        }
        if request.get("research_scope") is not None:
            metadata["research_scope"] = request["research_scope"]
        if code_fingerprint() != code:
            raise ValueError("training_code_changed")
        control.check()
        callback.report("publishing")
        model_id = seal_model(stage, metadata, normalizer, original, actions, simulation_directory)
        control.check()
        callback.report("finished")
        return model_id
    finally:
        env.close()
