"""Shared atomic writer for generated JSON snapshots."""

import json
import os
import tempfile
from pathlib import Path


def write_json_atomically(path: Path, payload: object) -> None:
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent,
            prefix=f".{path.name}.", delete=False
        ) as destination:
            temporary = Path(destination.name)
            destination.write(json.dumps(payload, separators=(",", ":"), allow_nan=False) + "\n")
            destination.flush()
            os.fsync(destination.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
