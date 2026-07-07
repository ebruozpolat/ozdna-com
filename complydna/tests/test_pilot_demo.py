from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from qdrant_client import QdrantClient

from app.api.deps import get_answerer
from app.main import app
from app.services.answerer import LegislationAnswerer
from app.services.embedding_backends import HashEmbedder
from app.services.indexer.core import LegislationIndexer, load_articles_from_jsonl
from app.services.llm_stub import DevStubLLM
from app.services.retriever import COLLECTION_NAME, LegislationRetriever
from evals.runner import load_golden_set, run_evaluation

ROOT = Path(__file__).resolve().parents[1]
PILOT_SET = ROOT / "evals" / "pilot_set.jsonl"
API_KEY = "complydna_sk_test_local"


@pytest.fixture
def mock_answerer() -> LegislationAnswerer:
    client = QdrantClient(":memory:")
    embedder = HashEmbedder(vector_size=256)
    indexer = LegislationIndexer(
        client,
        embedder,
        collection_name=COLLECTION_NAME,
        index_version="test",
    )
    articles = []
    parsed_dir = ROOT / "data" / "parsed"
    for path in sorted(parsed_dir.glob("*.jsonl")):
        if path.name.startswith("_"):
            continue
        articles.extend(load_articles_from_jsonl(path))
    indexer.upsert_articles(articles)
    retriever = LegislationRetriever(client, embedder, collection_name=COLLECTION_NAME)
    return LegislationAnswerer(retriever, DevStubLLM(), model_version="test-v1")


def test_pilot_set_has_eight_cases() -> None:
    cases = load_golden_set(PILOT_SET)
    assert len(cases) == 8
    notes = " ".join(case.notes or "" for case in cases)
    assert "5549" in notes
    assert "6415" in notes


def test_pilot_set_offline_eval_retrieval(mock_answerer: LegislationAnswerer) -> None:
    cases = load_golden_set(PILOT_SET)
    report = run_evaluation(
        cases,
        mock_answerer,
        git_sha="test",
        model_version="test-v1",
        index_version="v1",
    )
    assert report.aggregate.cases == 8
    assert report.aggregate.retrieval_hit_at_5 >= 0.875


def test_pilot_question_via_api(mock_answerer: LegislationAnswerer) -> None:
    app.dependency_overrides[get_answerer] = lambda: mock_answerer
    try:
        client = TestClient(app)
        response = client.post(
            "/v1/ask",
            json={"question": "5549 sayılı kanunda şüpheli işlem bildirimi kime yapılır?"},
            headers={"X-API-Key": API_KEY},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["sources"]
        assert body["answer"]
    finally:
        app.dependency_overrides.clear()


def test_load_pilot_questions_from_jsonl() -> None:
    lines = [
        json.loads(line)
        for line in PILOT_SET.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(lines) == 8
    assert all("question" in line for line in lines)
