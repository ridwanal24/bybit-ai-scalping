"""Small atomic mutable job documents, separate from immutable model artifacts."""

import os
import time
from datetime import UTC, datetime
from uuid import uuid4

from bybit_quant.contracts import canonical


def now():
    return datetime.now(UTC).isoformat()


def atomic_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(".atomic-" + uuid4().hex)
    try:
        with temporary.open("xb") as output:
            output.write((canonical(payload) + "\n").encode("utf-8"))
            output.flush()
            os.fsync(output.fileno())
        # Windows readers can briefly hold the old file without delete sharing.
        for attempt in range(20):
            try:
                os.replace(temporary, path)
                break
            except PermissionError:
                if attempt == 19:
                    raise
                time.sleep(0.01)
    finally:
        temporary.unlink(missing_ok=True)


def log(directory, event, **values):
    with (directory / "events.jsonl").open("ab") as output:
        output.write((canonical({"time": now(), "event": event, **values}) + "\n").encode("utf-8"))
