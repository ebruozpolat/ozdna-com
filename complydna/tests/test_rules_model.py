from __future__ import annotations

import ast
import json
import re
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from pydantic import ValidationError
from rules_support import PACK, SYNTHETIC_SOURCE, T0, synthetic

from app.rules.gate import Evaluation, finalize
from app.rules.model import (
    LegalSource,
    Outcome,
    Pack,
    SourceKind,
    SourceStatus,
    to_decimal,
)
from app.rules.pack import PACKS_DIR, PackError, load_pack, validate_pack

PACK_DIR = PACKS_DIR / "eu_amlr_2024_1624"
TESTS = Path(__file__).parent
URL = "https://eur-lex.europa.eu/eli/reg/2024/1624/oj"


def source(**kw) -> dict:
    base = dict(
        source_id="S",
        kind=SourceKind.PRIMARY_LAW,
        legal_instrument="X",
        jurisdiction="EU",
        source_url=URL,
        status=SourceStatus.NOT_ACQUIRED,
    )
    base.update(kw)
    return base


# ------------------------------------------------------------ numbers


def test_to_decimal_accepts_exact_inputs() -> None:
    assert to_decimal("25.00") == Decimal("25")
    assert to_decimal(25) == Decimal(25)


@pytest.mark.parametrize("bad", [25.0, True, None, "NaN", "Infinity"])
def test_to_decimal_rejects_floats_and_non_finite(bad) -> None:
    with pytest.raises((TypeError, ValueError, ArithmeticError)):
        to_decimal(bad)


# ------------------------------------------------------------ provenance records


def test_not_acquired_source_cannot_carry_hash_or_time() -> None:
    with pytest.raises(ValidationError):
        LegalSource(**source(source_sha256="0" * 64))
    with pytest.raises(ValidationError):
        LegalSource(**source(retrieved_at=datetime(2030, 1, 1, tzinfo=UTC)))


def test_acquired_source_needs_hash_and_aware_time() -> None:
    acquired = SourceStatus.ACQUIRED_UNVERIFIED
    with pytest.raises(ValidationError):
        LegalSource(**source(status=acquired, retrieved_at=datetime(2030, 1, 1, tzinfo=UTC)))
    with pytest.raises(ValidationError):
        LegalSource(**source(status=acquired, source_sha256="a" * 64))
    with pytest.raises(ValidationError):
        LegalSource(
            **source(status=acquired, source_sha256="a" * 64, retrieved_at=datetime(2030, 1, 1))
        )
    with pytest.raises(ValidationError):
        LegalSource(
            **source(
                status=acquired,
                source_sha256="A" * 64,
                retrieved_at=datetime(2030, 1, 1, tzinfo=UTC),
            )
        )
    ok = LegalSource(
        **source(
            status=acquired, source_sha256="a" * 64, retrieved_at=datetime(2030, 1, 1, tzinfo=UTC)
        )
    )
    assert ok.status is acquired


# ------------------------------------------------------------ pack loader


def pack_data() -> dict:
    return json.loads((PACK_DIR / "pack.json").read_text(encoding="utf-8"))


def test_pack_loads() -> None:
    pack = load_pack("eu_amlr_2024_1624")
    assert len(pack.rules) == 10
    assert {s.status for s in pack.sources} == {SourceStatus.NOT_ACQUIRED}


def test_pack_rejects_synthetic_sources() -> None:
    data = pack_data()
    data["sources"].append(SYNTHETIC_SOURCE.model_dump(mode="json"))
    with pytest.raises(PackError):
        validate_pack(Pack.model_validate(data))


def test_pack_rejects_verified_claims_without_verified_source() -> None:
    data = pack_data()
    data["rules"][0]["parameters"]["threshold_percent"]["verified"] = True
    with pytest.raises(PackError, match="parameter threshold_percent"):
        validate_pack(Pack.model_validate(data))
    data = pack_data()
    data["rules"][0]["provision"] = {
        "source_id": "EU-AMLR-2024-1624",
        "article": "52",
        "verified": True,
    }
    with pytest.raises(PackError, match="provision"):
        validate_pack(Pack.model_validate(data))


