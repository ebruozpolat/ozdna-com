from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from app.models.legislation import Article
from app.parsing.ingest_io import ingest_directory, parse_source_file
from app.parsing.legislation_parser import SourceMetadata, parse_legislation_text

FIXTURES = Path(__file__).parent / "fixtures"


def _load_expected(path: Path) -> list[Article]:
    articles: list[Article] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            articles.append(Article.model_validate_json(line))
    return articles


def test_golden_parse_teblig_sample() -> None:
    raw = (FIXTURES / "teblig_masak_sample.txt").read_text(encoding="utf-8")
    metadata = SourceMetadata(
        kaynak_kodu="TEBLIG-MASAK-SAMPLE",
        kaynak_adi="teblig masak sample",
        yururluk_tarihi=date(2024, 1, 1),
        surum_etiketi="2024-01",
    )
    result = parse_legislation_text(raw, metadata)
    expected = _load_expected(FIXTURES / "teblig_masak_sample.expected.jsonl")

    assert result.errors == []
    assert result.articles == expected


def test_gecici_madde_citation() -> None:
    article = _load_expected(FIXTURES / "teblig_masak_sample.expected.jsonl")[4]
    assert article.citation() == "[TEBLIG-MASAK-SAMPLE / Geçici Madde 1 f.1]"


def test_mulga_madde_status() -> None:
    article = _load_expected(FIXTURES / "teblig_masak_sample.expected.jsonl")[5]
    assert article.yururluk_durumu.value == "mülga"


def test_ingest_writes_jsonl_and_errors(tmp_path: Path) -> None:
    source = tmp_path / "raw"
    output = tmp_path / "parsed"
    source.mkdir()
    output.mkdir()

    sample = FIXTURES / "teblig_masak_sample.txt"
    target = source / "TEBLIG-MASAK-SAMPLE.txt"
    target.write_text(sample.read_text(encoding="utf-8"), encoding="utf-8")

    summaries = ingest_directory(source, output)
    assert len(summaries) == 1
    assert summaries[0].article_count == 6
    assert summaries[0].error_count == 0

    jsonl_path = output / "TEBLIG-MASAK-SAMPLE.jsonl"
    assert jsonl_path.exists()
    assert not (output / "_errors.jsonl").exists()

    lines = jsonl_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 6
    assert all(Article.model_validate_json(line) for line in lines)


def test_unstructured_text_records_error(tmp_path: Path) -> None:
    source = tmp_path / "raw"
    output = tmp_path / "parsed"
    source.mkdir()
    (source / "broken.txt").write_text(
        "Serbest metin — madde başlığı yok.\n",
        encoding="utf-8",
    )
    summaries = ingest_directory(source, output)
    assert summaries[0].article_count == 0
    assert summaries[0].error_count == 1
    errors_path = output / "_errors.jsonl"
    assert errors_path.exists()
    payload = json.loads(errors_path.read_text(encoding="utf-8").strip())
    assert payload["neden"] == "hiç madde başlığı bulunamadı (MADDE N deseni)"


def test_parse_source_file_uses_frontmatter(tmp_path: Path) -> None:
    path = tmp_path / "law-5549.md"
    path.write_text(
        """---
kaynak_kodu: LAW-5549
kaynak_adi: 5549 Sayılı Kanun
yururluk_tarihi: 2006-10-11
surum_etiketi: 2006-10
---

MADDE 4 – Bildirim
(1) Şüpheli işlemler derhal bildirilir.
""",
        encoding="utf-8",
    )
    result = parse_source_file(path)
    assert len(result.articles) == 1
    assert result.articles[0].kaynak_kodu == "LAW-5549"
    assert result.articles[0].madde_no == 4
