from __future__ import annotations

from datetime import date

from rules_support import SYNTHETIC_SOURCE, T0, pack_rule, synthetic

from app.rules.model import Outcome
from app.rules.supervision import evaluate_direct_supervision, evaluate_sector_scope

AMLA = "eu_amla_direct_supervision"
FOOTBALL = "eu_amlr_football_scope"
#: Synthetic deferred date mirroring the brief's candidate (10 July 2029); test input only.
DEFERRED = date(2029, 7, 10)


def amla(selected: bool | None, as_of: date = T0):
    return evaluate_direct_supervision(synthetic(AMLA), SYNTHETIC_SOURCE, as_of, selected=selected)


def test_selected_entity_is_directly_supervised() -> None:
    assert amla(True).outcome is Outcome.PASS


def test_unselected_entity_keeps_national_supervision() -> None:
    result = amla(False)
    assert result.outcome is Outcome.FAIL
    assert result.computed["national_supervision"] == "RETAINED"


def test_unknown_selection_is_not_assumed() -> None:
    result = amla(None)
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE


def test_direct_supervision_before_start_is_not_determined() -> None:
    assert amla(True, as_of=date(2029, 12, 31)).outcome is Outcome.NOT_DETERMINED


def football(as_of: date, in_scope: bool | None = True):
    rule = synthetic(FOOTBALL, applies_from=DEFERRED)
    return evaluate_sector_scope(rule, SYNTHETIC_SOURCE, as_of, in_scope=in_scope)


def test_football_not_applicable_in_2028() -> None:
    result = football(date(2028, 7, 10))
    assert result.outcome is Outcome.NOT_APPLICABLE
    assert "BEFORE_DEFERRED_APPLICATION_DATE" in result.reasons


def test_football_day_before_deferred_date() -> None:
    assert football(date(2029, 7, 9)).outcome is Outcome.NOT_APPLICABLE


def test_football_applicable_on_deferred_date() -> None:
    assert football(DEFERRED).outcome is Outcome.PASS


def test_football_outside_scope() -> None:
    assert football(DEFERRED, in_scope=False).outcome is Outcome.NOT_APPLICABLE


def test_football_unknown_scope() -> None:
    assert football(DEFERRED, in_scope=None).outcome is Outcome.INSUFFICIENT_EVIDENCE


def test_pack_football_rule_without_verified_date_is_not_determined() -> None:
    rule, source = pack_rule(FOOTBALL)
    result = evaluate_sector_scope(rule, source, DEFERRED, in_scope=True)
    assert result.outcome is Outcome.NOT_DETERMINED
