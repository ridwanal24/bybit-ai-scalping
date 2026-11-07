import json
import math
import subprocess
import sys
from copy import deepcopy
from uuid import uuid4

import numpy as np
import pytest
from feature_helpers import START, source_snapshot
from gymnasium.utils.env_checker import check_env
from simulation_helpers import MINUTE
from test_simulation_integration import inputs, revise_main

from bybit_quant.artifacts import save_normalizer
from bybit_quant.contracts import canonical, digest
from bybit_quant.features.alignment import feature_rows
from bybit_quant.features.normalization import fit
from bybit_quant.rl import SettledEpisodeWrapper, TradingEnv
from bybit_quant.rl.artifacts import create_episode, verify_episode
from bybit_quant.simulation.numeric import decimal
from bybit_quant.simulation.runner import run_dataset
from bybit_quant.simulation.state import MemorySink


def setup(tmp_path, *, end=40, mode="HYBRID"):
    d, c, _, p, _, _ = inputs(tmp_path)

    def flat(rows):
        for row in rows:
            row.update(open="100", high="100.5", low="99.5", close="100")

    d = revise_main(d, flat)
    c["exit"] = {
        "mode": mode,
        "fixed_tp_enabled": mode != "AI_EXIT",
        "ai_close_enabled": mode != "FIXED_RR",
        "rr": None if mode == "AI_EXIT" else "2",
    }
    n = fit(feature_rows(d.bind(c), c), c, d.manifest, START, START + 20 * MINUTE)
    return d, c, n, p, START + 20 * MINUTE, START + end * MINUTE


def make(args):
    return TradingEnv(*args, sink_factory=MemorySink)


def finish(env, action=0):
    rewards = []
    while True:
        observation, reward, terminated, truncated, info = env.step(action)
        rewards.append(reward)
        if terminated or truncated:
            return observation, rewards, terminated, truncated, info


def test_gymnasium_checker_spaces_and_seed(tmp_path):
    env = make(setup(tmp_path))
    check_env(env, skip_render_check=True)
    one, info = env.reset(seed=42)
    assert one.dtype == np.float32 and one.shape == env.observation_space.shape
    assert env.observation_space.contains(one) and np.isfinite(one).all()
    assert env.action_space.n == 5 and env.action_masks().dtype == np.bool_
    first = [env.np_random.integers(1000) for _ in range(5)]
    two, repeated = env.reset(seed=42)
    assert np.array_equal(one, two) and info == repeated
    assert first == [env.np_random.integers(1000) for _ in range(5)]
    assert env.action_masks().tolist() == [True, True, True, False, False]
    env.close()


@pytest.mark.parametrize("mode", ["HYBRID", "AI_EXIT", "FIXED_RR"])
@pytest.mark.parametrize("side,action,close", [("LONG", 1, 3), ("SHORT", 2, 4)])
def test_state_exit_masks_and_masked_actions_are_noop(tmp_path, mode, side, action, close):
    env = make(setup(tmp_path, mode=mode))
    env.reset(seed=1)
    before = (env.simulator.ledger.snapshot("100"), deepcopy(env.simulator.sink.rows))
    mask = env.action_masks()
    mask[:] = False
    assert env.action_masks()[0]
    assert (env.simulator.ledger.snapshot("100"), env.simulator.sink.rows) == before
    _, reward, _, _, info = env.step(action)
    assert info["action_accepted"] and reward < 0
    assert env.simulator.ledger.position.side == (1 if side == "LONG" else -1)
    expected = [True, False, False, False, False]
    expected[close] = mode != "FIXED_RR"
    assert env.action_masks().tolist() == expected
    equity = info["equity"]
    _, reward, _, _, info = env.step(action)  # Stacking is masked, not queued.
    assert not info["action_accepted"] and reward == 0 and info["equity"] == equity
    assert env.simulator.pending is None
    env.close()


