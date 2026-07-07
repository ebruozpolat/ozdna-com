from __future__ import annotations

import argparse
from pathlib import Path

from app.config import get_settings
from app.services.indexer.core import build_indexer, index_directory


def main() -> None:
    parser = argparse.ArgumentParser(description="ComplyDNA — parsed JSONL → Qdrant (bge-m3)")
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("data/parsed"),
        help="Parsed JSONL directory",
    )
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"kaynak dizin yok: {args.source}")

    settings = get_settings()
    indexer = build_indexer(settings)
    summaries = index_directory(args.source, indexer)

    total = 0
    for summary in summaries:
        total += summary.upserted
        print(
            f"{summary.source_file}: {summary.upserted} chunk upsert → "
            f"{settings.qdrant_collection}"
        )

    print(
        f"toplam {total} chunk · collection={settings.qdrant_collection} · "
        f"index={settings.index_version}"
    )


if __name__ == "__main__":
    main()
