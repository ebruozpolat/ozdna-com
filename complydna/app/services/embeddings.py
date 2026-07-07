from __future__ import annotations

from typing import Protocol


class Embedder(Protocol):
    @property
    def vector_size(self) -> int: ...

    def encode(self, texts: list[str]) -> list[list[float]]: ...
