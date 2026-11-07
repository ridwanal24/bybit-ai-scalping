"""Closed-information baseline policies; execution and hard risk remain in M5."""

import random
from copy import deepcopy

from bybit_quant.contracts import validate


class Baseline:
    def __init__(self, specification, config, write_action):
        validate("baseline-strategy-v1", specification)
        self.spec = deepcopy(specification)
        self.mode = config["exit"]["mode"]
        self.rng = random.Random(specification.get("seed", 0))
        self.write = write_action
        self.previous_sign = None
        self.target = None
        self.attempted = False

    def observe(self, indicators):
        if indicators["gap"]:
            self.previous_sign = self.target = None
        spread = indicators["values"].get("ema_spread")
        if spread is None or spread == 0:
            return
        sign = 1 if spread > 0 else -1
        if self.previous_sign is not None and sign != self.previous_sign:
            self.target = sign
        self.previous_sign = sign

    def decide(self, time_ms, context):
        name = self.spec["name"]
        side = {"FLAT": 0, "LONG": 1, "SHORT": -1}[context["side"]]
        allowed = context["trading_allowed"]
        can_close = self.mode != "FIXED_RR"
        action = 0
        if name == "random":
            choices = [0]
            if side == 0 and allowed:
                choices += [1, 2]
            elif side and can_close:
                choices += [3 if side == 1 else 4]
            action = self.rng.choice(choices)
        elif name == "buy_hold" and not self.attempted and side == 0 and allowed:
            self.attempted = True
            action = 1
        elif name == "ema_crossover" and self.target is not None:
            if side == self.target:
                self.target = None
            elif side and can_close:
                action = 3 if side == 1 else 4
            elif side == 0 and allowed:
                action = 1 if self.target == 1 else 2
                self.target = None  # Rejection does not create an implicit retry strategy.
        self.write({"decision_ms": time_ms, "action": action})
        return action
