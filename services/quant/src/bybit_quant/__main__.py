"""Local health command, independent of exchange and database credentials."""

import argparse
import json
import platform

from jsonschema.exceptions import ValidationError

from bybit_quant import __version__


def main() -> None:
    parser = argparse.ArgumentParser(prog="bybit-quant")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("health")
    fit = commands.add_parser("features-fit")
    build = commands.add_parser("features-build")
    for command in (fit, build):
        command.add_argument("--dataset", required=True)
        command.add_argument("--config", required=True)
        command.add_argument("--source-snapshot")
    fit.add_argument("--train-start-ms", required=True, type=int)
    fit.add_argument("--train-end-ms", required=True, type=int)
    build.add_argument("--normalizer", required=True)
    build.add_argument("--context", required=True)
    simulation = commands.add_parser("simulation-run")
    simulation.add_argument("--request", required=True)
    baseline = commands.add_parser("baseline-run")
    baseline.add_argument("--request", required=True)
    environment = commands.add_parser("environment-run")
    environment.add_argument("--request", required=True)
    training = commands.add_parser("training-submit")
    training.add_argument("--request", required=True)
    training.add_argument("--root")
    for name in ("training-status", "training-cancel", "training-supervise", "training-worker"):
        command = commands.add_parser(name)
        command.add_argument("--job", required=True)
        command.add_argument("--root")
    for name, option in (
        ("evaluation-register", "request"),
        ("evaluation-run", "protocol"),
        ("evaluation-report", "report"),
        ("evaluation-freeze", "report"),
        ("evaluation-holdout", "selection"),
    ):
        command = commands.add_parser(name)
        command.add_argument("--" + option, required=True)
        command.add_argument("--root")
    args = parser.parse_args()
    if args.command != "health":
        if args.command.startswith("evaluation-"):
            from bybit_quant.evaluation.cli import execute
        elif args.command.startswith("training-"):
            from bybit_quant.training.cli import execute
        elif args.command == "environment-run":
            from bybit_quant.rl.cli import execute
        elif args.command == "baseline-run":
            from bybit_quant.baselines.cli import execute
        elif args.command == "simulation-run":
            from bybit_quant.simulation.cli import execute
        else:
            from bybit_quant.feature_cli import execute

        try:
            execute(args)
        except (
            ValueError,
            KeyError,
            TypeError,
            OSError,
            ValidationError,
            StopIteration,
            ArithmeticError,
        ):
            parser.exit(1, "Quant command failed: invalid or incompatible input/artifact.\n")
        return
    print(
        json.dumps(
            {
                "status": "ok",
                "service": "quant",
                "version": __version__,
                "python": platform.python_version(),
            }
        )
    )


if __name__ == "__main__":
    main()
