from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.legislation import MaddeTuru


class ExpectedCitation(BaseModel):
    kaynak_kodu: str
    madde_no: int = Field(..., ge=1)
    madde_turu: MaddeTuru = "madde"
    fikra_no: int | None = Field(default=None, ge=1)


class GoldenCase(BaseModel):
    question: str = Field(..., min_length=1)
    expected_citations: list[ExpectedCitation]
    notes: str | None = None


class CaseMetrics(BaseModel):
    question: str
    citation_precision: float
    citation_recall: float
    retrieval_hit_at_5: float
    predicted_citations: list[str]
    expected_citations: list[str]
    notes: str | None = None


class AggregateMetrics(BaseModel):
    citation_precision: float
    citation_recall: float
    retrieval_hit_at_5: float
    cases: int


class EvalReport(BaseModel):
    git_sha: str
    generated_at: str
    model_version: str
    index_version: str
    aggregate: AggregateMetrics
    cases: list[CaseMetrics]
