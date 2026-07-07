from __future__ import annotations

import argparse
import sys
from pathlib import Path

from qdrant_client import QdrantClient

from app.config import get_settings
from app.services.answerer import LegislationAnswerer
from app.services.embedding_backends import HashEmbedder
from app.services.indexer.core import LegislationIndexer, load_articles_from_jsonl
from app.services.llm_stub import DevStubLLM, build_llm_client
from app.services.retriever import COLLECTION_NAME, LegislationRetriever, build_retriever
from evals.runner import (
    find_previous_report,
    has_regression,
    load_golden_set,
    run_evaluation,
    write_report,
)
from app.version import resolve_git_sha

ROOT = Path(__file__).resolve().parents[1]

def load_corpus_paths() -> list[Path]:
    parsed_dir = ROOT / "data" / "parsed"
    return sorted(
        path
        for path in parsed_dir.glob("*.jsonl")
        if path.is_file() and not path.name.startswith("_")
    )


def build_offline_answerer(corpus_paths: list[Path]) -> LegislationAnswerer:
    client = QdrantClient(":memory:")
    embedder = HashEmbedder(vector_size=256)
    indexer = LegislationIndexer(
        client,
        embedder,
        collection_name=COLLECTION_NAME,
        index_version="eval",
    )
    articles = []
    for path in corpus_paths:
        articles.extend(load_articles_from_jsonl(path))
    indexer.upsert_articles(articles)
    retriever = LegislationRetriever(client, embedder, collection_name=COLLECTION_NAME)
    return LegislationAnswerer(retriever, DevStubLLM(), model_version="dev-stub-v1")


def build_answerer(*, offline: bool) -> LegislationAnswerer:
    if offline:
        return build_offline_answerer(load_corpus_paths())
    settings = get_settings()
    retriever = build_retriever(settings)
    return LegislationAnswerer(
        retriever,
        build_llm_client(settings),
        model_version=settings.model_version,
    )


def json_summary(report, output_path: Path) -> str:
    aggregate = report.aggregate
    return (
        f"Wrote {output_path}\n"
        f"citation_precision={aggregate.citation_precision:.3f} "
        f"citation_recall={aggregate.citation_recall:.3f} "
        f"retrieval_hit@5={aggregate.retrieval_hit_at_5:.3f} "
        f"cases={aggregate.cases}"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run ComplyDNA golden-set evaluation")
    parser.add_argument(
        "--golden-set",
        type=Path,
        default=ROOT / "evals" / "golden_set.jsonl",
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=ROOT / "evals" / "results",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Use configured Qdrant + LLM settings instead of offline in-memory corpus",
    )
    args = parser.parse_args(argv)

    settings = get_settings()
    cases = load_golden_set(args.golden_set)
    answerer = build_answerer(offline=not args.live)
    report = run_evaluation(
        cases,
        answerer,
        git_sha=resolve_git_sha(),
        model_version=answerer.model_version,
        index_version=settings.index_version,
    )
    output_path = write_report(report, args.results_dir)
    previous = find_previous_report(args.results_dir, exclude=output_path)

    print(json_summary(report, output_path))
    if previous and has_regression(report.aggregate, previous.aggregate):
        print("Regression detected against previous run.", file=sys.stderr)
        return 1
    return 0
