"""Mask-aware OOS research episode with invalid diagnostics and independent M5 replay."""

import math

import numpy as np

from bybit_quant.artifacts import publish_file
from bybit_quant.baselines.metrics import artifact_metrics
from bybit_quant.contracts import canonical, digest
from bybit_quant.dataset import records
from bybit_quant.features.schema import observation_schema
from bybit_quant.rl import TradingEnv
from bybit_quant.simulation.artifacts import create_artifact
from bybit_quant.training.runtime import parameter_hash


def episode(model, dataset, c, normalizer, policy, scope, control, simulations, action_path):
    if observation_schema(c)["sha256"] != normalizer.payload["feature_schema_hash"]:
        raise ValueError("evaluation_feature_schema_mismatch")
    env = TradingEnv(dataset, c, normalizer, policy, *scope)
    actions = []
    reward_sum = 0.0
    try:
        observation, info = env.reset(seed=c["training"]["seed"])
        while True:
            control.check()
            mask = env.action_masks()
            action, _ = model.predict(observation, deterministic=True, action_masks=mask)
            action = int(np.asarray(action).item())
            if not 0 <= action < 5 or not mask[action]:
                raise ValueError("unmasked_evaluation_prediction")
            actions.append({"decision_ms": info["time_ms"], "action": action})
            observation, reward, terminated, truncated, info = env.step(action)
            if not info["action_accepted"]:
                raise ValueError("invalid_evaluation_action")
            reward_sum += reward
            if terminated or truncated:
                break
        publish_file(action_path, "".join(canonical(a) + "\n" for a in actions).encode("utf-8"))
        result = create_artifact(simulations, dataset, c, normalizer, policy, *scope, action_path)
        if result["report"] != info["report"] or not math.isclose(
            reward_sum, float(info["cumulative_reward"]), rel_tol=1e-12, abs_tol=1e-12
        ):
            raise ValueError("evaluation_reward_or_replay_mismatch")
        directory = simulations / result["artifact_id"]
        risk = sorted(
            {
                r["reason"]
                for r in records(directory / "events.jsonl")
                if r["kind"] == "risk" and r["reason"] in ("daily_loss_limit", "drawdown_limit")
            }
        )
        return {
            "action_sha256": digest(actions),
            "parameter_sha256": parameter_hash(model),
            "simulation_id": result["artifact_id"],
            "report": result["report"],
            "metrics": artifact_metrics(directory, result["report"], *scope),
            "risk_breaches": risk,
        }
    finally:
        env.close()
