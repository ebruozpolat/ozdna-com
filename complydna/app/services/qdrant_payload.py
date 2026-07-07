from __future__ import annotations

from app.models.legislation import Article


def article_from_payload(payload: dict[str, object]) -> Article:
    fields = {key: payload[key] for key in Article.model_fields if key in payload}
    return Article.model_validate(fields)


def article_payload(article: Article, index_version: str) -> dict[str, object]:
    payload = article.model_dump(mode="json")
    payload["chunk_id"] = article.chunk_id()
    payload["index_version"] = index_version
    return payload
