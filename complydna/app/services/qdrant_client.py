from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from qdrant_client import QdrantClient

from app.config import Settings, get_settings


def build_qdrant_client(settings: Settings | None = None) -> QdrantClient:
    """Create a Qdrant client from settings.

    When ``qdrant_path`` is set, uses embedded local storage (no Docker/server).
    Otherwise connects to ``qdrant_url`` (Docker compose or remote Qdrant).
    """
    cfg = settings or get_settings()
    return _build_qdrant_client(cfg.qdrant_path, cfg.qdrant_url)


@lru_cache(maxsize=16)
def _build_qdrant_client(qdrant_path: str | None, qdrant_url: str) -> QdrantClient:
    if qdrant_path:
        path = Path(qdrant_path)
        path.mkdir(parents=True, exist_ok=True)
        return QdrantClient(path=str(path))
    return QdrantClient(url=qdrant_url)
