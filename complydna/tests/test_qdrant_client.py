from pathlib import Path

from qdrant_client import QdrantClient

from app.config import Settings
from app.services.qdrant_client import _build_qdrant_client, build_qdrant_client


def test_build_qdrant_client_uses_local_path(tmp_path: Path) -> None:
    _build_qdrant_client.cache_clear()
    db_path = tmp_path / "qdrant"
    settings = Settings(qdrant_path=str(db_path))
    client = build_qdrant_client(settings)
    assert isinstance(client, QdrantClient)
    client.create_collection(
        "test",
        vectors_config={"size": 4, "distance": "Cosine"},
    )
    assert db_path.exists()


def test_build_qdrant_client_reuses_embedded_path_client(tmp_path: Path) -> None:
    _build_qdrant_client.cache_clear()
    db_path = tmp_path / "qdrant"
    settings = Settings(qdrant_path=str(db_path))

    first = build_qdrant_client(settings)
    second = build_qdrant_client(settings)

    assert first is second
