from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Literal

from pydantic import BaseModel

from app.models.legislation import Article, YuurlulukDurumu

MaddeTuru = Literal["madde", "gecici_madde"]

ARTICLE_HEADER = re.compile(
    r"^(?P<gecici>GEÇİCİ\s+)?MADDE\s+(?P<no>\d+)\s*[-–—:.\)]?\s*(?P<suffix>.*)?$",
    re.IGNORECASE | re.MULTILINE,
)
FIKRA_PATTERN = re.compile(r"^\s*\((?P<no>\d+)\)\s+", re.MULTILINE)
MULGA_IN_HEADER = re.compile(r"\(?\s*mülga\s*:", re.IGNORECASE)
MULGA_IN_BODY = re.compile(r"^\s*\(?\s*mülga\b", re.IGNORECASE | re.MULTILINE)


@dataclass(frozen=True)
class SourceMetadata:
    kaynak_kodu: str
    kaynak_adi: str
    yururluk_tarihi: date
    surum_etiketi: str


class ParseError(BaseModel):
    kaynak_kodu: str
    satir: int | None
    blok: str
    neden: str


@dataclass(frozen=True)
class ParseResult:
    articles: list[Article]
    errors: list[ParseError]


def parse_legislation_text(
    text: str,
    metadata: SourceMetadata,
) -> ParseResult:
    normalized = text.replace("\r\n", "\n").strip()
    if not normalized:
        return ParseResult(
            articles=[],
            errors=[
                ParseError(
                    kaynak_kodu=metadata.kaynak_kodu,
                    satir=None,
                    blok="",
                    neden="boş dosya",
                )
            ],
        )

    articles: list[Article] = []
    errors: list[ParseError] = []

    matches = list(ARTICLE_HEADER.finditer(normalized))
    if not matches:
        errors.append(
            ParseError(
                kaynak_kodu=metadata.kaynak_kodu,
                satir=1,
                blok=normalized[:200],
                neden="hiç madde başlığı bulunamadı (MADDE N deseni)",
            )
        )
        return ParseResult(articles=articles, errors=errors)

    preamble = normalized[: matches[0].start()].strip()
    if preamble and not _is_document_title_only(preamble):
        errors.append(
            ParseError(
                kaynak_kodu=metadata.kaynak_kodu,
                satir=_line_number(normalized, 0),
                blok=preamble[:200],
                neden="madde başlığı öncesi parse edilemeyen metin",
            )
        )

    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(normalized)
        block = normalized[start:end].strip()
        line_no = _line_number(normalized, start)

        gecici = bool(match.group("gecici"))
        madde_no = int(match.group("no"))
        suffix = (match.group("suffix") or "").strip()
        madde_turu: MaddeTuru = "gecici_madde" if gecici else "madde"

        lines = block.split("\n", 1)
        body = lines[1].strip() if len(lines) > 1 else ""

        yururluk_durumu = YuurlulukDurumu.AKTIF
        if MULGA_IN_HEADER.search(suffix) or MULGA_IN_BODY.search(body):
            yururluk_durumu = YuurlulukDurumu.MULGA

        fikra_matches = list(FIKRA_PATTERN.finditer(body))
        if fikra_matches:
            for fikra_index, fikra_match in enumerate(fikra_matches):
                fikra_start = fikra_match.end()
                fikra_end = (
                    fikra_matches[fikra_index + 1].start()
                    if fikra_index + 1 < len(fikra_matches)
                    else len(body)
                )
                fikra_text = body[fikra_start:fikra_end].strip()
                if not fikra_text:
                    errors.append(
                        ParseError(
                            kaynak_kodu=metadata.kaynak_kodu,
                            satir=line_no,
                            blok=block[:200],
                            neden=f"MADDE {madde_no} fıkra ({fikra_match.group('no')}) boş",
                        )
                    )
                    continue
                articles.append(
                    _build_article(
                        metadata=metadata,
                        madde_no=madde_no,
                        madde_turu=madde_turu,
                        fikra_no=int(fikra_match.group("no")),
                        metin=fikra_text,
                        yururluk_durumu=yururluk_durumu,
                    )
                )
        elif body:
            articles.append(
                _build_article(
                    metadata=metadata,
                    madde_no=madde_no,
                    madde_turu=madde_turu,
                    fikra_no=None,
                    metin=body,
                    yururluk_durumu=yururluk_durumu,
                )
            )
        else:
            errors.append(
                ParseError(
                    kaynak_kodu=metadata.kaynak_kodu,
                    satir=line_no,
                    blok=block[:200],
                    neden=f"MADDE {madde_no} gövdesi boş",
                )
            )

    return ParseResult(articles=articles, errors=errors)


def _build_article(
    *,
    metadata: SourceMetadata,
    madde_no: int,
    madde_turu: MaddeTuru,
    fikra_no: int | None,
    metin: str,
    yururluk_durumu: YuurlulukDurumu,
) -> Article:
    return Article(
        kaynak_kodu=metadata.kaynak_kodu,
        kaynak_adi=metadata.kaynak_adi,
        madde_no=madde_no,
        madde_turu=madde_turu,
        fikra_no=fikra_no,
        metin=metin,
        yururluk_durumu=yururluk_durumu,
        yururluk_tarihi=metadata.yururluk_tarihi,
        surum_etiketi=metadata.surum_etiketi,
    )


def _is_document_title_only(preamble: str) -> bool:
    lines = [line.strip() for line in preamble.splitlines() if line.strip()]
    return len(lines) <= 2 and all(not line.upper().startswith("MADDE") for line in lines)


def _line_number(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1
