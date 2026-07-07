from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient

from app.api.audit import audit_logger
from app.api.deps import _get_rate_limiter, get_answerer
from app.config import get_settings
from app.main import app
from app.services.answerer import LegislationAnswerer
from app.services.embedding_backends import HashEmbedder
from app.services.indexer.core import LegislationIndexer, load_articles_from_jsonl
from app.services.llm_stub import DevStubLLM
from app.services.retriever import COLLECTION_NAME, LegislationRetriever

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_JSONL = FIXTURES / "teblig_masak_sample.expected.jsonl"
API_KEY = "complydna_sk_test_local"


@pytest.fixture(autouse=True)
def reset_app_state() -> None:
    audit_logger.clear()
    _get_rate_limiter.cache_clear()
    get_settings.cache_clear()
    app.dependency_overrides.clear()
    yield
    audit_logger.clear()
    app.dependency_overrides.clear()


@pytest.fixture
def mock_answerer() -> LegislationAnswerer:
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
    retriever = LegislationRetriever(client, embedder, collection_name=COLLECTION_NAME)
    return LegislationAnswerer(retriever, DevStubLLM(), model_version="test-v1")


@pytest.fixture
def client(mock_answerer: LegislationAnswerer) -> TestClient:
    app.dependency_overrides[get_answerer] = lambda: mock_answerer
    return TestClient(app)


def test_ask_without_api_key_returns_401(client: TestClient) -> None:
    response = client.post("/v1/ask", json={"question": "şüpheli işlem bildirim süresi nedir?"})

    assert response.status_code == 401


def test_ask_with_invalid_api_key_returns_401(client: TestClient) -> None:
    response = client.post(
        "/v1/ask",
        json={"question": "şüpheli işlem bildirim süresi nedir?"},
        headers={"X-API-Key": "invalid"},
    )

    assert response.status_code == 401


def test_ask_returns_cited_answer(client: TestClient) -> None:
    response = client.post(
        "/v1/ask",
        json={"question": "şüpheli işlem bildirim süresi nedir?"},
        headers={"X-API-Key": API_KEY},
    )

    assert response.status_code == 200
    body = response.json()
    assert "[" in body["answer"] and "Madde" in body["answer"]
    assert body["citations"]
    assert body["sources"]
    assert body["model_version"]
    assert body["index_version"] == "v1"


def test_ask_audit_log_stores_hashes_not_plaintext(client: TestClient) -> None:
    question = "şüpheli işlem bildirim süresi nedir?"
    response = client.post(
        "/v1/ask",
        json={"question": question},
        headers={"X-API-Key": API_KEY},
    )

    assert response.status_code == 200
    answer = response.json()["answer"]
    assert len(audit_logger.entries) == 1

    entry = audit_logger.entries[0]
    assert entry.question_hash
    assert entry.answer_hash
    assert question not in entry.question_hash
    assert answer not in entry.answer_hash
    assert entry.model_version
    assert entry.index_version == "v1"


def test_ask_rate_limit_returns_429(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "2")
    get_settings.cache_clear()
    _get_rate_limiter.cache_clear()

    payload = {"question": "şüpheli işlem bildirim süresi nedir?"}
    headers = {"X-API-Key": API_KEY}

    assert client.post("/v1/ask", json=payload, headers=headers).status_code == 200
    assert client.post("/v1/ask", json=payload, headers=headers).status_code == 200
    assert client.post("/v1/ask", json=payload, headers=headers).status_code == 429


def test_ask_respects_kaynak_filter(client: TestClient) -> None:
    response = client.post(
        "/v1/ask",
        json={
            "question": "şüpheli işlem bildirimi",
            "filters": {"kaynak_kodu": "TEBLIG-MASAK-SAMPLE"},
        },
        headers={"X-API-Key": API_KEY},
    )

    assert response.status_code == 200
    assert all(
        source["kaynak_kodu"] == "TEBLIG-MASAK-SAMPLE" for source in response.json()["sources"]
    )
