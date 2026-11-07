"""Deterministic CPU runtime and cooperative controls, backed by a process supervisor."""

import hashlib
import platform
import random
import time

import gymnasium
import numpy as np
import psutil
import sb3_contrib
import stable_baselines3
import torch

from bybit_quant.rl import SettledEpisodeWrapper, TradingEnv


class Cancelled(Exception):
    pass


class ResourceLimit(Exception):
    pass


class InvalidEpisode(ValueError):
    pass


def seed_runtime(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    if torch.get_num_interop_threads() != 1:
        torch.set_num_interop_threads(1)
    torch.use_deterministic_algorithms(True)


def runtime_versions():
    return {
        "python": platform.python_version(),
        "torch": torch.__version__,
        "stable_baselines3": stable_baselines3.__version__,
        "sb3_contrib": sb3_contrib.__version__,
        "gymnasium": gymnasium.__version__,
        "numpy": np.__version__,
    }


def parameter_hash(model):
    digest = hashlib.sha256()
    for name, tensor in sorted(model.policy.state_dict().items()):
        value = tensor.detach().cpu().contiguous().numpy()
        if not np.isfinite(value).all():
            raise ValueError("nonfinite_model_parameters")
        digest.update(name.encode("utf-8"))
        digest.update(str(value.shape).encode("ascii"))
        digest.update(str(value.dtype).encode("ascii"))
        digest.update(value.tobytes())
    return digest.hexdigest()


class Control:
    def __init__(self, directory, resources):
        self.directory, self.resources = directory, resources
        self.started = time.monotonic()
        self.process = psutil.Process()

    def rss_mb(self):
        return self.process.memory_info().rss / (1024 * 1024)

    def check(self):
        if (self.directory / "cancel").exists():
            raise Cancelled("user_cancelled")
        if time.monotonic() - self.started > self.resources["max_wall_seconds"]:
            raise ResourceLimit("wall_time_limit")
        if self.rss_mb() > self.resources["max_memory_mb"]:
            raise ResourceLimit("memory_limit")


class GuardedEnv(SettledEpisodeWrapper):
    """No invalid transition reaches the learner; cycle chronological train episodes."""

    def __init__(
        self, dataset, c, normalizer, policy, scope, control, *, training=False, sink_factory=None
    ):
        self.scope = scope
        self.control = control
        self.training = training
        self.offset = 0
        self.episode_count = 0
        self.episode_bars = max(2, c["training"]["episode_length_bars"])
        super().__init__(
            TradingEnv(dataset, c, normalizer, policy, *scope, sink_factory=sink_factory)
        )

    def reset(self, *, seed=None, options=None):
        self.control.check()
        if seed is not None:
            self.offset = 0
            self.episode_count = 0
        if self.training:
            from bybit_quant.contracts import INTERVALS

            interval = INTERVALS[self.env.c["market"]["timeframe"]]
            start, limit = self.scope
            begin = start + self.offset * interval
            end = min(begin + self.episode_bars * interval, limit)
            if limit - end < 2 * interval:
                end = limit
            self.env.start, self.env.end = begin, end
            self.offset = 0 if end == limit else (end - start) // interval
        self.episode_count += 1
        observation, info = super().reset(seed=seed, options=options)
        self.control.check()
        return observation, info

    def step(self, action):
        self.control.check()
        result = super().step(action)
        info = result[4]
        if info["status"] == "invalid":
            raise InvalidEpisode("invalid_simulation_rollout")
        if not info["action_accepted"]:
            raise InvalidEpisode("invalid_masked_prediction")
        return result
