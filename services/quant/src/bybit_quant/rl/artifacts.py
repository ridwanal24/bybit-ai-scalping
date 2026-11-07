"""Bounded masked-agent episode smoke, shared simulator replay and reward-ledger reload."""

import math
import os
import platform
from pathlib import Path
from uuid import uuid4

import gymnasium
import numpy as np

from bybit_quant.artifacts import publish_file
from bybit_quant.contracts import canonical, config_hash, digest, validate
from bybit_quant.dataset import file_hash, records
from bybit_quant.rl.environment import TradingEnv
from bybit_quant.simulation.artifacts import (
    code_fingerprint,
    create_artifact,
    read_small,
    verify_artifact,
)
from bybit_quant.simulation.numeric import decimal, exact

FILES = ("episode.json", "actions.jsonl", "transitions.jsonl")


def observation_hash(observation):
    return digest(observation.tolist())


@exact
def create_episode(root, simulations, dataset, c, normalizer, policy, start, end, seed, agent):
    if (
        type(seed) is not int
        or not 0 <= seed <= 4294967295
        or agent not in ("hold", "masked_random")
    ):
        raise ValueError("invalid_episode_agent_or_seed")
    root, simulations = Path(root), Path(simulations)
    root.mkdir(parents=True, exist_ok=True)
    directory = root / (".episode-" + uuid4().hex)
    directory.mkdir()
    env = TradingEnv(dataset, c, normalizer, policy, start, end)
    code = code_fingerprint()
    try:
        observation, info = env.reset(seed=seed)
        reward_sum = 0.0
        with (
            (directory / "actions.jsonl").open("xb") as actions,
            (directory / "transitions.jsonl").open("xb") as transitions,
        ):
            while True:
                mask = env.action_masks()
                action = 0 if agent == "hold" else int(env.np_random.choice(mask.nonzero()[0]))
                decision = {"decision_ms": info["time_ms"], "action": action}
                actions.write((canonical(decision) + "\n").encode("utf-8"))
                before, previous_info = observation_hash(observation), info
                observation, reward, terminated, truncated, info = env.step(action)
                reward_sum += reward
                row = {
                    "step": info["steps"],
                    **decision,
                    "mask": mask.tolist(),
                    "accepted": info["action_accepted"],
                    "next_time_ms": info["time_ms"],
                    "observation_sha256": before,
                    "next_observation_sha256": observation_hash(observation),
                    "previous_equity": previous_info["equity"],
                    "equity": info["equity"],
                    "reward_decimal": info["reward_decimal"],
                    "terminated": terminated,
                    "truncated": truncated,
                }
                validate("rl-transition-v1", row)
                transitions.write((canonical(row) + "\n").encode("utf-8"))
                if terminated or truncated:
                    break
            for stream in (actions, transitions):
                stream.flush()
                os.fsync(stream.fileno())
        replay = create_artifact(
            simulations, dataset, c, normalizer, policy, start, end, directory / "actions.jsonl"
        )
        if replay["report"] != info["report"] or code_fingerprint() != code:
            raise ValueError("environment_replay_or_code_mismatch")
        payload = {
            "version": "1",
            "environment_version": "restricted_gym_v1",
            "reward_version": "net_equity_initial_v1",
            "runtime": {
                "python": platform.python_version(),
                "gymnasium": gymnasium.__version__,
                "numpy": np.__version__,
            },
            "seed": seed,
            "agent": agent,
            "code_fingerprint": code,
            "dataset_fingerprint": dataset.export["fingerprint"],
            "configuration_hash": config_hash(c),
            "normalizer_id": normalizer.id,
            "schema_hash": env.schema["sha256"],
            "simulation_id": replay["artifact_id"],
            "steps": info["steps"],
            "total_reward": info["cumulative_reward"],
            "reward_float_sum": reward_sum,
            "terminated": terminated,
            "truncated": truncated,
            "bootstrap_discount": 0,
            "report": info["report"],
        }
        validate("rl-episode-v1", payload)
        publish_file(directory / "episode.json", (canonical(payload) + "\n").encode("utf-8"))
        manifest = {name: file_hash(directory / name) for name in FILES}
        identity = digest(manifest)
        publish_file(directory / "manifest.json", (canonical(manifest) + "\n").encode("utf-8"))
        verify_episode(directory, simulations, identity)
        target = root / identity
        if target.exists():
            verify_episode(target, simulations)
        else:
            directory.rename(target)
        return {"episode_id": identity, **payload}
    finally:
        env.close()
        if directory.exists():
            for name in (*FILES, "manifest.json"):
                (directory / name).unlink(missing_ok=True)
            directory.rmdir()


