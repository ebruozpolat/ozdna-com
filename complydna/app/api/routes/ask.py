from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.audit import AuditLogger
from app.api.deps import enforce_rate_limit, get_answerer, get_audit_logger
from app.api.schemas import AskApiResponse, AskRequest, to_source_records
from app.config import Settings, get_settings
from app.services.answerer import LegislationAnswerer

router = APIRouter(prefix="/v1", tags=["ask"])


@router.post("/ask", response_model=AskApiResponse)
def ask_question(
    payload: AskRequest,
    _: str = Depends(enforce_rate_limit),
    answerer: LegislationAnswerer = Depends(get_answerer),
    settings: Settings = Depends(get_settings),
    audit: AuditLogger = Depends(get_audit_logger),
) -> AskApiResponse:
    filters = payload.filters.to_retrieval_filters() if payload.filters else None
    result = answerer.ask(payload.question, filters=filters)

    audit.record(
        question=payload.question,
        answer=result.answer_text,
        model_version=settings.model_version,
        index_version=settings.index_version,
    )

    return AskApiResponse(
        answer=result.answer_text,
        citations=result.citations,
        sources=to_source_records(result.retrieval_snapshot),
        model_version=settings.model_version,
        index_version=settings.index_version,
    )
