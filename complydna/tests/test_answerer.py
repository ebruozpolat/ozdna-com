from __future__ import annotations

from pathlib import Path

import pytest
from qdrant_client import QdrantClient

from app.services.answerer import (
    AnswerValidationError,
    CitationKey,
    LegislationAnswerer,
    validate_cited_answer,
)
from app.services.embedding_backends import HashEmbedder
from app.services.indexer.core import LegislationIndexer, load_articles_from_jsonl
from app.services.retriever import COLLECTION_NAME, LegislationRetriever, ScoredChunk

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_JSONL = FIXTURES / "teblig_masak_sample.expected.jsonl"


class MockLLM:
    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        self.calls: list[tuple[str, str]] = []

    def complete(self, *, system: str, user: str) -> str:
        self.calls.append((system, user))
        if not self.responses:
            msg = "no mock responses left"
            raise RuntimeError(msg)
        return self.responses.pop(0)


@pytest.fixture
def sample_chunks() -> list[ScoredChunk]:
    articles = load_articles_from_jsonl(SAMPLE_JSONL)
    selected = [articles[2], articles[3]]
    return [
        ScoredChunk(chunk_id=article.chunk_id(), score=1.0 - index * 0.1, article=article)
        for index, article in enumerate(selected)
    ]


@pytest.fixture
def allowed_keys(sample_chunks: list[ScoredChunk]) -> set[CitationKey]:
    keys: set[CitationKey] = set()
    for chunk in sample_chunks:
        article = chunk.article
        keys.add(
            CitationKey(
                kaynak_kodu=article.kaynak_kodu,
                madde_no=article.madde_no,
                madde_turu=article.madde_turu,
                fikra_no=article.fikra_no,
            )
        )
    return keys


def test_post_check_rejects_uncited_sentence(allowed_keys: set[CitationKey]) -> None:
    bad_answer = "Yükümlüler bildirim yapmalıdır."

    with pytest.raises(AnswerValidationError, match="sentence without citation"):
        validate_cited_answer(bad_answer, allowed_keys)


def test_post_check_rejects_unknown_citation(allowed_keys: set[CitationKey]) -> None:
    bad_answer = "Bu madde geçerlidir [LAW-9999 / Madde 1]."

    with pytest.raises(AnswerValidationError, match="unknown citation"):
        validate_cited_answer(bad_answer, allowed_keys)


def test_post_check_accepts_valid_citations(allowed_keys: set[CitationKey]) -> None:
    good_answer = (
        "Yükümlüler şüpheli işlemleri derhal bildirir "
        "[TEBLIG-MASAK-SAMPLE / Madde 4 f.1]. "
        "Bildirim süresi on günü geçemez [TEBLIG-MASAK-SAMPLE / Madde 4 f.2]."
    )

    validate_cited_answer(good_answer, allowed_keys)


def test_post_check_accepts_fallback_only() -> None:
    validate_cited_answer("Mevzuatta açık hüküm bulamadım.", set())


@pytest.fixture
def indexed_retriever() -> LegislationRetriever:
    client = QdrantClient(":memory:")
    embedder = HashEmbedder(vector_size=256)
    articles = load_articles_from_jsonl(SAMPLE_JSONL)
    indexer = LegislationIndexer(
        client,
        embedder,
        collection_name=COLLECTION_NAME,
        index_version="test",
    )
    indexer.upsert_articles(articles)
    return LegislationRetriever(client, embedder, collection_name=COLLECTION_NAME)


def test_answerer_retries_after_uncited_mock_response(
    indexed_retriever: LegislationRetriever,
) -> None:
    bad = "Yükümlüler bildirim yapmalıdır."
    good = (
        "Yükümlüler şüpheli işlemleri derhal bildirir "
        "[TEBLIG-MASAK-SAMPLE / Madde 4 f.1]."
    )
    llm = MockLLM([bad, good])
    answerer = LegislationAnswerer(indexed_retriever, llm)

    response = answerer.ask("şüpheli işlem bildirimi")

    assert response.answer_text == good
    assert len(llm.calls) == 2
    assert len(response.citations) == 1
    assert response.citations[0].madde_no == 4
    assert response.retrieval_snapshot


def test_answerer_falls_back_after_two_invalid_responses(
    indexed_retriever: LegislationRetriever,
) -> None:
    bad = "Yükümlüler bildirim yapmalıdır."
    llm = MockLLM([bad, bad])
    answerer = LegislationAnswerer(indexed_retriever, llm)

    response = answerer.ask("şüpheli işlem bildirimi")

    assert response.answer_text == "Mevzuatta açık hüküm bulamadım."
    assert response.citations == []
    assert len(llm.calls) == 2