def test_same_script_has_identical_ledger_observations_and_net_reward(tmp_path):
    args = setup(tmp_path)
    env = make(args)
    initial, info = env.reset(seed=42)
    actions, observations, rewards = [], [(info["time_ms"], initial.tolist())], []
    script = {20: 1, 24: 3, 32: 2, 36: 4}
    while True:
        index = (info["time_ms"] - START) // MINUTE
        action = script.get(index, 0)
        assert env.action_masks()[action]
        actions.append({"decision_ms": info["time_ms"], "action": action})
        observation, reward, terminated, truncated, info = env.step(np.int64(action))
        rewards.append(reward)
        if terminated or truncated:
            break
        observations.append((info["time_ms"], observation.tolist()))
    direct = MemorySink()
    report = run_dataset(*args, actions=actions, sink=direct)
    assert report == info["report"]
    assert direct.rows == env.simulator.sink.rows
    assert {t["side"] for t in direct.rows["trades"]} == {"LONG", "SHORT"}
    observed = []
    run_dataset(
        *args,
        callback=lambda t, o: (
            observed.append((t, o["values"])) or script.get((t - START) // MINUTE, 0)
        ),
    )
    assert observed == observations
    assert math.fsum(rewards) == pytest.approx(float(report["net_equity_change"]) / 1000)
    assert not terminated and truncated and info["bootstrap_discount"] == 0
    assert env.action_masks().tolist() == [True, False, False, False, False]
    env.close()


def test_terminal_settlement_is_in_last_reward_once_and_post_settlement_observation(tmp_path):
    env = make(setup(tmp_path, end=25))
    env.reset(seed=0)
    _, entry_reward, _, _, _ = env.step(1)
    observation, rewards, terminated, truncated, info = finish(env)
    assert entry_reward < 0 and rewards[-1] < 0
    assert not terminated and truncated and info["raw_truncated"] and not info["learning_terminal"]
    assert sum(rewards) + entry_reward == pytest.approx(float(info["cumulative_reward"]))
    trades = env.simulator.sink.rows["trades"]
    assert len(trades) == 1 and trades[0]["reason"] == "terminal_settlement"
    assert info["report"]["final_position"] == "FLAT"
    assert observation[-11] == 0  # Current position side, not a pre-settlement position.
    with pytest.raises(RuntimeError, match="reset_required"):
        env.step(0)
    assert len(trades) == 1
    env.close()


def test_settlement_wrapper_prevents_standard_time_limit_bootstrap(tmp_path):
    env = SettledEpisodeWrapper(make(setup(tmp_path, end=22)))
    env.reset(seed=1)
    _, rewards, terminated, truncated, info = finish(env)
    assert terminated and truncated and info["raw_truncated"] and not info["raw_terminated"]
    assert info["learning_terminal"] and info["bootstrap_discount"] == 0
    # Standard learner target r + gamma*(1-terminated)*V(next) cannot add reset value.
    assert rewards[-1] + 0.99 * (1 - terminated) * 12345 == rewards[-1]
    check_env(env.unwrapped, skip_render_check=True)
    env.close()


def test_always_hold_and_reset_never_create_reward_or_carry_positions(tmp_path):
    env = make(setup(tmp_path, end=25))
    first, _ = env.reset(seed=7)
    _, rewards, _, _, info = finish(env)
    assert rewards == [0] * 5 and info["report"]["trades"] == 0
    env.reset(seed=7)
    env.step(1)
    reset, info = env.reset(seed=7)
    assert np.array_equal(first, reset) and info["equity"] == "1000"
    assert info["cumulative_reward"] == "0" and env.simulator.ledger.position is None
    assert env.simulator.ledger.fees == 0 and env.simulator.pending is None
    assert not env.simulator.risk.daily_latched
    env.close()


@pytest.mark.parametrize("action", [-1, 5, 1.5, True, np.bool_(False), "1", None])
def test_malformed_action_does_not_advance_or_charge(tmp_path, action):
    env = make(setup(tmp_path))
    _, info = env.reset(seed=1)
    with pytest.raises(ValueError, match="action_outside"):
        env.step(action)
    assert env.steps == 0 and env.frame.time_ms == info["time_ms"]
    assert env.simulator.ledger.fees == 0
    env.close()


def test_lifecycle_closed_env_and_options_fail_without_silent_range_change(tmp_path):
    env = make(setup(tmp_path))
    with pytest.raises(RuntimeError):
        env.step(0)
    with pytest.raises(RuntimeError):
        env.action_masks()
    with pytest.raises(ValueError, match="options_unsupported"):
        env.reset(options={"episode_end_ms": START})
    env.reset()
    env.close()
    env.close()
    with pytest.raises(RuntimeError):
        env.step(0)


def test_sizing_cooldown_risk_forced_and_final_latency_masks(tmp_path):
    args = setup(tmp_path, end=28)
    env = make(args)
    env.reset()
    # Preview uses only known price/ATR and never changes the ledger.
    env.simulator.execution.instrument["min_notional"] = "999999"
    assert env.action_masks().tolist() == [True, False, False, False, False]
    env.simulator.execution.instrument["min_notional"] = "5"
    env.step(1)
    env.step(3)
    assert not env.action_masks()[1]  # Configured five-bar cooldown after exit.
    for _ in range(5):
        env.step(0)
    assert not env.action_masks()[1]  # Last execution interval cannot accept entry.
    env.reset()
    env.simulator.risk.daily_latched = True
    assert not env.action_masks()[1]
    env.simulator.risk.daily_latched = False
    env.simulator.forced = "max_holding_bars"
    assert env.action_masks().tolist() == [True, False, False, False, False]
    env.simulator.forced = None
    env.simulator.policy["execution_latency_ms"] = 600000
    assert not env.action_masks()[1]
    env.close()


def test_funding_on_existing_position_before_discretionary_close(tmp_path):
    args = list(setup(tmp_path, end=25))
    args[3]["funding_schedule"][0]["interval_ms"] = 2 * MINUTE
    env = make(args)
    env.reset()
    env.step(1)
    env.step(0)
    _, reward, _, _, info = env.step(3)  # Funding22 precedes exit22.
    events = [e for e in env.simulator.sink.rows["events"] if e["kind"] in ("funding", "exit")]
    assert [e["kind"] for e in events] == ["funding", "exit"]
    assert decimal(events[0]["amount"]) < 0 and reward < 0
    assert decimal(info["equity"]) == env.simulator.ledger.wallet
    _, _, _, _, info = finish(env)
    assert decimal(info["report"]["funding"]) == decimal(events[0]["amount"])
    env.close()


def test_forced_holding_exit_is_charged_when_agent_holds(tmp_path):
    args = list(setup(tmp_path, end=25))
    args[1]["risk"]["max_holding_bars"] = 2
    args[2] = fit(
        feature_rows(args[0].bind(args[1]), args[1]),
        args[1],
        args[0].manifest,
        START,
        START + 20 * MINUTE,
    )
    env = make(args)
    env.reset()
    env.step(1)
    env.step(0)
    assert env.action_masks().tolist() == [True, False, False, False, False]
    _, reward, _, _, _ = env.step(0)
    assert reward < 0 and env.simulator.ledger.position is None
    assert env.simulator.sink.rows["trades"][0]["reason"] == "max_holding_bars"
    env.close()


def test_drawdown_termination_and_negative_equity_are_finite_and_not_clipped(tmp_path):
    args = list(setup(tmp_path, end=25))
    args[0] = revise_main(args[0], lambda rows: rows[21].update(high="2000"))
    env = make(args)
    env.reset()
    env.step(2)
    observation, reward, terminated, truncated, info = env.step(0)
    assert terminated and not truncated and reward < -1
    assert np.isfinite(observation).all() and not observation.any()
    assert not info["observation_valid"] and decimal(info["equity"]) < 0
    assert info["report"]["status"] == "invalid" and info["reason"] == "bankruptcy"
    assert info["bootstrap_discount"] == 0 and info["report"]["final_position"] == "SHORT"
    env.close()


def test_overtrading_and_holding_a_loser_do_not_hide_costs_or_unrealized_loss(tmp_path):
    args = list(setup(tmp_path, end=40))
    args[1]["risk"]["cooldown_bars"] = 0
    env = make(args)

    def run(roundtrips):
        env.reset(seed=0)
        rewards = []
        for _ in range(roundtrips):
            rewards += [env.step(1)[1], env.step(3)[1]]
        _, remaining, _, _, info = finish(env)
        return sum(rewards + remaining), info

    one, _ = run(1)
    four, info = run(4)
    assert four < one < 0 and info["report"]["trades"] == 4
    assert four == pytest.approx(float(info["cumulative_reward"]))
    env.close()
    args[0] = revise_main(
        args[0], lambda rows: rows[21].update(open="99.8", close="99.8", low="99.5")
    )
    env = make(args)
    env.reset()
    env.step(1)
    _, losing_reward, _, _, _ = env.step(0)
    assert losing_reward < 0 and env.simulator.ledger.position is not None
    env.close()


def test_delayed_main_observation_uses_sentinel_and_hold_only(tmp_path):
    d, c, n, p, start, end = setup(tmp_path, end=26)

    class Delayed:
        def __getattr__(self, key):
            return getattr(d, key)

        def candles(self, tf):
            for row in d.candles(tf):
                if tf == "1m" and row["close_time_ms"] == start:
                    row["available_at_ms"] = start + 2 * MINUTE
                yield row

        def bind(self, configuration):
            return {tf: self.candles(tf) for tf in d.bind(configuration)}

    env = make((Delayed(), c, n, p, start, end))
    observation, info = env.reset()
    assert not info["observation_valid"] and not observation.any()
    assert env.action_masks().tolist() == [True, False, False, False, False]
    _, reward, _, _, info = env.step(1)
    assert reward == 0 and not info["action_accepted"]
    assert env.simulator.ledger.position is None
    env.step(0)
    _, _, _, _, info = env.step(0)
    assert info["observation_valid"] and env.action_masks()[1]
    env.close()


def test_future_prices_cannot_change_observation_mask_reward_or_prefix_ledger(tmp_path):
    args = list(setup(tmp_path, end=40))

    def run():
        env = make(args)
        observation, info = env.reset(seed=9)
        prefix = [(observation.tolist(), info)]
        env.step(1)
        for _ in range(5):
            observation, reward, _, _, info = env.step(0)
            prefix.append((observation.tolist(), reward, info))
        ledger = deepcopy(env.simulator.sink.rows)
        env.close()
        return prefix, ledger

    before = run()
    args[0] = revise_main(
        args[0], lambda rows: rows[35].update(open="200", high="210", low="190", close="205")
    )
    assert run() == before


def test_episode_artifact_replays_and_rejects_forged_reward_even_with_new_hash(tmp_path):
    args = setup(tmp_path, end=30)
    out, sims = tmp_path / "episodes", tmp_path / "simulations"
    first = create_episode(out, sims, *args, 42, "masked_random")
    assert first == create_episode(out, sims, *args, 42, "masked_random")
    directory = out / first["episode_id"]
    assert verify_episode(directory, sims)["report"] == first["report"]
    rows = [json.loads(line) for line in (directory / "transitions.jsonl").read_text().splitlines()]
    rows[0]["reward_decimal"] = "123"
    (directory / "transitions.jsonl").write_text(
        "".join(canonical(row) + "\n" for row in rows), "utf-8"
    )
    with pytest.raises(ValueError, match="rl_file_checksum"):
        verify_episode(directory, sims)
    from bybit_quant.dataset import file_hash

    manifest = json.loads((directory / "manifest.json").read_text())
    manifest["transitions.jsonl"] = file_hash(directory / "transitions.jsonl")
    (directory / "manifest.json").write_text(canonical(manifest), "utf-8")
    with pytest.raises(ValueError, match="rl_reward_ledger_mismatch"):
        verify_episode(directory, sims, digest(manifest))


def test_pending_intent_masks_entries_until_actual_delayed_fill(tmp_path):
    args = list(setup(tmp_path, end=30))
    args[3]["execution_latency_ms"] = 2 * MINUTE
    env = make(args)
    env.reset()
    env.step(1)
    assert env.simulator.pending is not None and env.simulator.ledger.position is None
    assert env.action_masks().tolist() == [True, False, False, False, False]
    env.step(0)
    assert env.simulator.ledger.position is None
    env.step(0)
    assert env.simulator.ledger.position is not None and env.simulator.pending is None
    assert env.simulator.ledger.position.opened_ms == START + 22 * MINUTE
    env.close()


def test_mask_uses_closed_price_and_fill_revalidates_against_future_gap(tmp_path):
    args = list(setup(tmp_path, end=25))
    args[0] = revise_main(
        args[0], lambda rows: rows[20].update(open="10000", high="10001", low="9999", close="10000")
    )
    env = make(args)
    env.reset()
    assert env.action_masks()[1]  # Frozen ATR1 on known price100 is feasible.
    _, reward, _, _, info = env.step(1)
    assert info["action_accepted"]  # Intent accepted, not a guarantee of fill.
    assert env.simulator.rejections["stop_distance_outside_limits"] == 1
    assert env.simulator.ledger.position is None and reward == 0
    assert env.simulator.ledger.fees == 0
    env.close()


def test_exact_entry_exit_reward_hand_calculation(tmp_path):
    env = make(setup(tmp_path, end=25))
    env.reset()
    _, _, _, _, entered = env.step(1)
    assert env.simulator.ledger.position.quantity == decimal("4.166")
    assert entered["reward_decimal"] == "-0.0004166"
    _, _, _, _, exited = env.step(3)
    assert exited["reward_decimal"] == "-0.0004166"
    assert exited["equity"] == "999.1668" and exited["cumulative_reward"] == "-0.0008332"
    env.close()


def test_drawdown_gap_terminates_after_close_and_day_latch_blocks_entry(tmp_path):
    args = list(setup(tmp_path, end=25))
    args[1]["risk"].update(daily_loss_limit="0.01", max_drawdown="0.01")
    args[0] = revise_main(
        args[0], lambda rows: rows[21].update(open="90", high="90.5", low="89.5", close="90")
    )
    env = make(args)
    env.reset()
    env.step(1)
    _, reward, terminated, truncated, info = env.step(0)
    assert terminated and not truncated and reward < 0
    assert (
        info["reason"] == "drawdown_limit" and info["report"]["status"] == "terminated_restricted"
    )
    assert env.simulator.ledger.position is None and env.simulator.risk.drawdown_latched
    assert env.simulator.risk.daily_latched and info["bootstrap_discount"] == 0
    env.close()


def test_cli_replay_exit_codes_and_sanitized_errors(tmp_path):
    d, c, n, p, start, end = setup(tmp_path, end=25)
    store, dataset_id = tmp_path / "store", str(uuid4())
    dest = store / "artifacts/datasets" / dataset_id
    dest.parent.mkdir(parents=True)
    d.directory.rename(dest)
    save_normalizer(store / "artifacts/features", n)
    (tmp_path / "config.json").write_text(canonical(c), "utf-8")
    (tmp_path / "snapshot.json").write_text(canonical(source_snapshot()), "utf-8")
    request = {
        "version": "1",
        "dataset_id": dataset_id,
        "configuration_file": "config.json",
        "source_snapshot_file": "snapshot.json",
        "normalizer_id": n.id,
        "episode_start_ms": start,
        "episode_end_ms": end,
        "policy": p,
        "seed": 42,
        "agent": "masked_random",
    }
    path = tmp_path / "request.json"
    path.write_text(canonical(request), "utf-8")
    code = (
        "from pathlib import Path; import sys; from bybit_quant.rl import cli; "
        "cli.ROOT=Path(sys.argv[1]); sys.argv=['bybit-quant','environment-run','--request',sys.argv[2]]; "
        "from bybit_quant.__main__ import main; main()"
    )

    def run():
        return subprocess.run(
            [sys.executable, "-c", code, str(store), str(path)],
            capture_output=True,
            text=True,
            check=False,
        )

    one, two = run(), run()
    assert one.returncode == two.returncode == 0, one.stderr
    assert json.loads(one.stdout) == json.loads(two.stdout)
    from bybit_quant.dataset import Dataset

    revised = Dataset(dest, source_snapshot())
    revise_main(revised, lambda rows: rows[21].update(high="2000"))
    diagnostic = run()
    assert diagnostic.returncode == 2 and json.loads(diagnostic.stdout)["status"] == "invalid"
    request["seed"] = "secret-invalid-seed"
    path.write_text(canonical(request), "utf-8")
    bad = run()
    assert bad.returncode == 1 and "secret" not in bad.stderr and not bad.stdout
