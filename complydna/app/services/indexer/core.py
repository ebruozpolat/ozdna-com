from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, FieldCondition, Filter, MatchValue, PointStruct, VectorParams

from app.config import Settings, get_settings
from app.models.legislation import Article
from app.services.embedding_backends import get_bge_m3_embedder
from app.services.embeddings import Embedder
from app.services.qdrant_client import build_qdrant_client
from app.services.qdrant_payload import article_payload
from app.services.retriever import COLLECTION_NAME, LegislationRetriever, RetrievalFilters


@dataclass(frozen=True)
class IndexHit:
    chunk_id: str
    score: float
    article: Article


@dataclass(frozen=True)
class IndexSummary:
    source_file: str
    upserted: int
    deleted_stale: int = 0


class LegislationIndexer:
    def __init__(
        self,
        client: QdrantClient,
        embedder: Embedder,
        *,
        collection_name: str = COLLECTION_NAME,
        index_version: str = "v1",
    ) -> None:
        self.client = client
        self.embedder = embedder
        self.collection_name = collection_name
        self.index_version = index_version

    def ensure_collection(self) -> None:
        if self.client.collection_exists(self.collection_name):
            info = self.client.get_collection(self.collection_name)
            current_size = info.config.params.vectors.size  # type: ignore[union-attr]
            if current_size != self.embedder.vector_size:
                msg = (
                    f"collection {self.collection_name} vector size {current_size} "
                    f"!= embedder size {self.embedder.vector_size}"
                )
                raise RuntimeError(msg)
            return

        self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(size=self.embedder.vector_size, distance=Distance.COSINE),
        )

    def upsert_articles(self, articles: list[Article]) -> int:
        if not articles:
            return 0

        self.ensure_collection()
        vectors = self.embedder.encode([article.embedding_text() for article in articles])
        points = [
            PointStruct(
                id=_point_uuid(article.chunk_id()),
                vector=vector,
                payload=article_payload(article, self.index_version),
            )
            for article, vector in zip(articles, vectors, strict=True)
        ]
        self.client.upsert(collection_name=self.collection_name, points=points)
        return len(points)

    def replace_articles(
        self,
        articles: list[Article],
        *,
        source_codes: set[str],
    ) -> IndexSummary:
        self.ensure_collection()
        upserted = self.upsert_articles(articles)
        current_chunk_ids = {article.chunk_id() for article in articles}
        deleted_stale = self.delete_stale_points(source_codes, current_chunk_ids)
        return IndexSummary(source_file="", upserted=upserted, deleted_stale=deleted_stale)

    def delete_stale_points(self, source_codes: set[str], current_chunk_ids: set[str]) -> int:
        stale_point_ids: list[str] = []
        for source_code in sorted(source_codes):
            offset = None
            source_filter = Filter(
                must=[
                    FieldCondition(
                        key="kaynak_kodu",
                        match=MatchValue(value=source_code),
                    )
                ]
            )
            while True:
                records, offset = self.client.scroll(
                    collection_name=self.collection_name,
                    scroll_filter=source_filter,
                    limit=256,
                    offset=offset,
                    with_payload=["chunk_id"],
                    with_vectors=False,
                )
                stale_point_ids.extend(
                    str(record.id)
                    for record in records
                    if (record.payload or {}).get("chunk_id") not in current_chunk_ids
                )
                if offset is None:
                    break

        if stale_point_ids:
            self.client.delete(collection_name=self.collection_name, points_selector=stale_point_ids)
        return len(stale_point_ids)

    def search(
        self,
        query: str,
        *,
        top_k: int = 5,
        exclude_mulga: bool = True,
    ) -> list[IndexHit]:
        self.ensure_collection()
        filters = None if exclude_mulga else RetrievalFilters(include_mulga=True)
        retriever = LegislationRetriever(
            self.client,
            self.embedder,
            collection_name=self.collection_name,
        )
        scored = retriever.search(query, top_k=top_k, filters=filters)
        return [
            IndexHit(chunk_id=hit.chunk_id, score=hit.score, article=hit.article)
            for hit in scored
        ]


def load_articles_from_jsonl(path: Path) -> list[Article]:
    articles: list[Article] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            articles.append(Article.model_validate_json(line))
    return articles


def index_directory(
    source_dir: Path,
    indexer: LegislationIndexer,
) -> list[IndexSummary]:
    summaries: list[IndexSummary] = []
    for path in sorted(source_dir.glob("*.jsonl")):
        if path.name.startswith("_"):
            continue
        articles = load_articles_from_jsonl(path)
        source_codes = {article.kaynak_kodu for article in articles} or {path.stem.upper()}
        summary = indexer.replace_articles(articles, source_codes=source_codes)
        summaries.append(
            IndexSummary(
                source_file=path.name,
                upserted=summary.upserted,
                deleted_stale=summary.deleted_stale,
            )
        )
    return summaries


def build_indexer(
    settings: Settings | None = None,
    *,
    embedder: Embedder | None = None,
    client: QdrantClient | None = None,
) -> LegislationIndexer:
    cfg = settings or get_settings()
    resolved_embedder = embedder or get_bge_m3_embedder(cfg.embedding_model)
    resolved_client = client or build_qdrant_client(cfg)
    return LegislationIndexer(
        resolved_client,
        resolved_embedder,
        collection_name=cfg.qdrant_collection,
        index_version=cfg.index_version,
    )


def _point_uuid(chunk_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


