"""Calendar-day deadlines and periodic review intervals.

Day counting, timezone handling and leap-day handling are rule parameters, never silent
defaults: how the primary text counts periods is a legal question.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.rules.gate import Evaluation, finalize
from app.rules.model import LegalSource, Outcome, RuleDefinition, RuleResult

DateLike = date | datetime


class _NeedsEvidence(Exception):
    def __init__(self, reason: str, outcome: Outcome = Outcome.INSUFFICIENT_EVIDENCE) -> None:
        super().__init__(reason)
        self.reason = reason
        self.outcome = outcome


def to_local_date(value: DateLike, rule: RuleDefinition) -> date:
    """A date stays a date. A datetime must be timezone-aware and is read in the rule's zone."""
    if isinstance(value, datetime):
        if value.tzinfo is None or value.utcoffset() is None:
            raise _NeedsEvidence("TIMEZONE_UNKNOWN")
        zone = rule.param("reference_timezone").value
        if not zone:
            raise _NeedsEvidence("REFERENCE_TIMEZONE_UNDETERMINED", Outcome.NOT_DETERMINED)
        return value.astimezone(ZoneInfo(str(zone))).date()
    return value


def add_years(start: date, years: int, leap_day_rule: str) -> date:
    """Anniversary arithmetic. Feb 29 + n years lands on Feb 28 or Mar 1 per the rule."""
    try:
        return start.replace(year=start.year + years)
    except ValueError:  # Feb 29 into a non-leap year
        if leap_day_rule == "FEB_28":
            return date(start.year + years, 2, 28)
        if leap_day_rule == "MAR_1":
            return date(start.year + years, 3, 1)
        raise ValueError(f"unknown leap_day_rule {leap_day_rule!r}") from None


def evaluate_deadline(
    rule: RuleDefinition,
    source: LegalSource,
    as_of: date,
    *,
    trigger: DateLike | None,
    action: DateLike | None,
    exception_claimed: str | None = None,
) -> RuleResult:
    """PASS = the action was taken within the period that started with the trigger."""
    return finalize(rule, source, as_of, _deadline(rule, as_of, trigger, action, exception_claimed))


def _deadline(
    rule: RuleDefinition,
    as_of: date,
    trigger: DateLike | None,
    action: DateLike | None,
    exception_claimed: str | None,
) -> Evaluation:
    if exception_claimed is not None:
        known = exception_claimed in rule.exceptions
        return Evaluation(
            Outcome.HUMAN_REVIEW_REQUIRED,
            ("EXCEPTION_CLAIMED" if known else "UNKNOWN_EXCEPTION_CLAIMED",),
        )
    if trigger is None:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("TRIGGER_DATE_MISSING",))
    counting = rule.param("counting").value
    if counting != "DAY_AFTER_TRIGGER":
        return Evaluation(Outcome.NOT_DETERMINED, ("UNSUPPORTED_DAY_COUNTING",))
    period = int(rule.param("period_days").decimal())
    try:
        start = to_local_date(trigger, rule)
        done = to_local_date(action, rule) if action is not None else None
    except _NeedsEvidence as e:
        return Evaluation(e.outcome, (e.reason,))

    # DAY_AFTER_TRIGGER: day 1 is the day after the trigger, so the last day is trigger + period.
    deadline = start + timedelta(days=period)
    computed = {"trigger": start.isoformat(), "deadline": deadline.isoformat()}
    if done is not None:
        computed["action"] = done.isoformat()
        computed["day_of_period"] = str((done - start).days)
        if done < start:
            return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("ACTION_BEFORE_TRIGGER",), computed)
        if done <= deadline:
            return Evaluation(Outcome.PASS, ("ACTION_WITHIN_PERIOD",), computed)
        return Evaluation(Outcome.FAIL, ("ACTION_AFTER_PERIOD",), computed)
    if as_of <= deadline:
        return Evaluation(Outcome.NOT_DETERMINED, ("PERIOD_STILL_RUNNING",), computed)
    return Evaluation(Outcome.FAIL, ("PERIOD_ELAPSED_WITHOUT_ACTION",), computed)


RISK_PARAMS = {"HIGH": "high_risk_interval_years", "STANDARD": "standard_interval_years"}


def evaluate_review_cycle(
    rule: RuleDefinition,
    source: LegalSource,
    as_of: date,
    *,
    risk: str | None,
    last_review: date | None,
    material_change: date | None = None,
) -> RuleResult:
    """PASS = customer information was reviewed within the maximum interval for its risk class."""
    return finalize(rule, source, as_of, _review(rule, as_of, risk, last_review, material_change))


def _review(
    rule: RuleDefinition,
    as_of: date,
    risk: str | None,
    last_review: date | None,
    material_change: date | None,
) -> Evaluation:
    if risk not in RISK_PARAMS:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("RISK_CLASSIFICATION_UNKNOWN",))
    if last_review is None:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("LAST_REVIEW_DATE_MISSING",))
    if last_review > as_of:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("LAST_REVIEW_AFTER_AS_OF",))
    years = int(rule.param(RISK_PARAMS[risk]).decimal())
    leap_rule = rule.param("leap_day_rule").value
    try:
        due = add_years(last_review, years, str(leap_rule))
    except ValueError:
        return Evaluation(Outcome.NOT_DETERMINED, ("LEAP_DAY_RULE_UNDETERMINED",))
    computed = {
        "risk": risk,
        "last_review": last_review.isoformat(),
        "review_due": due.isoformat(),
        "interval_years": str(years),
    }
    if material_change is not None and last_review < material_change <= as_of:
        # An event-driven update is owed; when exactly it falls due is not encoded.
        computed["material_change"] = material_change.isoformat()
        return Evaluation(
            Outcome.HUMAN_REVIEW_REQUIRED, ("MATERIAL_CHANGE_SINCE_LAST_REVIEW",), computed
        )
    if as_of <= due:
        return Evaluation(Outcome.PASS, ("WITHIN_REVIEW_INTERVAL",), computed)
    return Evaluation(Outcome.FAIL, ("REVIEW_OVERDUE",), computed)
