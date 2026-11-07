"""Persistent background research jobs; worker/supervisor accept only managed UUID jobs."""

import json
from pathlib import Path

from bybit_quant.contracts import CONTRACTS
from bybit_quant.training import jobs

ROOT = CONTRACTS.parent.parent


def execute(args):
    root = Path(args.root).resolve() if getattr(args, "root", None) else ROOT
    if args.command == "training-submit":
        result = jobs.submit(root, args.request)
    elif args.command == "training-status":
        result = jobs.status(root, args.job)
    elif args.command == "training-cancel":
        result = jobs.cancel(root, args.job)
    elif args.command == "training-supervise":
        jobs.supervise(root, args.job)
        return
    elif args.command == "training-worker":
        raise SystemExit(jobs.work(root, args.job))
    else:
        raise ValueError("unsupported_training_command")
    print(json.dumps(result))
