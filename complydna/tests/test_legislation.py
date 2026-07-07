from datetime import date

import pytest
from pydantic import ValidationError

from app.models.legislation import Article, CharacterRange, Chunk, YuurlulukDurumu


def test_article_citation_without_fikra() -> None:
    article = Article(
        kaynak_kodu="law-5549",
        kaynak_adi="5549 Sayılı Kanun",
        madde_no=4,
        metin="Şüpheli işlemlerin bildirimi.",
        yururluk_tarihi=date(2006, 10, 11),
        surum_etiketi="2006-10",
    )
    assert article.kaynak_kodu == "LAW-5549"
    assert article.citation() == "[LAW-5549 / Madde 4]"


def test_article_citation_with_fikra() -> None:
    article = Article(
        kaynak_kodu="LAW-5549",
        kaynak_adi="5549 Sayılı Kanun",
        madde_no=4,
        fikra_no=2,
        metin="Bildirim süresi on gündür.",
        yururluk_tarihi=date(2006, 10, 11),
        surum_etiketi="2006-10",
    )
    assert article.citation() == "[LAW-5549 / Madde 4 f.2]"


def test_article_chunk_id() -> None:
    article = Article(
        kaynak_kodu="LAW-5549",
        kaynak_adi="5549 Sayılı Kanun",
        madde_no=4,
        fikra_no=2,
        metin="Bildirim süresi on gündür.",
        yururluk_tarihi=date(2006, 10, 11),
        surum_etiketi="2006-10",
    )
    assert article.chunk_id() == "LAW-5549:m4:f2@2006-10"


def test_article_rejects_empty_metin() -> None:
    with pytest.raises(ValidationError):
        Article(
            kaynak_kodu="LAW-5549",
            kaynak_adi="5549 Sayılı Kanun",
            madde_no=1,
            metin="",
            yururluk_tarihi=date(2006, 10, 11),
            surum_etiketi="2006-10",
        )


def test_chunk_exposes_article_citation() -> None:
    article = Article(
        kaynak_kodu="TEBLIG-MASAK",
        kaynak_adi="Tedbirler Yönetmeliği",
        madde_no=28,
        metin="Bildirim yükümlülüğü.",
        yururluk_durumu=YuurlulukDurumu.AKTIF,
        yururluk_tarihi=date(2024, 1, 1),
        surum_etiketi="2024-01",
    )
    chunk = Chunk(
        chunk_id="TEBLIG-MASAK-m28-c0",
        article=article,
        metin_parcasi=article.metin,
        karakter_araligi=CharacterRange(start=0, end=len(article.metin)),
    )
    assert chunk.citation == "[TEBLIG-MASAK / Madde 28]"


def test_character_range_rejects_invalid_bounds() -> None:
    with pytest.raises(ValidationError):
        CharacterRange(start=10, end=5)
