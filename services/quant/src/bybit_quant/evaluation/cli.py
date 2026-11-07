"""Explicit protocol registration, bounded research run/report and locked final holdout."""

import json
from pathlib import Path

from bybit_quant.artifacts import identifier
from bybit_quant.contracts import CONTRACTS
from bybit_quant.evaluation.protocol import register

ROOT = CONTRACTS.parent.parent


def bounded(operation, *args):
    from bybit_quant.training.runtime import Cancelled, ResourceLimit

    try:
        return operation(*args)
    except (Cancelled, ResourceLimit):
        raise ValueError("evaluation_resource_or_cancellation_limit") from None


def execute(args):
    root = Path(args.root).resolve() if args.root else ROOT
    if args.command == "evaluation-register":
        result = {"protocol_id": register(root, args.request)}
    elif args.command == "evaluation-run":
        from bybit_quant.evaluation.runner import run

        result = bounded(run, root, args.protocol)
    elif args.command == "evaluation-report":
        from bybit_quant.evaluation.reports import verify_report

        payload = verify_report(
            root, root / "artifacts/evaluations/reports" / identifier(args.report)
        )
        result = {
            "report_id": args.report,
            "screen": payload["screen"],
            "status": payload["status"],
        }
    elif args.command == "evaluation-freeze":
        from bybit_quant.evaluation.holdout import freeze

        result = {"selection_id": freeze(root, args.report)}
    elif args.command == "evaluation-holdout":
        from bybit_quant.evaluation.holdout import evaluate_holdout

        result = bounded(evaluate_holdout, root, args.selection)
    else:
        raise ValueError("unsupported_evaluation_command")
    print(json.dumps(result))
