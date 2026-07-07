from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from app.models.legislation import Article
from app.parsing.legislation_parser import (
    ParseError,
    ParseResult,
    SourceMetadata,
    parse_legislation_text,
)

FRONTMATTER = re.compile(r"^---\s*\n(?P<body>.*?)\n---\s*\n(?P<content>.*)$", re.DOTALL)


@dataclass(frozen=True)
class IngestSummary:
    kaynak_kodu: str
    article_count: int
    error_count: int
    output_path: Path


def parse_source_file(path: Path) -> ParseResult:
    raw = path.read_text(encoding="utf-8")
    metadata = metadata_from_path(path, raw)
    content = strip_frontmatter(raw)
    return parse_legislation_text(content, metadata)


def metadata_from_path(path: Path, raw: str) -> SourceMetadata:
    kaynak_kodu = path.stem.upper().replace(" ", "-")
    kaynak_adi = path.stem.replace("-", " ").replace("_", " ")
    yururluk_tarihi = date(2024, 1, 1)
    surum_etiketi = "2024-01"

    frontmatter = FRONTMATTER.match(raw)
    if frontmatter:
        for line in frontmatter.group("body").splitlines():
            key, _, value = line.partition(":")
            key = key.strip().lower()
            value = value.strip().strip('"')
            if key == "kaynak_kodu" and value:
                kaynak_kodu = value.upper()
            elif key == "kaynak_adi" and value:
                kaynak_adi = value
            elif key == "yururluk_tarihi" and value:
                yururluk_tarihi = date.fromisoformat(value)
            elif key == "surum_etiketi" and value:
                surum_etiketi = value

    return SourceMetadata(
        kaynak_kodu=kaynak_kodu,
        kaynak_adi=kaynak_adi,
        yururluk_tarihi=yururluk_tarihi,
        surum_etiketi=surum_etiketi,
    )


def strip_frontmatter(raw: str) -> str:
    match = FRONTMATTER.match(raw)
    if match:
        return match.group("content")
    return raw


def write_jsonl(path: Path, rows: list[Article] | list[ParseError]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            if isinstance(row, Article):
                handle.write(row.model_dump_json())
            else:
                handle.write(row.model_dump_json())
            handle.write("\n")


def ingest_directory(source_dir: Path, output_dir: Path) -> list[IngestSummary]:
    output_dir.mkdir(parents=True, exist_ok=True)
    summaries: list[IngestSummary] = []
    all_errors: list[ParseError] = []

    for path in sorted(source_dir.glob("*")):
        if path.suffix.lower() not in {".txt", ".md"}:
            continue
        if path.name.startswith("."):
            continue

        result = parse_source_file(path)
        out_path = output_dir / f"{path.stem.upper().replace(' ', '-')}.jsonl"
        write_jsonl(out_path, result.articles)
        all_errors.extend(result.errors)
        summaries.append(
            IngestSummary(
                kaynak_kodu=path.stem.upper(),
                article_count=len(result.articles),
                error_count=len(result.errors),
                output_path=out_path,
            )
        )

    if all_errors:
        write_jsonl(output_dir / "_errors.jsonl", all_errors)

    return summaries