@exact
def verify_episode(directory, simulations, expected_id=None):
    directory, simulations = Path(directory), Path(simulations)
    manifest = read_small(directory / "manifest.json")
    if set(manifest) != set(FILES) or digest(manifest) != (expected_id or directory.name):
        raise ValueError("rl_manifest_checksum")
    if any(file_hash(directory / name) != manifest[name] for name in FILES):
        raise ValueError("rl_file_checksum")
    episode = read_small(directory / "episode.json")
    validate("rl-episode-v1", episode)
    path = simulations / episode["simulation_id"]
    report = verify_artifact(path)
    source = read_small(path / "manifest.json")
    descriptor = read_small(path / "descriptor.json")
    if episode["runtime"]["python"] != descriptor["runtime"]["python"]:
        raise ValueError("rl_runtime_mismatch")
    for key in ("code_fingerprint", "dataset_fingerprint", "configuration_hash", "normalizer_id"):
        if source[key] != episode[key]:
            raise ValueError("rl_provenance_mismatch")
    if (
        episode["schema_hash"] != source["feature_schema_hash"]
        or episode["report"] != report
        or (manifest["actions.jsonl"] != source["actions_sha256"])
    ):
        raise ValueError("rl_replay_mismatch")
    initial = decimal(report["initial_capital"])
    previous_equity, reward_sum, count = initial, 0.0, 0
    previous_time = previous_observation = None
    ended = False
    points = iter(records(path / "equity.jsonl"))
    actions = iter(records(directory / "actions.jsonl"))
    for row in records(directory / "transitions.jsonl"):
        validate("rl-transition-v1", row)
        count += 1
        action = next(actions, None)
        if (
            ended
            or row["step"] != count
            or not row["accepted"]
            or not row["mask"][row["action"]]
            or action != {"decision_ms": row["decision_ms"], "action": row["action"]}
            or row["next_time_ms"] < row["decision_ms"]
            or previous_time is not None
            and row["decision_ms"] != previous_time
            or previous_observation is not None
            and row["observation_sha256"] != previous_observation
            or decimal(row["previous_equity"]) != previous_equity
        ):
            raise ValueError("rl_transition_order_or_action")
        ended = row["terminated"] or row["truncated"]
        if ended:
            expected_equity = decimal(report["final_equity"])
        else:
            point = next(points, None)
            while point is not None and not (
                point["time_ms"] == row["next_time_ms"] and point["phase"] == "close"
            ):
                point = next(points, None)
            if point is None:
                raise ValueError("rl_missing_equity_point")
            expected_equity = decimal(point["equity"])
        reward = (expected_equity - previous_equity) / initial
        if decimal(row["equity"]) != expected_equity or decimal(row["reward_decimal"]) != reward:
            raise ValueError("rl_reward_ledger_mismatch")
        previous_equity, previous_time = expected_equity, row["next_time_ms"]
        previous_observation = row["next_observation_sha256"]
        reward_sum += float(reward)
    expected_truncation = report["termination"] == "truncated"
    expected_return = decimal(report["net_equity_change"]) / initial
    if (
        not ended
        or next(actions, None) is not None
        or count != episode["steps"]
        or episode["truncated"] != expected_truncation
        or episode["terminated"] == expected_truncation
        or row["truncated"] != episode["truncated"]
        or row["terminated"] != episode["terminated"]
        or decimal(episode["total_reward"]) != expected_return
        or reward_sum != episode["reward_float_sum"]
        or not math.isclose(reward_sum, float(expected_return), rel_tol=1e-12, abs_tol=1e-12)
    ):
        raise ValueError("rl_episode_reward_or_boundary")
    return episode
