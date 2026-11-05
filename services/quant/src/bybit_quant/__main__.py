"""Local health command, independent of exchange and database credentials."""

import argparse
import json
import platform

from bybit_quant import __version__


def main() -> None:
    parser = argparse.ArgumentParser(prog="bybit-quant")
    parser.add_argument("command", choices=["health"])
    parser.parse_args()
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
