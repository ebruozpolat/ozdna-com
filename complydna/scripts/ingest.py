#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from app.parsing.ingest_io import ingest_directory


def main() -> None:
    parser = argparse.ArgumentParser(description="ComplyDNA mevzuat ingest — madde/fıkra parser")
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("data/raw"),
        help="Ham mevzuat metinleri (.txt / .md)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/parsed"),
        help="JSONL çıktı dizini",
    )
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"kaynak dizin yok: {args.source}")

    summaries = ingest_directory(args.source, args.output)
    for summary in summaries:
        print(
            f"{summary.kaynak_kodu}: {summary.article_count} madde/fıkra → "
            f"{summary.output_path} ({summary.error_count} hata)"
        )


if __name__ == "__main__":
    main()
