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
    args = parser.parse_args()
    if args.command != "health":
        from bybit_quant.feature_cli import execute

        try:
            execute(args)
        except (ValueError, KeyError, TypeError, OSError, ValidationError, StopIteration):
            parser.exit(1, "Feature command failed: invalid or incompatible input/artifact.\n")
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
