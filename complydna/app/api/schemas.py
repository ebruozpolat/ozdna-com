from __future__ import annotations

import re
from datetime import date

from pydantic import BaseModel, Field

from app.models.legislation import YuurlulukDurumu
from app.services.answerer import CitationRecord, RetrievalSnapshotItem
from app.services.retriever import RetrievalFilters

CITATION_PATTERN = re.compile(r"\[[^\]]+\]")


class AskFiltersRequest(BaseModel):
    kaynak_kodu: str | list[str] | None = None
    yururluk_durumu: YuurlulukDurumu | list[YuurlulukDurumu] | None = None
    effective_date: date | None = None
    include_mulga: bool = False

    def to_retrieval_filters(self) -> RetrievalFilters:
        return RetrievalFilters(
            kaynak_kodu=self.kaynak_kodu,
            yururluk_durumu=self.yururluk_durumu,
            effective_date=self.effective_date,
            include_mulga=self.include_mulga,
        )


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1)
    filters: AskFiltersRequest | None = None


class SourceRecord(BaseModel):
    chunk_id: str
    kaynak_kodu: str
    citation: str
    score: float = Field(..., ge=0.0)
    metin: str


class AskApiResponse(BaseModel):
    answer: str
    citations: list[CitationRecord]
    sources: list[SourceRecord]
    model_version: str
    index_version: str


def to_source_records(snapshot: list[RetrievalSnapshotItem]) -> list[SourceRecord]:
    records: list[SourceRecord] = []
    for item in snapshot:
        kaynak_kodu = _extract_kaynak_kodu(item.citation)
        records.append(
            SourceRecord(
                chunk_id=item.chunk_id,
                kaynak_kodu=kaynak_kodu,
                citation=item.citation,
                score=item.score,
                metin=item.metin,
            )
        )
    return records


def _extract_kaynak_kodu(citation: str) -> str:
    body = citation.strip("[]")
    kaynak, _, _ = body.partition("/")
    return kaynak.strip().upper()
