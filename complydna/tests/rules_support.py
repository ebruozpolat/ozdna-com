"""Synthetic rules for exercising engine mechanics.

These are NOT legal rules: they copy a pack rule, attach it to a SYNTHETIC_TEST source and
mark every item verified so PASS/FAIL paths can be tested. The pack loader rejects synthetic
sources, so none of this can reach a real pack. Dates set here are test inputs, not claims
about when any law applies.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, date, datetime

from app.rules.model import (
    InterpretationStatus,
    LegalSource,
    Parameter,
    Provision,
    RuleDefinition,
    SourceKind,
    SourceStatus,
)
from app.rules.pack import load_pack

PACK = load_pack("eu_amlr_2024_1624")
SYNTHETIC_TEXT = b"synthetic test source - not law"

SYNTHETIC_SOURCE = LegalSource(
    source_id="SYNTHETIC-TEST",
    kind=SourceKind.SYNTHETIC_TEST,
    legal_instrument="Synthetic test instrument",
    jurisdiction="TEST",
    source_url="urn:test:synthetic",
    status=SourceStatus.VERIFIED,
    source_sha256=hashlib.sha256(SYNTHETIC_TEXT).hexdigest(),
    retrieved_at=datetime(2000, 1, 1, tzinfo=UTC),
    acquisition_note="synthetic fixture for engine tests",
)

#: Arbitrary synthetic application date for tests (not a statement about any law).
T0 = date(2030, 1, 1)


def synthetic(
    rule_id: str,
    *,
    applies_from: date | None = T0,
    overrides: dict[str, str | int | None] | None = None,
    **fields: object,
) -> RuleDefinition:
    base = PACK.rule(rule_id)
    params = {
        name: Parameter(value=p.value, verified=True, origin="synthetic-test")
        for name, p in base.parameters.items()
    }
    for name, value in (overrides or {}).items():
        params[name] = Parameter(value=value, verified=True, origin="synthetic-test")
    data = base.model_dump()
    data.update(
        provision=Provision(source_id="SYNTHETIC-TEST", article="1", verified=True),
        source_url=SYNTHETIC_SOURCE.source_url,
        applies_from=applies_from,
        applies_from_verified=applies_from is not None,
        scope_verified=True,
        exceptions_verified=True,
        interpretation_status=InterpretationStatus.VERIFIED,
        review_required=False,
        parameters=params,
    )
    data.update(fields)
    return RuleDefinition.model_validate(data)


def pack_rule(rule_id: str) -> tuple[RuleDefinition, LegalSource]:
    rule = PACK.rule(rule_id)
    return rule, PACK.source(rule.provision.source_id)
