"""Incremental Gymnasium adapter; every financial transition belongs to simulator M5."""

from copy import deepcopy
from typing import ClassVar

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from bybit_quant.baselines.evaluator import CountSink
from bybit_quant.configuration import configuration
from bybit_quant.contracts import validate
from bybit_quant.features.schema import observation_schema
from bybit_quant.simulation.numeric import ZERO, decimal, exact, wire
from bybit_quant.simulation.session import DatasetSession


class TradingEnv(gym.Env):
    metadata: ClassVar[dict] = {"render_modes": []}

    def __init__(self, dataset, config, normalizer, policy, start, end, *, sink_factory=None):
        super().__init__()
        self.dataset = dataset
        self.c = configuration(config)
        self.normalizer = deepcopy(normalizer)
        self.policy = deepcopy(policy)
        self.start, self.end = start, end
        self.schema = observation_schema(self.c)
        self.observation_space = spaces.Box(
            -np.finfo(np.float32).max,
            np.finfo(np.float32).max,
            shape=(self.schema["schema"]["dimension"],),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(5)
        self.sink_factory = sink_factory or CountSink
        self.session = None
        self.frame = None
        self.done = True
        self.steps = 0
        self.previous_equity = decimal(self.c["risk"]["initial_capital"])

    @property
    def simulator(self):
        if self.session is None:
            raise RuntimeError("reset_required")
        return self.session.sim

    @exact
    def reset(self, *, seed=None, options=None):
        if options not in (None, {}):
            raise ValueError("episode_options_unsupported")
        super().reset(seed=seed)
        if seed is not None:
            self.action_space.seed(seed)
        self.close()
        self.dataset.verify_files()
        self.session = DatasetSession(
            self.dataset,
            self.c,
            self.normalizer,
            self.policy,
            self.start,
            self.end,
            self.sink_factory(),
        )
        try:
            self.frame = next(f for f in self.session.frames if f.time_ms >= self.start)
        except BaseException:
            self.close()
            raise
        self.done = False
        self.steps = 0
        self.previous_equity = self.simulator.ledger.initial
        return self._observation(), self._info(ZERO, None, False, False)

    def _observation_result(self):
        if self.done:
            return self.session.terminal_observation or {
                "valid": False,
                "reason": "terminal_unavailable",
            }
        return self.frame.observation

    def _observation(self):
        observation = self._observation_result()
        if not observation["valid"]:
            return np.zeros(self.observation_space.shape, dtype=np.float32)
        result = np.array(observation["values"], dtype=np.float32)
        if not self.observation_space.contains(result) or not np.isfinite(result).all():
            raise ValueError("invalid_environment_observation")
        return result

    def action_masks(self):
        if self.session is None:
            raise RuntimeError("reset_required")
        if self.done:
            return np.array([True, False, False, False, False], dtype=np.bool_)
        f = self.frame
        return np.array(
            self.simulator.action_mask(
                f.time_ms,
                f.atr,
                f.observation["valid"],
                f.reference,
            ),
            dtype=np.bool_,
        )

    @exact
    def _equity(self):
        reference = self.simulator.market.price if self.done else self.frame.reference
        return self.simulator.ledger.snapshot(reference)["equity"]

    @exact
    def _info(self, reward, accepted, terminated, truncated):
        observation = self._observation_result()
        equity = self._equity()
        initial = self.simulator.ledger.initial
        result = {
            "version": "1",
            "environment_version": "restricted_gym_v1",
            "reward_version": "net_equity_initial_v1",
            "time_ms": self.session.time_ms,
            "steps": self.steps,
            "schema_hash": self.schema["sha256"],
            "normalizer_id": self.normalizer.id,
            "observation_valid": observation["valid"],
            "observation_reason": None if observation["valid"] else observation["reason"],
            "action_mask": self.action_masks().tolist(),
            "action_accepted": accepted,
            "equity": wire(equity),
            "reward_decimal": wire(reward),
            "cumulative_reward": wire((equity - initial) / initial),
            "status": self.simulator.status,
            "reason": self.simulator.reason if self.done else None,
            "bootstrap_discount": 0 if self.done else 1,
            "learning_terminal": terminated,
            "raw_terminated": terminated,
            "raw_truncated": truncated,
            "report": deepcopy(self.session.report),
        }
        validate("rl-info-v1", result)
        return result

    @exact
    def step(self, action):
        if self.session is None or self.done:
            raise RuntimeError("reset_required")
        if isinstance(action, (bool, np.bool_)) or not self.action_space.contains(action):
            raise ValueError("action_outside_discrete_space")
        f = self.frame
        accepted = self.simulator.submit_masked(
            f.time_ms,
            int(action),
            f.atr,
            f.observation["valid"],
            f.reference,
        )
        try:
            self.frame = next(self.session.frames)
        except StopIteration:
            self.done = True
        except BaseException:
            self.close()
            raise
        self.steps += 1
        terminated = self.done and self.simulator.termination != "truncated"
        truncated = self.done and not terminated
        equity = self._equity()
        reward = (equity - self.previous_equity) / self.simulator.ledger.initial
        self.previous_equity = equity
        info = self._info(reward, accepted, terminated, truncated)
        return self._observation(), float(reward), terminated, truncated, info

    def close(self):
        if self.session is not None:
            self.session.close()
        self.session = self.frame = None
        self.done = True


class SettledEpisodeWrapper(gym.Wrapper):
    """Signal an absorbing learning boundary without hiding the raw range truncation."""

    def action_masks(self):
        return self.env.action_masks()

    def step(self, action):
        observation, reward, terminated, truncated, info = self.env.step(action)
        if truncated and info["bootstrap_discount"] == 0:
            terminated = True
            info = {**info, "learning_terminal": True}
        return observation, reward, terminated, truncated, info
