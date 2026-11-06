"""Cross-language export checker used by integration tests; not a trading engine."""

import json
import sys
from pathlib import Path

from bybit_quant.dataset import Dataset


def check(directory):
    dataset = Dataset(directory)
    print(json.dumps({"status": "passed", "files": len(dataset.export["files"])}))


if __name__ == "__main__":
    check(Path(sys.argv[1]))
