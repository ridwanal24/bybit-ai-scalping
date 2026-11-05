"""Download pinned project-local Windows tools; never modify global runtimes."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import time
import urllib.error
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / ".tools"
MANIFEST = ROOT / "toolchain.json"


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=90) as response:
        return response.read()


def download(url: str, target: Path) -> str:
    """Resume interrupted HTTPS transfers without accepting ignored Range headers."""
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        partial = target.with_suffix(target.suffix + ".partial")
        for attempt in range(100):
            offset = partial.stat().st_size if partial.exists() else 0
            request = urllib.request.Request(
                url, headers={"Range": f"bytes={offset}-", "User-Agent": "bybit-foundation"}
            )
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    if offset and response.status != 206:
                        raise RuntimeError("Server ignored resume Range; refusing corrupt archive")
                    if response.status == 206:
                        content_range = response.headers.get("Content-Range", "")
                        if not content_range.startswith(f"bytes {offset}-"):
                            raise RuntimeError("Unexpected download range")
                    with partial.open("ab") as output:
                        shutil.copyfileobj(response, output, length=1024 * 1024)
                    # Content-Length may describe only a partial range.
                    if response.status == 206:
                        expected = int(response.headers["Content-Range"].split("/")[1])
                    else:
                        expected = int(response.headers.get("Content-Length", partial.stat().st_size))
                    if partial.stat().st_size != expected:
                        continue
                partial.replace(target)
                break
            except (OSError, urllib.error.URLError) as error:
                if attempt == 99:
                    raise RuntimeError(f"Download failed: {url}") from error
                time.sleep(1)
        else:
            raise RuntimeError(f"Incomplete download: {url}")
    with target.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def install_zip(archive: Path, destination: Path, prefix: str = "") -> None:
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            if not member.filename.startswith(prefix) or member.is_dir():
                continue
            relative = member.filename[len(prefix):]
            # PostgreSQL includes large optional tools; only server runtime required.
            if destination.name == "postgres" and not relative.startswith(("bin/", "lib/", "share/")):
                continue
            target = (destination / relative).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise RuntimeError("Unsafe archive path")
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open(member) as input_file, target.open("wb") as output:
                shutil.copyfileobj(input_file, output)


def main() -> None:
    if sys.platform != "win32" or os.environ.get("PROCESSOR_ARCHITECTURE", "").lower() != "amd64":
        raise SystemExit("Portable bootstrap currently supports Windows x64 only")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    node_file = f"node-v{manifest['node']}-win-x64.zip"
    uv_file = "uv-x86_64-pc-windows-msvc.zip"
    pg_file = f"postgresql-{manifest['postgres']}-windows-x64-binaries.zip"
    artifacts = [
        ("node", f"https://nodejs.org/dist/v{manifest['node']}/{node_file}", node_file, f"node-v{manifest['node']}-win-x64/", "node.exe"),
        ("uv", f"https://github.com/astral-sh/uv/releases/download/{manifest['uv']}/{uv_file}", uv_file, "", "uv.exe"),
        ("postgres", f"https://get.enterprisedb.com/postgresql/{pg_file}", pg_file, "pgsql/", "bin/postgres.exe"),
    ]
    provenance = {}
    for name, url, filename, prefix, executable in artifacts:
        destination = TOOLS / name
        if (destination / executable).exists():
            print(f"{name}: already present", flush=True)
            continue
        print(f"Downloading {name}: {url}", flush=True)
        archive = TOOLS / "downloads" / filename
        digest = download(url, archive)
        pinned = manifest["checksums"].get(name)
        if pinned and pinned != digest:
            raise RuntimeError(f"Pinned checksum mismatch: {name}")
        verification = "pinned-sha256" if pinned else "https-computed-only"
        if name == "node":
            sums = fetch(f"https://nodejs.org/dist/v{manifest['node']}/SHASUMS256.txt").decode()
            expected = next(line.split()[0] for line in sums.splitlines() if line.split()[-1] == filename)
            if digest != expected:
                raise RuntimeError("Node upstream checksum mismatch")
            verification = "upstream-sha256"
        if name == "uv":
            expected = fetch(url + ".sha256").decode().split()[0]
            if digest != expected:
                raise RuntimeError("uv upstream checksum mismatch")
            verification = "upstream-sha256"
        install_zip(archive, destination, prefix)
        provenance[name] = {"url": url, "sha256": digest, "verification": verification}
        print(f"Installed {name}; SHA256 {digest}", flush=True)
    provenance_path = TOOLS / "provenance.json"
    previous = json.loads(provenance_path.read_text()) if provenance_path.exists() else {}
    previous.update(provenance)
    provenance_path.write_text(json.dumps(previous, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
