from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class AuditEntry:
    timestamp: datetime
    question_hash: str
    answer_hash: str
    model_version: str
    index_version: str


class AuditLogger:
    def __init__(self) -> None:
        self.entries: list[AuditEntry] = []

    def record(
        self,
        *,
        question: str,
        answer: str,
        model_version: str,
        index_version: str,
    ) -> AuditEntry:
        entry = AuditEntry(
            timestamp=datetime.now(UTC),
            question_hash=_hash_text(question),
            answer_hash=_hash_text(answer),
            model_version=model_version,
            index_version=index_version,
        )
        self.entries.append(entry)
        return entry

    def clear(self) -> None:
        self.entries.clear()


audit_logger = AuditLogger()


def _hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
