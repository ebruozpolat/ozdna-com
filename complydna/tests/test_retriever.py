from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
from qdrant_client import QdrantClient

from app.models.legislation import Article, YuurlulukDurumu
from app.services.embedding_backends import HashEmbedder
from app.services.indexer.core import LegislationIndexer, load_articles_from_jsonl
from app.services.retriever import COLLECTION_NAME, LegislationRetriever, RetrievalFilters

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_JSONL = FIXTURES / "teblig_masak_sample.expected.jsonl"


@pytest.fixture
def sample_articles() -> list[Article]:
    return load_articles_from_jsonl(SAMPLE_JSONL)


@pytest.fixture
def memory_client() -> QdrantClient:
    return QdrantClient(":memory:")


@pytest.fixture
def embedder() -> HashEmbedder:
    return HashEmbedder(vector_size=256)


@pytest.fixture
def indexed_retriever(
    memory_client: QdrantClient,
    embedder: HashEmbedder,
    sample_articles: list[Article],
) -> LegislationRetriever:
    indexer = LegislationIndexer(
        memory_client,
        embedder,
        collection_name=COLLECTION_NAME,
        index_version="test",
    )
    indexer.upsert_articles(sample_articles)
    return LegislationRetriever(memory_client, embedder, collection_name=COLLECTION_NAME)


def test_search_returns_scored_chunks(indexed_retriever: LegislationRetriever) -> None:
    hits = indexed_retriever.search("şüpheli işlem bildirim süresi", top_k=5)

    assert len(hits) == 5
    assert all(hit.score >= 0 for hit in hits)
    assert all(hit.chunk_id for hit in hits)
    assert hits[0].citation.startswith("[TEBLIG-MASAK-SAMPLE /")


def test_search_suspicious_transaction_english_query(
    indexed_retriever: LegislationRetriever,
) -> None:
    hits = indexed_retriever.search("suspicious transaction notification period", top_k=5)

    assert len(hits) == 5
    assert any(hit.article.madde_no == 4 for hit in hits)


def test_mulga_excluded_by_default(indexed_retriever: LegislationRetriever) -> None:
    hits = indexed_retriever.search("mülga madde", top_k=8)

    assert hits
    assert all(hit.article.yururluk_durumu != YuurlulukDurumu.MULGA for hit in hits)


def test_include_mulga_filter(indexed_retriever: LegislationRetriever) -> None:
    hits = indexed_retriever.search(
        "mülga madde",
        top_k=8,
        filters=RetrievalFilters(yururluk_durumu=YuurlulukDurumu.MULGA),
    )

    assert len(hits) == 1
    assert hits[0].article.madde_no == 28
    assert hits[0].article.yururluk_durumu == YuurlulukDurumu.MULGA


def test_kaynak_kodu_filter(
    memory_client: QdrantClient,
    embedder: HashEmbedder,
) -> None:
    articles = [
        Article(
            kaynak_kodu="LAW-5549",
            kaynak_adi="5549 Kanunu",
            madde_no=1,
            fikra_no=1,
            metin="Şüpheli işlem bildirimi zorunludur.",
            yururluk_tarihi=date(2020, 1, 1),
            surum_etiketi="2020-01",
        ),
        Article(
            kaynak_kodu="LAW-KVKK",
            kaynak_adi="KVKK",
            madde_no=5,
            fikra_no=1,
            metin="Kişisel verilerin işlenmesi şartları.",
            yururluk_tarihi=date(2018, 4, 7),
            surum_etiketi="2018-04",
        ),
    ]
    indexer = LegislationIndexer(
        memory_client,
        embedder,
        collection_name=COLLECTION_NAME,
        index_version="test",
    )
    indexer.upsert_articles(articles)
    retriever = LegislationRetriever(memory_client, embedder, collection_name=COLLECTION_NAME)

    hits = retriever.search(
        "şüpheli işlem bildirimi",
        top_k=5,
        filters=RetrievalFilters(kaynak_kodu="LAW-5549"),
    )

    assert hits
    assert all(hit.article.kaynak_kodu == "LAW-5549" for hit in hits)


def test_effective_date_filter(
    memory_client: QdrantClient,
    embedder: HashEmbedder,
) -> None:
    articles = [
        Article(
            kaynak_kodu="LAW-5549",
            kaynak_adi="5549 Kanunu",
            madde_no=1,
            fikra_no=1,
            metin="Eski hüküm metni.",
            yururluk_tarihi=date(2010, 1, 1),
            surum_etiketi="2010-01",
        ),
        Article(
            kaynak_kodu="LAW-5549",
            kaynak_adi="5549 Kanunu",
            madde_no=2,
            fikra_no=1,
            metin="Yeni hüküm metni.",
            yururluk_tarihi=date(2024, 6, 1),
            surum_etiketi="2024-06",
        ),
    ]
    indexer = LegislationIndexer(
        memory_client,
        embedder,
        collection_name=COLLECTION_NAME,
        index_version="test",
    )
    indexer.upsert_articles(articles)
    retriever = LegislationRetriever(memory_client, embedder, collection_name=COLLECTION_NAME)

    hits = retriever.search(
        "hüküm metni",
        top_k=5,
        filters=RetrievalFilters(effective_date=date(2020, 1, 1)),
    )

    assert hits
    assert all(hit.article.yururluk_tarihi <= date(2020, 1, 1) for hit in hits)
    assert all(hit.article.madde_no == 1 for hit in hits)


def test_empty_query_returns_no_results(indexed_retriever: LegislationRetriever) -> None:
    assert indexed_retriever.search("   ") == []
