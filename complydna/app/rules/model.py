"""Rule, provenance and result models for deterministic compliance rule packs.

Design rules (see docs/amlr/IMPLEMENTATION_REPORT.md):
- Fail closed: a rule whose legal source, provision, parameters or application date are not
  verified never yields PASS or FAIL. It yields HUMAN_REVIEW_REQUIRED (with the provisional
  outcome of the encoded logic attached for review) or NOT_DETERMINED.
- No fabricated provenance: a source that was not acquired carries no hash and no retrieval
  timestamp. Synthetic sources exist only for engine tests and are rejected by the pack loader.
- Money and percentages are Decimal, built from strings or ints, never from binary floats.
- The evaluation date (as_of) is always an explicit input; nothing here reads the clock.

Outcome semantics: PASS means the rule's condition is satisfied (e.g. "qualifies as a
beneficial owner", "deadline met", "within the cash limit"); FAIL means it is not. Each rule's
`condition` field states what PASS asserts.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
RULE_ID_RE = re.compile(r"^[a-z0-9]+(?:_[a-z0-9]+)*$")
REASON_RE = re.compile(r"^[A-Z0-9]+(?:_[A-Z0-9]+)*$")


class Outcome(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    NOT_DETERMINED = "NOT_DETERMINED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    HUMAN_REVIEW_REQUIRED = "HUMAN_REVIEW_REQUIRED"


DEFINITE = frozenset({Outcome.PASS, Outcome.FAIL})


class SourceKind(StrEnum):
    PRIMARY_LAW = "PRIMARY_LAW"
    #: Only for engine tests. The pack loader rejects it.
    SYNTHETIC_TEST = "SYNTHETIC_TEST"


class SourceStatus(StrEnum):
    #: Not retrieved: no hash, no retrieval time.
    NOT_ACQUIRED = "NOT_ACQUIRED"
    #: Bytes retrieved and hashed; text not yet checked against the rule.
    ACQUIRED_UNVERIFIED = "ACQUIRED_UNVERIFIED"
    #: Retrieved, hashed and checked by a reviewer.
    VERIFIED = "VERIFIED"


class InterpretationStatus(StrEnum):
    UNVERIFIED = "UNVERIFIED"
    VERIFIED = "VERIFIED"
    #: A legal ambiguity materially changes the outcome; needs a human decision.
    AMBIGUOUS = "AMBIGUOUS"


def to_decimal(value: Any) -> Decimal:
    """Exact Decimal from str/int/Decimal. Floats are rejected: 0.1 has no exact binary form."""
    if isinstance(value, bool):
        raise TypeError("bool is not a number")
    if isinstance(value, Decimal):
        result = value
    elif isinstance(value, int):
        result = Decimal(value)
    elif isinstance(value, str):
        result = Decimal(value.strip())
    else:
        raise TypeError(f"expected str, int or Decimal, got {type(value).__name__}")
    if not result.is_finite():
        raise ValueError("number must be finite")
    return result


class LegalSource(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    source_id: str = Field(..., min_length=1)
    kind: SourceKind
    legal_instrument: str = Field(..., min_length=1)
    jurisdiction: str = Field(..., min_length=1)
    source_url: str = Field(..., min_length=1)
    status: SourceStatus
    source_sha256: str | None = None
    retrieved_at: datetime | None = None
    #: Who retrieved/verified it and how (e.g. "founder upload", "EUR-Lex HTML via fetch").
    acquisition_note: str | None = None

    @model_validator(mode="after")
    def _consistent(self) -> LegalSource:
        if self.status is SourceStatus.NOT_ACQUIRED:
            if self.source_sha256 is not None or self.retrieved_at is not None:
                raise ValueError("a NOT_ACQUIRED source must not carry a hash or retrieval time")
        else:
            if self.source_sha256 is None or not SHA256_RE.match(self.source_sha256):
                raise ValueError("an acquired source needs a lowercase hex sha256")
            if self.retrieved_at is None or self.retrieved_at.tzinfo is None:
                raise ValueError("an acquired source needs a timezone-aware retrieved_at")
        return self


class Provision(BaseModel):
    """Article-level pointer. `article` stays None until read in the primary text."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    source_id: str = Field(..., min_length=1)
    article: str | None = None
    paragraph: str | None = None
    point: str | None = None
    verified: bool = False

    @model_validator(mode="after")
    def _verified_needs_article(self) -> Provision:
        if self.verified and not self.article:
            raise ValueError("a verified provision needs an article")
        return self

    def citation(self) -> str:
        parts = [self.source_id]
        parts.append(f"Art. {self.article}" if self.article else "Art. VERIFY_FROM_PRIMARY_SOURCE")
        if self.paragraph:
            parts.append(f"({self.paragraph})")
        if self.point:
            parts.append(f"point {self.point}")
        return " ".join(parts)


