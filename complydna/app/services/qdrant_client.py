from __future__ import annotations

from pathlib import Path

from qdrant_client import QdrantClient

from app.config import Settings, get_settings


def build_qdrant_client(settings: Settings | None = None) -> QdrantClient:
    """Create a Qdrant client from settings.

    When ``qdrant_path`` is set, uses embedded local storage (no Docker/server).
    Otherwise connects to ``qdrant_url`` (Docker compose or remote Qdrant).
    """
    cfg = settings or get_settings()
    if cfg.qdrant_path:
        path = Path(cfg.qdrant_path)
        path.mkdir(parents=True, exist_ok=True)
        return QdrantClient(path=str(path))
    return QdrantClient(url=cfg.qdrant_url)
