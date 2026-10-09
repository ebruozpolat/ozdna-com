from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest
from rules_support import SYNTHETIC_SOURCE, T0, pack_rule, synthetic

from app.rules.model import Outcome
from app.rules.periods import add_years, evaluate_deadline, evaluate_review_cycle

UPDATE = "eu_amlr_bo_register_update_deadline"
DISCREPANCY = "eu_amlr_bo_discrepancy_report_deadline"
REVIEW = "eu_amlr_cdd_review_interval"
TRIGGER = date(2030, 3, 1)
AS_OF = date(2030, 12, 31)


def deadline(rule_id: str, *, trigger, action, as_of=AS_OF, overrides=None, **kw):
    rule = synthetic(rule_id, overrides=overrides)
    return evaluate_deadline(rule, SYNTHETIC_SOURCE, as_of, trigger=trigger, action=action, **kw)


# ------------------------------------------------------------ BO register update (28 days)


@pytest.mark.parametrize(
    ("day", "expected"), [(27, Outcome.PASS), (28, Outcome.PASS), (29, Outcome.FAIL)]
)
def test_bo_update_day_27_28_29(day: int, expected: Outcome) -> None:
    result = deadline(UPDATE, trigger=TRIGGER, action=TRIGGER + timedelta(days=day))
    assert result.outcome is expected
    assert result.computed["day_of_period"] == str(day)


# ------------------------------------------------------------ discrepancy report (14 days)


@pytest.mark.parametrize(
    ("day", "expected"), [(13, Outcome.PASS), (14, Outcome.PASS), (15, Outcome.FAIL)]
)
def test_discrepancy_day_13_14_15(day: int, expected: Outcome) -> None:
    result = deadline(DISCREPANCY, trigger=TRIGGER, action=TRIGGER + timedelta(days=day))
    assert result.outcome is expected


def test_missing_trigger_is_insufficient_evidence() -> None:
    result = deadline(UPDATE, trigger=None, action=TRIGGER)
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE
    assert "TRIGGER_DATE_MISSING" in result.reasons


def test_period_still_running_is_not_a_failure() -> None:
    result = deadline(UPDATE, trigger=TRIGGER, action=None, as_of=TRIGGER + timedelta(days=28))
    assert result.outcome is Outcome.NOT_DETERMINED


def test_period_elapsed_without_action_fails() -> None:
    result = deadline(UPDATE, trigger=TRIGGER, action=None, as_of=TRIGGER + timedelta(days=29))
    assert result.outcome is Outcome.FAIL


def test_naive_datetime_is_rejected_as_timezone_unknown() -> None:
    result = deadline(UPDATE, trigger=datetime(2030, 3, 1, 23, 30), action=TRIGGER)
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE
    assert "TIMEZONE_UNKNOWN" in result.reasons


def test_aware_datetime_without_reference_zone_is_not_determined() -> None:
    result = deadline(UPDATE, trigger=datetime(2030, 3, 1, 23, 30, tzinfo=UTC), action=TRIGGER)
    assert result.outcome is Outcome.NOT_DETERMINED
    assert "REFERENCE_TIMEZONE_UNDETERMINED" in result.reasons


def test_aware_datetime_is_read_in_reference_zone() -> None:
    # 23:30 UTC on 1 March is 00:30 on 2 March in Brussels: day 28 moves accordingly.
    trigger = datetime(2030, 3, 1, 23, 30, tzinfo=UTC)
    tz = {"reference_timezone": "Europe/Brussels"}
    on_time = deadline(UPDATE, trigger=trigger, action=date(2030, 3, 30), overrides=tz)
    late = deadline(UPDATE, trigger=trigger, action=date(2030, 3, 31), overrides=tz)
    assert on_time.computed["trigger"] == "2030-03-02"
    assert on_time.outcome is Outcome.PASS
    assert late.outcome is Outcome.FAIL


def test_claimed_exception_goes_to_human_review() -> None:
    rule = synthetic(UPDATE, exceptions=("SYNTHETIC_EXCEPTION",))
    result = evaluate_deadline(
        rule,
        SYNTHETIC_SOURCE,
        AS_OF,
        trigger=TRIGGER,
        action=TRIGGER + timedelta(days=40),
        exception_claimed="SYNTHETIC_EXCEPTION",
    )
    assert result.outcome is Outcome.HUMAN_REVIEW_REQUIRED
    assert result.exceptions == ("SYNTHETIC_EXCEPTION",)


