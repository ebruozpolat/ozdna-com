from __future__ import annotations

import json
from pathlib import Path

import pytest
from qdrant_client import QdrantClient

from app.services.answerer import CitationKey, LegislationAnswerer
from app.services.embedding_backends import HashEmbedder
from app.services.indexer.core import LegislationIndexer, load_articles_from_jsonl
from app.services.llm_stub import DevStubLLM
from app.services.retriever import COLLECTION_NAME, LegislationRetriever
from evals.metrics import (
    citation_precision,
    citation_recall,
    expected_to_key,
    keys_from_answer,
    retrieval_hit_at_k,
)
from evals.models import ExpectedCitation
from evals.runner import (
    has_regression,
    load_golden_set,
    run_evaluation,
    write_report,
)

ROOT = Path(__file__).resolve().parents[1]
GOLDEN_SET = ROOT / "evals" / "golden_set.jsonl"


@pytest.fixture
def eval_answerer() -> LegislationAnswerer:
    client = QdrantClient(":memory:")
    embedder = HashEmbedder(vector_size=256)
    indexer = LegislationIndexer(
        client,
        embedder,
        collection_name=COLLECTION_NAME,
        index_version="eval",
    )
    articles: list = []
    parsed_dir = ROOT / "data" / "parsed"
    for path in sorted(parsed_dir.glob("*.jsonl")):
        if path.name.startswith("_"):
            continue
        articles.extend(load_articles_from_jsonl(path))
    indexer.upsert_articles(articles)
    retriever = LegislationRetriever(client, embedder, collection_name=COLLECTION_NAME)
    return LegislationAnswerer(retriever, DevStubLLM(), model_version="test-v1")


def test_load_golden_set_has_ten_cases() -> None:
    cases = load_golden_set(GOLDEN_SET)
    assert len(cases) == 10
    assert any("KVKK" in (case.notes or "") for case in cases)
    assert any("MASAK" in (case.notes or "") for case in cases)


def test_citation_metrics_basic() -> None:
    expected = {
        CitationKey("TEBLIG-MASAK-SAMPLE", 4, "madde", 2),
    }
    predicted = {
        CitationKey("TEBLIG-MASAK-SAMPLE", 4, "madde", 2),
        CitationKey("TEBLIG-MASAK-SAMPLE", 4, "madde", 1),
    }

    assert citation_precision(predicted, expected) == 0.5
    assert citation_recall(predicted, expected) == 1.0


def test_retrieval_hit_at_k() -> None:
    expected = {CitationKey("LAW-KVKK", 4, "madde", 1)}
    retrieved = {CitationKey("LAW-KVKK", 5, "madde", 1), CitationKey("LAW-KVKK", 4, "madde", 1)}
    assert retrieval_hit_at_k(retrieved, expected) == 1.0
    assert retrieval_hit_at_k({CitationKey("LAW-KVKK", 5, "madde", 1)}, expected) == 0.0


def test_run_evaluation_produces_report(eval_answerer: LegislationAnswerer, tmp_path: Path) -> None:
    cases = load_golden_set(GOLDEN_SET)
    report = run_evaluation(
        cases,
        eval_answerer,
        git_sha="testsha",
        model_version="test-v1",
        index_version="v1",
    )

    assert report.aggregate.cases == 10
    assert 0.0 <= report.aggregate.citation_precision <= 1.0
    assert 0.0 <= report.aggregate.citation_recall <= 1.0
    assert 0.0 <= report.aggregate.retrieval_hit_at_5 <= 1.0

    output_path = write_report(report, tmp_path)
    payload = json.loads(output_path.read_text(encoding="utf-8"))
    assert payload["git_sha"] == "testsha"
    assert len(payload["cases"]) == 10


def test_regression_detection() -> None:
    from evals.models import AggregateMetrics

    previous = AggregateMetrics(
        citation_precision=0.8,
        citation_recall=0.7,
        retrieval_hit_at_5=0.9,
        cases=10,
    )
    improved = AggregateMetrics(
        citation_precision=0.85,
        citation_recall=0.75,
        retrieval_hit_at_5=0.95,
        cases=10,
    )
    regressed = AggregateMetrics(
        citation_precision=0.75,
        citation_recall=0.7,
        retrieval_hit_at_5=0.9,
        cases=10,
    )

    assert not has_regression(improved, previous)
    assert has_regression(regressed, previous)


def test_expected_to_key_normalizes_source_code() -> None:
    key = expected_to_key(
        ExpectedCitation(
            kaynak_kodu="law-kvkk",
            madde_no=4,
            fikra_no=1,
        )
    )
    assert key.kaynak_kodu == "LAW-KVKK"


def test_keys_from_answer_parses_citations() -> None:
    answer = "Süre on günü geçemez [TEBLIG-MASAK-SAMPLE / Madde 4 f.2]."
    keys = keys_from_answer(answer)
    assert CitationKey("TEBLIG-MASAK-SAMPLE", 4, "madde", 2) in keys
