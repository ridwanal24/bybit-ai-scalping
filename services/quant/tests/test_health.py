import json
import subprocess
import sys

from bybit_quant import __version__


def test_health_cli_is_valid_json_and_matches_package():
    result = subprocess.run(
        [sys.executable, "-m", "bybit_quant", "health"], capture_output=True, text=True, check=True
    )
    payload = json.loads(result.stdout)
    assert payload == {
        "status": "ok",
        "service": "quant",
        "version": __version__,
        "python": ".".join(map(str, sys.version_info[:3])),
    }
    assert result.stderr == ""


def test_invalid_command_fails_without_health_payload():
    result = subprocess.run(
        [sys.executable, "-m", "bybit_quant", "trade"], check=False, capture_output=True, text=True
    )
    assert result.returncode == 2
    assert result.stdout == ""
    assert "invalid choice" in result.stderr