def test_pack_rejects_review_not_required_on_unverified_rule() -> None:
    data = pack_data()
    data["rules"][0]["review_required"] = False
    with pytest.raises(PackError):
        validate_pack(Pack.model_validate(data))


def test_every_pack_rule_is_unverified_and_cites_no_article() -> None:
    for rule in PACK.rules:
        src = PACK.source(rule.provision.source_id)
        assert rule.provision.article is None
        assert rule.applies_from is None
        assert rule.review_required
        assert rule.unverified_items(src)
        assert "VERIFY_FROM_PRIMARY_SOURCE" in rule.provision.citation()
        assert all(not p.verified and p.origin == "candidate" for p in rule.parameters.values())


# ------------------------------------------------------------ gate


def test_after_application_period_not_applicable() -> None:
    rule = synthetic("eu_amlr_football_scope", applies_until=date(2030, 12, 31))
    result = finalize(rule, SYNTHETIC_SOURCE, date(2031, 1, 1), Evaluation(Outcome.PASS))
    assert result.outcome is Outcome.NOT_APPLICABLE
    assert "AFTER_APPLICATION_PERIOD" in result.reasons


def test_gate_rejects_mismatched_source() -> None:
    rule = PACK.rule("eu_amlr_cash_payment_limit")
    with pytest.raises(ValueError):
        finalize(rule, SYNTHETIC_SOURCE, T0, Evaluation(Outcome.PASS))


def test_reason_codes_must_be_upper_snake() -> None:
    rule = synthetic("eu_amlr_football_scope")
    with pytest.raises(ValidationError):
        finalize(rule, SYNTHETIC_SOURCE, T0, Evaluation(Outcome.PASS, ("not snake",)))


# ------------------------------------------------------------ claims language

BANNED = re.compile(
    r"\b(compliant|guarantee[sd]?|certified|certifies|ensures? compliance|production[- ]ready)\b",
    re.IGNORECASE,
)
NEGATED_OK = re.compile(r"does not establish|not legal advice|not a legal certification", re.I)


def test_pack_outputs_contain_no_compliance_claims() -> None:
    for path in (PACK_DIR / "pack.json", PACK_DIR / "traceability.json"):
        for line in path.read_text(encoding="utf-8").splitlines():
            if BANNED.search(line):
                assert NEGATED_OK.search(line), f"{path.name}: {line.strip()}"
    rules_dir = Path(__file__).parents[1] / "app" / "rules"
    for py in rules_dir.glob("*.py"):
        for match in re.finditer(r'"([A-Z0-9_]{4,})"', py.read_text(encoding="utf-8")):
            assert not BANNED.search(match.group(1).replace("_", " ")), match.group(1)


# ------------------------------------------------------------ traceability


def test_traceability_matrix_is_complete() -> None:
    matrix = json.loads((PACK_DIR / "traceability.json").read_text(encoding="utf-8"))
    entries = {e["requirement_id"]: e for e in matrix["requirements"]}
    rule_ids = {r.rule_id for r in PACK.rules}
    for rule in PACK.rules:
        for req in rule.requirement_ids:
            assert req in entries, f"{rule.rule_id}: {req} missing from matrix"
            assert rule.rule_id in entries[req]["rule_ids"]
    defined: dict[str, set[str]] = {}
    for entry in entries.values():
        assert set(entry["rule_ids"]) <= rule_ids
        assert entry["tests"], entry["requirement_id"]
        src = PACK.source(entry["evidence"]["source_id"])
        assert entry["evidence"]["source_status"] == src.status.value
        if src.status is not SourceStatus.VERIFIED:
            assert "BLOCKED" in entry["status"]
        for ref in entry["tests"]:
            file, func = ref.split("::")
            if file not in defined:
                tree = ast.parse((TESTS.parent / file).read_text(encoding="utf-8"))
                defined[file] = {n.name for n in tree.body if isinstance(n, ast.FunctionDef)}
            assert func in defined[file], f"{ref} does not exist"
