from __future__ import annotations

import hashlib
import re
from functools import lru_cache

from app.services.embeddings import Embedder

_TOKEN = re.compile(r"[\wçğıöşüÇĞİÖŞÜ]+", re.UNICODE)


class HashEmbedder:
    """Deterministic embedder for unit tests (not for production search quality)."""

    def __init__(self, vector_size: int = 128) -> None:
        self._vector_size = vector_size

    @property
    def vector_size(self) -> int:
        return self._vector_size

    def encode(self, texts: list[str]) -> list[list[float]]:
        return [self._vectorize(text) for text in texts]

    def _vectorize(self, text: str) -> list[float]:
        vector = [0.0] * self._vector_size
        tokens = _TOKEN.findall(text.lower())
        if not tokens:
            return vector
        for token in tokens:
            digest = hashlib.sha256(token.encode()).digest()
            index = int.from_bytes(digest[:4], "big") % self._vector_size
            vector[index] += 1.0
        norm = sum(value * value for value in vector) ** 0.5
        if norm:
            vector = [value / norm for value in vector]
        return vector


class BgeM3Embedder:
    def __init__(self, model_name: str = "BAAI/bge-m3") -> None:
        self._model_name = model_name
        self._model = None

    @property
    def vector_size(self) -> int:
        return 1024

    def encode(self, texts: list[str]) -> list[list[float]]:
        model = self._get_model()
        vectors = model.encode(texts, normalize_embeddings=True)
        return [vector.tolist() for vector in vectors]

    def _get_model(self):
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self._model_name)
        return self._model


@lru_cache
def get_bge_m3_embedder(model_name: str = "BAAI/bge-m3") -> Embedder:
    return BgeM3Embedder(model_name=model_name)