def test_pack_deadline_rule_is_not_definite() -> None:
    rule, source = pack_rule(UPDATE)
    result = evaluate_deadline(rule, source, AS_OF, trigger=TRIGGER, action=TRIGGER)
    assert result.outcome not in (Outcome.PASS, Outcome.FAIL)


# ------------------------------------------------------------ CDD review interval


def review(*, risk, last_review, as_of, material_change=None, leap="FEB_28"):
    rule = synthetic(REVIEW, overrides={"leap_day_rule": leap})
    return evaluate_review_cycle(
        rule,
        SYNTHETIC_SOURCE,
        as_of,
        risk=risk,
        last_review=last_review,
        material_change=material_change,
    )


@pytest.mark.parametrize(
    ("as_of", "expected"),
    [(date(2031, 6, 15), Outcome.PASS), (date(2031, 6, 16), Outcome.FAIL)],
)
def test_high_risk_one_year_boundary(as_of: date, expected: Outcome) -> None:
    assert review(risk="HIGH", last_review=date(2030, 6, 15), as_of=as_of).outcome is expected


@pytest.mark.parametrize(
    ("as_of", "expected"),
    [(date(2035, 6, 15), Outcome.PASS), (date(2035, 6, 16), Outcome.FAIL)],
)
def test_standard_five_year_boundary(as_of: date, expected: Outcome) -> None:
    assert review(risk="STANDARD", last_review=date(2030, 6, 15), as_of=as_of).outcome is expected


def test_leap_day_anniversary_feb_28() -> None:
    result = review(risk="HIGH", last_review=date(2032, 2, 29), as_of=date(2033, 2, 28))
    assert result.computed["review_due"] == "2033-02-28"
    assert result.outcome is Outcome.PASS
    late = review(risk="HIGH", last_review=date(2032, 2, 29), as_of=date(2033, 3, 1))
    assert late.outcome is Outcome.FAIL


def test_leap_day_anniversary_mar_1() -> None:
    result = review(
        risk="HIGH", last_review=date(2032, 2, 29), as_of=date(2033, 3, 1), leap="MAR_1"
    )
    assert result.computed["review_due"] == "2033-03-01"
    assert result.outcome is Outcome.PASS


def test_leap_day_without_rule_is_not_determined() -> None:
    result = review(risk="HIGH", last_review=date(2032, 2, 29), as_of=date(2033, 1, 1), leap=None)
    assert result.outcome is Outcome.NOT_DETERMINED


def test_add_years_regular_and_leap() -> None:
    assert add_years(date(2030, 6, 15), 5, "FEB_28") == date(2035, 6, 15)
    assert add_years(date(2032, 2, 29), 4, "FEB_28") == date(2036, 2, 29)


def test_material_change_before_scheduled_review_needs_review() -> None:
    result = review(
        risk="STANDARD",
        last_review=date(2030, 6, 15),
        as_of=date(2031, 1, 10),
        material_change=date(2031, 1, 5),
    )
    assert result.outcome is Outcome.HUMAN_REVIEW_REQUIRED
    assert "MATERIAL_CHANGE_SINCE_LAST_REVIEW" in result.reasons


def test_unknown_risk_classification_is_insufficient_evidence() -> None:
    result = review(risk=None, last_review=date(2030, 6, 15), as_of=date(2030, 7, 1))
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE


def test_unrecognised_risk_label_is_not_defaulted() -> None:
    result = review(risk="LOW", last_review=date(2030, 6, 15), as_of=date(2030, 7, 1))
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE


def test_missing_last_review_is_insufficient_evidence() -> None:
    result = review(risk="HIGH", last_review=None, as_of=date(2030, 7, 1))
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE
    assert "LAST_REVIEW_DATE_MISSING" in result.reasons


def test_review_rule_before_application_date() -> None:
    result = review(risk="HIGH", last_review=date(2029, 1, 1), as_of=T0 - timedelta(days=1))
    assert result.outcome is Outcome.NOT_DETERMINED
