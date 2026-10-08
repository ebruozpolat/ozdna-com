from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from rules_support import SYNTHETIC_SOURCE, T0, pack_rule, synthetic

from app.rules.model import Outcome
from app.rules.ownership import (
    ControlFact,
    ControlStatus,
    Edge,
    Structure,
    effective_ownership,
    evaluate_beneficial_owner,
)

AMLR = "eu_amlr_bo_ownership_or_control"
LEGACY = "eu_amld_bo_ownership_legacy"
PERSONS = frozenset({"P1", "P2"})


def direct(percent: str | None, *, control: ControlStatus | None = ControlStatus.ABSENT):
    facts = () if control is None else (ControlFact("P1", "T", control, "synthetic"),)
    return Structure("T", PERSONS, (Edge("P1", "T", percent),), facts)


def run(structure: Structure, rule_id: str = AMLR, person: str = "P1", as_of: date = T0):
    return evaluate_beneficial_owner(synthetic(rule_id), SYNTHETIC_SOURCE, as_of, structure, person)


# ------------------------------------------------------------ ownership boundaries (>= 25)


@pytest.mark.parametrize(
    ("percent", "expected"),
    [("24.99", Outcome.FAIL), ("25.00", Outcome.PASS), ("25.01", Outcome.PASS)],
)
def test_ownership_boundary_gte_25(percent: str, expected: Outcome) -> None:
    assert run(direct(percent)).outcome is expected


def test_ownership_just_below_threshold_is_not_rounded_up() -> None:
    assert run(direct("24.9999999999999999")).outcome is Outcome.FAIL


@pytest.mark.parametrize(
    ("percent", "expected"),
    [("25.00", Outcome.FAIL), ("25.01", Outcome.PASS), ("24.99", Outcome.FAIL)],
)
def test_legacy_more_than_25_regression(percent: str, expected: Outcome) -> None:
    assert run(direct(percent), rule_id=LEGACY).outcome is expected


def test_float_percentages_are_rejected() -> None:
    with pytest.raises(TypeError):
        effective_ownership(direct(25.0), "P1")  # type: ignore[arg-type]


def test_percent_out_of_range_is_rejected() -> None:
    with pytest.raises(ValueError):
        effective_ownership(direct("100.01"), "P1")


# ------------------------------------------------------------ control path


def test_zero_ownership_with_documented_control_qualifies() -> None:
    result = run(direct("0", control=ControlStatus.PRESENT))
    assert result.outcome is Outcome.PASS
    assert "CONTROL_PRESENT" in result.reasons


def test_ten_percent_with_documented_control_qualifies() -> None:
    assert run(direct("10", control=ControlStatus.PRESENT)).outcome is Outcome.PASS


def test_unknown_control_is_not_treated_as_absent() -> None:
    result = run(direct("10", control=ControlStatus.UNKNOWN))
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE
    assert "CONTROL_EVIDENCE_UNKNOWN" in result.reasons


def test_missing_control_record_is_unknown_not_absent() -> None:
    result = run(direct("10", control=None))
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE


def test_control_has_no_percentage_floor() -> None:
    # Ownership below threshold, control present: control alone decides.
    result = run(direct("0.0001", control=ControlStatus.PRESENT))
    assert result.outcome is Outcome.PASS
    assert result.reasons[0] == "CONTROL_PRESENT"


def test_ownership_threshold_met_does_not_need_control_evidence() -> None:
    assert run(direct("30", control=None)).outcome is Outcome.PASS


# ------------------------------------------------------------ indirect ownership


def chain_structure(*edges: Edge, control: ControlStatus = ControlStatus.ABSENT) -> Structure:
    return Structure("T", PERSONS, edges, (ControlFact("P1", "T", control),))


def test_single_chain_exact_boundary() -> None:
    s = chain_structure(Edge("P1", "A", "50"), Edge("A", "T", "50"))
    result = run(s)
    assert result.computed["effective_percent_lower_bound"] == "25"
    assert result.outcome is Outcome.PASS


def test_single_chain_just_below() -> None:
    s = chain_structure(Edge("P1", "A", "50"), Edge("A", "T", "49.98"))
    assert run(s).outcome is Outcome.FAIL  # 24.99


