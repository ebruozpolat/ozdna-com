from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from pydantic import BaseModel, Field
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    FieldCondition,
    Filter,
    MatchAny,
    MatchValue,
)

from app.config import Settings, get_settings
from app.models.legislation import Article, YuurlulukDurumu
from app.services.embedding_backends import get_bge_m3_embedder
from app.services.embeddings import Embedder
from app.services.qdrant_client import build_qdrant_client
from app.services.qdrant_payload import article_from_payload

COLLECTION_NAME = "mevzuat_v1"


class ScoredChunk(BaseModel):
    chunk_id: str
    score: float = Field(..., ge=0.0)
    article: Article

    @property
    def citation(self) -> str:
        return self.article.citation()


@dataclass(frozen=True)
class RetrievalFilters:
    kaynak_kodu: str | list[str] | None = None
    yururluk_durumu: YuurlulukDurumu | list[YuurlulukDurumu] | None = None
    effective_date: date | None = None
    include_mulga: bool = False


class LegislationRetriever:
    def __init__(
        self,
        client: QdrantClient,
        embedder: Embedder,
        *,
        collection_name: str = COLLECTION_NAME,
    ) -> None:
        self.client = client
        self.embedder = embedder
        self.collection_name = collection_name

    def search(
        self,
        query: str,
        *,
        top_k: int = 8,
        filters: RetrievalFilters | None = None,
    ) -> list[ScoredChunk]:
        if not query.strip():
            return []

        vector = self.embedder.encode([query])[0]
        query_filter = _build_filter(filters)
        fetch_limit = top_k * 4 if filters and filters.effective_date else top_k

        response = self.client.query_points(
            collection_name=self.collection_name,
            query=vector,
            limit=fetch_limit,
            query_filter=query_filter,
            with_payload=True,
        )

        hits: list[ScoredChunk] = []
        for point in response.points:
            payload = point.payload or {}
            article = article_from_payload(payload)
            effective_date = filters.effective_date if filters else None
            if effective_date and article.yururluk_tarihi > effective_date:
                continue
            hits.append(
                ScoredChunk(
                    chunk_id=str(payload.get("chunk_id", "")),
                    score=float(point.score or 0.0),
                    article=article,
                )
            )
            if len(hits) >= top_k:
                break
        return hits


def build_retriever(
    settings: Settings | None = None,
    *,
    embedder: Embedder | None = None,
    client: QdrantClient | None = None,
) -> LegislationRetriever:
    cfg = settings or get_settings()
    resolved_embedder = embedder or get_bge_m3_embedder(cfg.embedding_model)
    resolved_client = client or build_qdrant_client(cfg)
    return LegislationRetriever(
        resolved_client,
        resolved_embedder,
        collection_name=cfg.qdrant_collection,
    )


def _build_filter(filters: RetrievalFilters | None) -> Filter | None:
    must: list[FieldCondition] = []
    must_not: list[FieldCondition] = []

    if filters is None:
        must_not.append(
            FieldCondition(
                key="yururluk_durumu",
                match=MatchValue(value=YuurlulukDurumu.MULGA.value),
            )
        )
        return Filter(must_not=must_not) if must_not else None

    if filters.kaynak_kodu is not None:
        codes = (
            [filters.kaynak_kodu]
            if isinstance(filters.kaynak_kodu, str)
            else filters.kaynak_kodu
        )
        must.append(
            FieldCondition(
                key="kaynak_kodu",
                match=MatchAny(any=[code.strip().upper() for code in codes]),
            )
        )

    if filters.yururluk_durumu is not None:
        statuses = (
            [filters.yururluk_durumu]
            if isinstance(filters.yururluk_durumu, YuurlulukDurumu)
            else filters.yururluk_durumu
        )
        must.append(
            FieldCondition(
                key="yururluk_durumu",
                match=MatchAny(any=[status.value for status in statuses]),
            )
        )
    elif not filters.include_mulga:
        must_not.append(
            FieldCondition(
                key="yururluk_durumu",
                match=MatchValue(value=YuurlulukDurumu.MULGA.value),
            )
        )

    if not must and not must_not:
        return None
    return Filter(must=must or None, must_not=must_not or None)
