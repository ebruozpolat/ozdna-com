from __future__ import annotations

from functools import lru_cache

from fastapi import Depends, Header, HTTPException, status

from app.api.audit import audit_logger
from app.api.rate_limit import InMemoryRateLimiter
from app.config import Settings, get_settings
from app.services.answerer import LegislationAnswerer
from app.services.llm_stub import build_llm_client
from app.services.retriever import build_retriever


def verify_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    settings: Settings = Depends(get_settings),
) -> str:
    if not settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API key not configured",
        )
    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )
    return x_api_key


def enforce_rate_limit(api_key: str = Depends(verify_api_key)) -> str:
    limiter = _get_rate_limiter()
    limiter.check(api_key)
    return api_key


@lru_cache
def _get_rate_limiter() -> InMemoryRateLimiter:
    settings = get_settings()
    return InMemoryRateLimiter(limit=settings.rate_limit_per_minute)


def build_answerer(settings: Settings | None = None) -> LegislationAnswerer:
    cfg = settings or get_settings()
    retriever = build_retriever(cfg)
    llm = build_llm_client(cfg)
    return LegislationAnswerer(
        retriever,
        llm,
        model_version=cfg.model_version,
    )


def get_answerer(settings: Settings = Depends(get_settings)) -> LegislationAnswerer:
    return build_answerer(settings)


def get_audit_logger():
    return audit_logger
