from __future__ import annotations

from app.services.answerer import CitationKey, extract_citation_keys

from evals.models import ExpectedCitation


def expected_to_key(citation: ExpectedCitation) -> CitationKey:
    return CitationKey(
        kaynak_kodu=citation.kaynak_kodu.strip().upper(),
        madde_no=citation.madde_no,
        madde_turu=citation.madde_turu,
        fikra_no=citation.fikra_no,
    )


def format_citation_key(key: CitationKey) -> str:
    if key.madde_turu == "gecici_madde":
        label = f"Geçici Madde {key.madde_no}"
    else:
        label = f"Madde {key.madde_no}"
    base = f"[{key.kaynak_kodu} / {label}"
    if key.fikra_no is not None:
        base += f" f.{key.fikra_no}"
    return f"{base}]"


def sort_keys(keys: set[CitationKey]) -> list[CitationKey]:
    return sorted(
        keys,
        key=lambda item: (item.kaynak_kodu, item.madde_turu, item.madde_no, item.fikra_no or 0),
    )


def citation_precision(predicted: set[CitationKey], expected: set[CitationKey]) -> float:
    if not predicted:
        return 0.0
    return len(predicted & expected) / len(predicted)


def citation_recall(predicted: set[CitationKey], expected: set[CitationKey]) -> float:
    if not expected:
        return 1.0
    return len(predicted & expected) / len(expected)


def retrieval_hit_at_k(
    retrieved: set[CitationKey],
    expected: set[CitationKey],
) -> float:
    if not expected:
        return 1.0
    return 1.0 if retrieved & expected else 0.0


def keys_from_answer(answer_text: str) -> set[CitationKey]:
    return set(extract_citation_keys(answer_text))


def keys_from_retrieval_snapshot(snapshot: list[object], *, top_k: int = 5) -> set[CitationKey]:
    from app.services.answerer import RetrievalSnapshotItem

    keys: set[CitationKey] = set()
    for item in snapshot[:top_k]:
        if not isinstance(item, RetrievalSnapshotItem):
            continue
        citation = item.citation
        parsed = extract_citation_keys(citation)
        if parsed:
            keys.add(parsed[0])
    return keys
