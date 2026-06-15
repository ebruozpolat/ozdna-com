#!/usr/bin/env python3
"""Generate OZDNA logo SVGs and PNG/ICO favicons."""

import runpy
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parent / "generate-logo.py"), run_name="__main__")
