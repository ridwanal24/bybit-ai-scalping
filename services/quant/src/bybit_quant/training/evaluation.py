"""Deterministic mask-aware validation only; no access to final holdout decisions."""

import math

import numpy as np

from bybit_quant.baselines.metrics import artifact_metrics
from bybit_quant.contracts import digest, validate
from bybit_quant.simulation.artifacts import create_artifact
from bybit_quant.simulation.numeric import decimal, exact, wire
from bybit_quant.training.runtime import GuardedEnv, parameter_hash


@exact
def evaluate(model, dataset, c, normalizer, policy, scope, control):
    env = GuardedEnv(dataset, c, normalizer, policy, scope, control)
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
                raise ValueError("unmasked_model_prediction")
            actions.append({"decision_ms": info["time_ms"], "action": action})
            observation, reward, terminated, truncated, info = env.step(action)
            reward_sum += reward
            if terminated or truncated:
                break
        report = info["report"]
        expected = decimal(report["net_equity_change"]) / decimal(report["initial_capital"])
        if not math.isclose(reward_sum, float(expected), rel_tol=1e-12, abs_tol=1e-12):
            raise ValueError("validation_reward_reconciliation")
        actions_path = control.directory / "validation-actions.jsonl"
        from bybit_quant.contracts import canonical

        actions_path.write_text(
            "".join(canonical(a) + "\n" for a in actions), "utf-8", newline="\n"
        )
        replay = create_artifact(
            control.directory / "validation-simulations",
            dataset,
            c,
            normalizer,
            policy,
            *scope,
            actions_path,
        )
        control.check()
        if replay["report"] != report:
            raise ValueError("validation_ledger_replay_mismatch")
        directory = control.directory / "validation-simulations" / replay["artifact_id"]
        result = {
            "version": "1",
            "split": "validation",
            "start_ms": scope[0],
            "end_ms": scope[1],
            "steps": len(actions),
            "action_sha256": digest(actions),
            "parameter_sha256": parameter_hash(model),
            "reward_sum": wire(expected),
            "simulation_id": replay["artifact_id"],
            "report": report,
            "metrics": artifact_metrics(directory, report, *scope),
        }
        validate("training-validation-v1", result)
        return result, actions, directory
    finally:
        env.close()
