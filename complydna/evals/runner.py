from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from app.services.answerer import LegislationAnswerer
from evals.metrics import (
    citation_precision,
    citation_recall,
    expected_to_key,
    format_citation_key,
    keys_from_answer,
    keys_from_retrieval_snapshot,
    retrieval_hit_at_k,
    sort_keys,
)
from evals.models import AggregateMetrics, CaseMetrics, EvalReport, GoldenCase


def load_golden_set(path: Path) -> list[GoldenCase]:
    cases: list[GoldenCase] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            cases.append(GoldenCase.model_validate_json(line))
    return cases


def run_evaluation(
    cases: list[GoldenCase],
    answerer: LegislationAnswerer,
    *,
    git_sha: str,
    model_version: str,
    index_version: str,
) -> EvalReport:
    case_metrics: list[CaseMetrics] = []

    for case in cases:
        result = answerer.ask(case.question)
        expected = {expected_to_key(item) for item in case.expected_citations}
        predicted = keys_from_answer(result.answer_text)
        retrieved = keys_from_retrieval_snapshot(result.retrieval_snapshot, top_k=5)

        case_metrics.append(
            CaseMetrics(
                question=case.question,
                citation_precision=citation_precision(predicted, expected),
                citation_recall=citation_recall(predicted, expected),
                retrieval_hit_at_5=retrieval_hit_at_k(retrieved, expected),
                predicted_citations=[format_citation_key(key) for key in sort_keys(predicted)],
                expected_citations=[format_citation_key(key) for key in sort_keys(expected)],
                notes=case.notes,
            )
        )

    aggregate = AggregateMetrics(
        citation_precision=_mean(item.citation_precision for item in case_metrics),
        citation_recall=_mean(item.citation_recall for item in case_metrics),
        retrieval_hit_at_5=_mean(item.retrieval_hit_at_5 for item in case_metrics),
        cases=len(case_metrics),
    )

    return EvalReport(
        git_sha=git_sha,
        generated_at=datetime.now(UTC).isoformat(),
        model_version=model_version,
        index_version=index_version,
        aggregate=aggregate,
        cases=case_metrics,
    )


def write_report(report: EvalReport, results_dir: Path) -> Path:
    results_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    output_path = results_dir / f"{timestamp}_{report.git_sha}.json"
    output_path.write_text(
        json.dumps(report.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


def find_previous_report(results_dir: Path, exclude: Path | None = None) -> EvalReport | None:
    if not results_dir.exists():
        return None

    candidates = sorted(
        results_dir.glob("*.json"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    for path in candidates:
        if exclude and path.resolve() == exclude.resolve():
            continue
        return EvalReport.model_validate_json(path.read_text(encoding="utf-8"))
    return None


def has_regression(current: AggregateMetrics, previous: AggregateMetrics) -> bool:
    return (
        current.citation_precision < previous.citation_precision
        or current.citation_recall < previous.citation_recall
        or current.retrieval_hit_at_5 < previous.retrieval_hit_at_5
    )


def _mean(values) -> float:
    items = list(values)
    if not items:
        return 0.0
    return sum(items) / len(items)
