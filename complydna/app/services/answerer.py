from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol

from pydantic import BaseModel, Field

from app.models.legislation import MaddeTuru, YuurlulukDurumu
from app.services.retriever import LegislationRetriever, RetrievalFilters, ScoredChunk

CITATION_PATTERN = re.compile(
    r"\[(?P<kaynak>[^\]/\[]+?)\s*/\s*"
    r"(?:(?P<gecici>Geçici\s+)?Madde\s+(?P<madde>\d+))"
    r"(?:\s+f\.(?P<fikra>\d+))?\s*\]",
    re.IGNORECASE,
)
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
FALLBACK_PHRASE = "mevzuatta açık hüküm bulamadım"

SYSTEM_PROMPT = (
    "Sen ComplyDNA uyum asistanısın. Yalnızca verilen mevzuat bağlamına dayanarak yanıt ver.\n\n"
    "Kurallar:\n"
    "1. Her cümle [KAYNAK_KODU / Madde N] veya [KAYNAK_KODU / Geçici Madde N] künyesi taşımalı.\n"
    "2. Bağlamda dayanağı olmayan iddia yasak.\n"
    '3. Emin değilsen yalnızca şunu yaz: "Mevzuatta açık hüküm bulamadım."\n'
    "4. Yanıtı Türkçe ver; künyeler bağlamdaki kodlarla birebir eşleşmeli."
)


class CitationRecord(BaseModel):
    kaynak_kodu: str
    madde_no: int
    madde_turu: MaddeTuru = "madde"
    fikra_no: int | None = None
    yururluk_durumu: YuurlulukDurumu
    citation: str


class RetrievalSnapshotItem(BaseModel):
    chunk_id: str
    score: float = Field(..., ge=0.0)
    citation: str
    metin: str


class AnswerResponse(BaseModel):
    answer_text: str
    citations: list[CitationRecord]
    retrieval_snapshot: list[RetrievalSnapshotItem]


class AnswerValidationError(ValueError):
    """Raised when LLM output fails cite-first post-check."""


@dataclass(frozen=True)
class CitationKey:
    kaynak_kodu: str
    madde_no: int
    madde_turu: MaddeTuru
    fikra_no: int | None


class LLMClient(Protocol):
    def complete(self, *, system: str, user: str) -> str: ...


class LegislationAnswerer:
    def __init__(
        self,
        retriever: LegislationRetriever,
        llm: LLMClient,
        *,
        model_version: str = "mock",
        top_k: int = 8,
    ) -> None:
        self.retriever = retriever
        self.llm = llm
        self.model_version = model_version
        self.top_k = top_k

    def ask(
        self,
        question: str,
        *,
        filters: RetrievalFilters | None = None,
    ) -> AnswerResponse:
        chunks = self.retriever.search(question, top_k=self.top_k, filters=filters)
        snapshot = _build_snapshot(chunks)

        if not chunks:
            return AnswerResponse(
                answer_text="Mevzuatta açık hüküm bulamadım.",
                citations=[],
                retrieval_snapshot=snapshot,
            )

        allowed = {_citation_key_from_chunk(chunk) for chunk in chunks}
        context = _format_context(chunks)
        user_prompt = _build_user_prompt(question, context)

        for attempt in range(2):
            retry_note = ""
            if attempt == 1:
                retry_note = (
                    "\n\nÖnceki yanıt künye kurallarına uymadı. "
                    "Her cümlede geçerli künye kullan veya yalnızca fallback cümlesini yaz."
                )
            raw = self.llm.complete(system=SYSTEM_PROMPT, user=user_prompt + retry_note)
            try:
                validate_cited_answer(raw, allowed)
                return AnswerResponse(
                    answer_text=raw.strip(),
                    citations=_build_citations(raw, chunks),
                    retrieval_snapshot=snapshot,
                )
            except AnswerValidationError:
                continue

        return AnswerResponse(
            answer_text="Mevzuatta açık hüküm bulamadım.",
            citations=[],
            retrieval_snapshot=snapshot,
        )


def validate_cited_answer(answer_text: str, allowed: set[CitationKey]) -> None:
    text = answer_text.strip()
    if not text:
        raise AnswerValidationError("empty answer")

    if _is_fallback_only(text):
        return

    for sentence in _split_sentences(text):
        if _sentence_is_fallback(sentence):
            continue
        if not CITATION_PATTERN.search(sentence):
            raise AnswerValidationError(f"sentence without citation: {sentence!r}")

    for key in extract_citation_keys(text):
        if key not in allowed:
            raise AnswerValidationError(f"unknown citation: {key}")


def extract_citation_keys(text: str) -> list[CitationKey]:
    keys: list[CitationKey] = []
    for match in CITATION_PATTERN.finditer(text):
        keys.append(_citation_key_from_match(match))
    return keys


def _build_snapshot(chunks: list[ScoredChunk]) -> list[RetrievalSnapshotItem]:
    return [
        RetrievalSnapshotItem(
            chunk_id=chunk.chunk_id,
            score=chunk.score,
            citation=chunk.citation,
            metin=chunk.article.metin,
        )
        for chunk in chunks
    ]


def _build_citations(answer_text: str, chunks: list[ScoredChunk]) -> list[CitationRecord]:
    chunk_by_key = {_citation_key_from_chunk(chunk): chunk for chunk in chunks}
    seen: set[CitationKey] = set()
    records: list[CitationRecord] = []

    for key in extract_citation_keys(answer_text):
        if key in seen:
            continue
        chunk = chunk_by_key.get(key)
        if chunk is None:
            continue
        seen.add(key)
        article = chunk.article
        records.append(
            CitationRecord(
                kaynak_kodu=article.kaynak_kodu,
                madde_no=article.madde_no,
                madde_turu=article.madde_turu,
                fikra_no=article.fikra_no,
                yururluk_durumu=article.yururluk_durumu,
                citation=article.citation(),
            )
        )
    return records


def _format_context(chunks: list[ScoredChunk]) -> str:
    lines = []
    for chunk in chunks:
        article = chunk.article
        lines.append(f"{article.citation()} {article.metin}")
    return "\n\n".join(lines)


def _build_user_prompt(question: str, context: str) -> str:
    return f"Soru: {question}\n\nMevzuat bağlamı:\n{context}"


def _split_sentences(text: str) -> list[str]:
    parts = [part.strip() for part in SENTENCE_SPLIT.split(text.strip()) if part.strip()]
    return parts or [text.strip()]


def _sentence_is_fallback(sentence: str) -> bool:
    return FALLBACK_PHRASE in sentence.casefold()


def _is_fallback_only(text: str) -> bool:
    sentences = _split_sentences(text)
    return len(sentences) == 1 and _sentence_is_fallback(sentences[0])


def _citation_key_from_chunk(chunk: ScoredChunk) -> CitationKey:
    article = chunk.article
    return CitationKey(
        kaynak_kodu=article.kaynak_kodu,
        madde_no=article.madde_no,
        madde_turu=article.madde_turu,
        fikra_no=article.fikra_no,
    )


def _citation_key_from_match(match: re.Match[str]) -> CitationKey:
    madde_turu: MaddeTuru = "gecici_madde" if match.group("gecici") else "madde"
    fikra_raw = match.group("fikra")
    return CitationKey(
        kaynak_kodu=match.group("kaynak").strip().upper(),
        madde_no=int(match.group("madde")),
        madde_turu=madde_turu,
        fikra_no=int(fikra_raw) if fikra_raw else None,
    )
