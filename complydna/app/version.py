from __future__ import annotations

import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@lru_cache
def resolve_git_sha() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        return result.stdout.strip() or "unknown"
    except (OSError, subprocess.CalledProcessError):
        return "unknown"