class Parameter(BaseModel):
    """A legal value (threshold, period, date) with its own verification flag."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    value: str | int | None
    verified: bool = False
    #: "candidate" values come from the implementation brief, not from the primary text.
    origin: str = "candidate"
    note: str | None = None

    def decimal(self) -> Decimal:
        if self.value is None:
            raise ValueError("parameter has no value")
        return to_decimal(self.value)


class RuleDefinition(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    rule_id: str
    version: int = Field(..., ge=1)
    jurisdiction: str = Field(..., min_length=1)
    legal_instrument: str = Field(..., min_length=1)
    provision: Provision
    source_url: str = Field(..., min_length=1)
    condition: str = Field(..., min_length=1, description="What PASS asserts.")
    evaluator: str = Field(..., min_length=1)
    applies_from: date | None = None
    applies_from_verified: bool = False
    applies_until: date | None = None
    #: Outcome before applies_from. NOT_DETERMINED when an earlier regime governed that period
    #: (e.g. the AMLD beneficial-ownership test); NOT_APPLICABLE only for a deferred obligation
    #: that did not exist before (e.g. a sector brought into scope later).
    pre_application_outcome: Literal["NOT_DETERMINED", "NOT_APPLICABLE"] = "NOT_DETERMINED"
    scope: str | None = None
    scope_verified: bool = False
    exceptions: tuple[str, ...] = ()
    exceptions_verified: bool = False
    parameters: dict[str, Parameter] = Field(default_factory=dict)
    interpretation_status: InterpretationStatus = InterpretationStatus.UNVERIFIED
    review_required: bool = True
    requirement_ids: tuple[str, ...] = ()
    notes: str | None = None

    @field_validator("rule_id")
    @classmethod
    def _rule_id(cls, v: str) -> str:
        if not RULE_ID_RE.match(v):
            raise ValueError("rule_id must be lower_snake_case")
        return v

    @model_validator(mode="after")
    def _dates(self) -> RuleDefinition:
        if self.applies_from_verified and self.applies_from is None:
            raise ValueError("applies_from_verified without applies_from")
        if self.applies_from and self.applies_until and self.applies_until < self.applies_from:
            raise ValueError("applies_until before applies_from")
        return self

    def param(self, name: str) -> Parameter:
        try:
            return self.parameters[name]
        except KeyError as exc:
            raise KeyError(f"{self.rule_id}: missing parameter {name!r}") from exc

    def unverified_items(self, source: LegalSource) -> list[str]:
        """Everything that blocks a definite outcome, as UPPER_SNAKE reason codes."""
        items: list[str] = []
        if source.status is not SourceStatus.VERIFIED:
            items.append(f"SOURCE_{source.status.value}")
        if not self.provision.verified:
            items.append("PROVISION_UNVERIFIED")
        if not self.applies_from_verified:
            items.append("APPLICATION_DATE_UNVERIFIED")
        if not self.scope_verified:
            items.append("SCOPE_UNVERIFIED")
        if not self.exceptions_verified:
            items.append("EXCEPTIONS_UNVERIFIED")
        if self.interpretation_status is not InterpretationStatus.VERIFIED:
            items.append(f"INTERPRETATION_{self.interpretation_status.value}")
        items.extend(
            f"PARAMETER_UNVERIFIED_{name.upper()}"
            for name, p in sorted(self.parameters.items())
            if not p.verified
        )
        return items


class RuleResult(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    rule_id: str
    rule_version: int
    as_of: date
    outcome: Outcome
    #: What the encoded logic yields when every input it needs is present; None if it could
    #: not run. Only meaningful for review: never act on it while `outcome` is not definite.
    provisional_outcome: Outcome | None
    reasons: tuple[str, ...]
    computed: dict[str, str] = Field(default_factory=dict)
    citation: str
    source_url: str
    source_sha256: str | None
    exceptions: tuple[str, ...]
    review_required: bool

    @field_validator("reasons")
    @classmethod
    def _reasons(cls, v: tuple[str, ...]) -> tuple[str, ...]:
        for r in v:
            if not REASON_RE.match(r):
                raise ValueError(f"reason must be UPPER_SNAKE: {r!r}")
        return v


class Pack(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    pack_id: str
    pack_version: int = Field(..., ge=1)
    disclaimer: str = Field(..., min_length=1)
    sources: tuple[LegalSource, ...]
    rules: tuple[RuleDefinition, ...]

    @model_validator(mode="after")
    def _refs(self) -> Pack:
        ids = [s.source_id for s in self.sources]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate source_id")
        rule_keys = [(r.rule_id, r.version) for r in self.rules]
        if len(rule_keys) != len(set(rule_keys)):
            raise ValueError("duplicate rule_id/version")
        for r in self.rules:
            if r.provision.source_id not in ids:
                raise ValueError(f"{r.rule_id}: unknown source {r.provision.source_id}")
        return self

    def source(self, source_id: str) -> LegalSource:
        return next(s for s in self.sources if s.source_id == source_id)

    def rule(self, rule_id: str, version: int | None = None) -> RuleDefinition:
        matches = [r for r in self.rules if r.rule_id == rule_id]
        if version is not None:
            matches = [r for r in matches if r.version == version]
        if not matches:
            raise KeyError(rule_id)
        return max(matches, key=lambda r: r.version)