def test_multiple_chains_sum_to_exactly_25() -> None:
    s = chain_structure(
        Edge("P1", "A", "50"),
        Edge("A", "T", "30"),  # 15
        Edge("P1", "B", "40"),
        Edge("B", "T", "25"),  # 10
    )
    result = run(s)
    assert result.computed["effective_percent_lower_bound"] == "25"
    assert result.computed["chains"] == "2"
    assert result.outcome is Outcome.PASS


def test_direct_plus_indirect_aggregate() -> None:
    s = chain_structure(Edge("P1", "T", "20"), Edge("P1", "A", "50"), Edge("A", "T", "10"))
    assert run(s).outcome is Outcome.PASS  # 20 + 5


def test_repeating_decimals_compare_exactly() -> None:
    # 33.3333 * 75 / 100 = 24.999975: compared exactly, not rounded to 25.
    s = chain_structure(Edge("P1", "A", "33.3333"), Edge("A", "T", "75"))
    result = run(s)
    assert Decimal(result.computed["effective_percent_lower_bound"]) == Decimal("24.999975")
    assert result.outcome is Outcome.FAIL


def test_missing_link_below_threshold_is_insufficient_evidence() -> None:
    s = chain_structure(Edge("P1", "A", "50"), Edge("A", "T", None))
    result = run(s)
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE
    assert "UNKNOWN_OWNERSHIP_LINK" in result.reasons


def test_missing_link_does_not_block_a_chain_that_already_qualifies() -> None:
    s = chain_structure(Edge("P1", "T", "26"), Edge("P1", "A", "50"), Edge("A", "T", None))
    result = run(s)
    assert result.outcome is Outcome.PASS
    assert "DECIDED_ON_LOWER_BOUND" in result.reasons


def test_cycle_below_threshold_goes_to_human_review() -> None:
    s = chain_structure(
        Edge("P1", "A", "40"), Edge("A", "B", "50"), Edge("B", "A", "10"), Edge("B", "T", "50")
    )
    result = run(s)
    assert result.outcome is Outcome.HUMAN_REVIEW_REQUIRED
    assert result.computed["cyclic"] == "true"


def test_cycle_with_qualifying_lower_bound_passes() -> None:
    s = chain_structure(
        Edge("P1", "A", "60"), Edge("A", "B", "100"), Edge("B", "A", "10"), Edge("B", "T", "50")
    )
    result = run(s)  # simple chain 60*100*50 = 30
    assert result.outcome is Outcome.PASS
    assert "DECIDED_ON_LOWER_BOUND" in result.reasons


def test_shares_over_100_percent_are_inconsistent() -> None:
    s = chain_structure(Edge("P1", "T", "60"), Edge("P2", "T", "50"))
    assert run(s).outcome is Outcome.INSUFFICIENT_EVIDENCE


def test_unknown_person_is_not_evaluated() -> None:
    assert run(direct("30"), person="X").outcome is Outcome.INSUFFICIENT_EVIDENCE


# ------------------------------------------------------------ temporal + provenance gating


def test_before_application_date_is_not_determined() -> None:
    result = run(direct("30"), as_of=date(2029, 12, 31))
    assert result.outcome is Outcome.NOT_DETERMINED
    assert "BEFORE_APPLICATION_DATE_NO_VERIFIED_HISTORICAL_RULE" in result.reasons


def test_on_application_date_applies() -> None:
    assert run(direct("30"), as_of=T0).outcome is Outcome.PASS


def test_pack_rule_without_verified_application_date_is_not_determined() -> None:
    rule, source = pack_rule(AMLR)
    result = evaluate_beneficial_owner(rule, source, T0, direct("25.00"), "P1")
    assert result.outcome is Outcome.NOT_DETERMINED
    assert "APPLICATION_DATE_UNKNOWN" in result.reasons
    assert "SOURCE_NOT_ACQUIRED" in result.reasons
    assert result.source_sha256 is None


def test_unverified_rule_never_returns_definite_outcome() -> None:
    rule, source = pack_rule(AMLR)
    dated = rule.model_copy(update={"applies_from": T0})
    result = evaluate_beneficial_owner(dated, source, T0, direct("25.00"), "P1")
    assert result.outcome is Outcome.HUMAN_REVIEW_REQUIRED
    assert result.provisional_outcome is Outcome.PASS
    assert result.review_required
    assert "PROVISION_UNVERIFIED" in result.reasons
