from __future__ import annotations

from pathlib import Path

import pytest
from qdrant_client import QdrantClient

from app.models.legislation import Article
from app.services.embedding_backends import BgeM3Embedder, HashEmbedder
from app.services.indexer.core import (
    LegislationIndexer,
    index_directory,
    load_articles_from_jsonl,
)
from app.services.retriever import COLLECTION_NAME

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_JSONL = FIXTURES / "teblig_masak_sample.expected.jsonl"


@pytest.fixture
def sample_articles() -> list[Article]:
    return load_articles_from_jsonl(SAMPLE_JSONL)


@pytest.fixture
def memory_indexer() -> LegislationIndexer:
    client = QdrantClient(":memory:")
    embedder = HashEmbedder(vector_size=256)
    return LegislationIndexer(
        client,
        embedder,
        collection_name=COLLECTION_NAME,
        index_version="test",
    )


def test_upsert_is_idempotent(
    memory_indexer: LegislationIndexer,
    sample_articles: list[Article],
) -> None:
    first = memory_indexer.upsert_articles(sample_articles)
    second = memory_indexer.upsert_articles(sample_articles)
    assert first == len(sample_articles)
    assert second == len(sample_articles)
    count = memory_indexer.client.count(collection_name=COLLECTION_NAME, exact=True).count
    assert count == len(sample_articles)


def test_search_suspicious_transaction_notification_period(
    memory_indexer: LegislationIndexer,
    sample_articles: list[Article],
) -> None:
    memory_indexer.upsert_articles(sample_articles)
    hits = memory_indexer.search("şüpheli işlem bildirim süresi", top_k=5)

    assert len(hits) == 5
    top_madde_numbers = {hit.article.madde_no for hit in hits}
    assert 4 in top_madde_numbers
    assert any("Bildirim süresi" in hit.article.metin for hit in hits[:3])


def test_mulga_excluded_by_default(
    memory_indexer: LegislationIndexer,
    sample_articles: list[Article],
) -> None:
    memory_indexer.upsert_articles(sample_articles)
    hits = memory_indexer.search("mülga madde", top_k=5, exclude_mulga=True)
    assert all(hit.article.yururluk_durumu.value != "mülga" for hit in hits)


def test_index_directory(memory_indexer: LegislationIndexer, tmp_path: Path) -> None:
    parsed = tmp_path / "parsed"
    parsed.mkdir()
    target = parsed / "TEBLIG-MASAK-SAMPLE.jsonl"
    target.write_text(SAMPLE_JSONL.read_text(encoding="utf-8"), encoding="utf-8")

    summaries = index_directory(parsed, memory_indexer)
    assert len(summaries) == 1
    assert summaries[0].upserted == 6


@pytest.mark.integration
def test_bge_m3_search_integration(sample_articles: list[Article]) -> None:
    try:
        client = QdrantClient(url="http://localhost:6333", timeout=2.0)
        client.get_collections()
    except Exception as exc:
        pytest.skip(f"Qdrant not reachable: {exc}")

    embedder = BgeM3Embedder()
    indexer = LegislationIndexer(
        client,
        embedder,
        collection_name="mevzuat_test",
        index_version="test",
    )
    indexer.upsert_articles(sample_articles)

    hits = indexer.search("şüpheli işlem bildirim süresi", top_k=5)
    assert any(hit.article.madde_no == 4 for hit in hits)

    indexer.client.delete_collection("mevzuat_test")
