"""Monetary thresholds: crypto occasional transactions, cash ceiling, high-value reporting.

All amounts are Decimal. Non-EUR amounts need explicit conversion evidence; linked
transactions are grouped by the caller (linkage is a factual finding, not inferred here).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.rules.gate import Evaluation, finalize
from app.rules.model import LegalSource, Outcome, RuleDefinition, RuleResult, to_decimal


@dataclass(frozen=True)
class FxEvidence:
    """Rate converting one unit of `currency` into EUR, with where it came from."""

    currency: str
    eur_per_unit: str
    source: str
    rate_date: date


@dataclass(frozen=True)
class Amount:
    value: str | int
    currency: str
    fx: FxEvidence | None = None


class _Missing(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def to_eur(amount: Amount) -> Decimal:
    value = to_decimal(amount.value)
    if value < 0:
        raise ValueError("amount must not be negative")
    currency = amount.currency.strip().upper()
    if currency == "EUR":
        return value
    fx = amount.fx
    if fx is None or fx.currency.strip().upper() != currency or not fx.source.strip():
        raise _Missing("CONVERSION_RATE_EVIDENCE_MISSING")
    rate = to_decimal(fx.eur_per_unit)
    if rate <= 0:
        raise _Missing("CONVERSION_RATE_INVALID")
    return value * rate


def _meets(value: Decimal, threshold: Decimal, comparison: str) -> bool:
    if comparison == "GTE":
        return value >= threshold
    if comparison == "GT":
        return value > threshold
    raise ValueError(f"unknown comparison {comparison!r}")


def _types(rule: RuleDefinition, name: str) -> frozenset[str]:
    raw = rule.param(name).value
    return frozenset(t.strip() for t in str(raw or "").split(",") if t.strip())


def _fmt(d: Decimal) -> str:
    return format(d.normalize(), "f") if d == d.to_integral() else format(d, "f")


# --------------------------------------------------------------------------- crypto CDD


def evaluate_crypto_occasional(
    rule: RuleDefinition,
    source: LegalSource,
    as_of: date,
    *,
    transaction_type: str | None,
    linked_amounts: tuple[Amount, ...],
) -> RuleResult:
    """PASS = the (linked) occasional transaction reaches the full-CDD threshold."""
    return finalize(rule, source, as_of, _crypto(rule, transaction_type, linked_amounts))


def _crypto(
    rule: RuleDefinition, transaction_type: str | None, linked: tuple[Amount, ...]
) -> Evaluation:
    if transaction_type is None:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("TRANSACTION_TYPE_MISSING",))
    if transaction_type not in _types(rule, "covered_transaction_types"):
        return Evaluation(Outcome.NOT_APPLICABLE, ("TRANSACTION_TYPE_NOT_COVERED",))
    if not linked:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("AMOUNT_MISSING",))
    try:
        total = sum((to_eur(a) for a in linked), Decimal(0))
    except _Missing as e:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, (e.reason,))
    threshold = rule.param("threshold_eur").decimal()
    comparison = str(rule.param("comparison").value)
    computed = {
        "total_eur": _fmt(total),
        "linked_transactions": str(len(linked)),
        "threshold_eur": _fmt(threshold),
        "comparison": comparison,
    }
    if _meets(total, threshold, comparison):
        return Evaluation(Outcome.PASS, ("CDD_THRESHOLD_REACHED",), computed)
    # Below the threshold other identification/verification duties may still apply; they are
    # separate rules and must not be read as "no obligation".
    return Evaluation(
        Outcome.FAIL,
        ("BELOW_CDD_THRESHOLD", "BELOW_THRESHOLD_OBLIGATIONS_EVALUATED_SEPARATELY"),
        computed,
    )


# --------------------------------------------------------------------------- cash ceiling


@dataclass(frozen=True)
class NationalOverlay:
    country: str
    #: Stricter national limit in EUR; None means "verified: no stricter limit".
    limit_eur: str | None
    verified: bool
    source_ref: str


def evaluate_cash_limit(
    rule: RuleDefinition,
    source: LegalSource,
    as_of: date,
    *,
    amount: Amount,
    country: str | None,
    professional_context: bool | None,
    overlays: dict[str, NationalOverlay],
) -> RuleResult:
    """PASS = the cash payment is within the applicable limit (EU and verified national)."""
    return finalize(
        rule, source, as_of, _cash(rule, amount, country, professional_context, overlays)
    )


def _cash(
    rule: RuleDefinition,
    amount: Amount,
    country: str | None,
    professional_context: bool | None,
    overlays: dict[str, NationalOverlay],
) -> Evaluation:
    if professional_context is None:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("PROFESSIONAL_CONTEXT_UNKNOWN",))
    if professional_context is False:
        return Evaluation(Outcome.NOT_APPLICABLE, ("OUTSIDE_PROFESSIONAL_CONTEXT",))
    if not country:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("COUNTRY_MISSING",))
    try:
        eur = to_eur(amount)
    except _Missing as e:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, (e.reason,))
    eu_limit = rule.param("eu_limit_eur").decimal()
    prohibited = str(rule.param("prohibited_comparison").value)
    computed = {"amount_eur": _fmt(eur), "eu_limit_eur": _fmt(eu_limit), "country": country}

    if _meets(eur, eu_limit, prohibited):
        return Evaluation(Outcome.FAIL, ("EXCEEDS_EU_CASH_LIMIT",), computed)

    overlay = overlays.get(country.upper())
    if overlay is None or not overlay.verified:
        reason = (
            "NATIONAL_OVERLAY_UNAVAILABLE" if overlay is None else "NATIONAL_OVERLAY_UNVERIFIED"
        )
        computed["jurisdiction_status"] = "UNRESOLVED"
        return Evaluation(Outcome.NOT_DETERMINED, (reason,), computed)
    computed["jurisdiction_status"] = "RESOLVED"
    computed["national_source"] = overlay.source_ref
    if overlay.limit_eur is None:
        return Evaluation(Outcome.PASS, ("WITHIN_EU_LIMIT", "NO_STRICTER_NATIONAL_LIMIT"), computed)
    national = to_decimal(overlay.limit_eur)
    effective = min(national, eu_limit)
    computed["effective_limit_eur"] = _fmt(effective)
    if _meets(eur, effective, prohibited):
        return Evaluation(Outcome.FAIL, ("EXCEEDS_NATIONAL_CASH_LIMIT",), computed)
    return Evaluation(Outcome.PASS, ("WITHIN_EFFECTIVE_LIMIT",), computed)


# --------------------------------------------------------------------------- high-value goods

#: Only these categories carry a candidate reporting threshold. Other high-value goods are
#: NOT inferred to have equivalent reporting.
CATEGORY_PARAMS = {
    "MOTOR_VEHICLE": "motor_vehicle_threshold_eur",
    "WATERCRAFT": "watercraft_threshold_eur",
    "AIRCRAFT": "aircraft_threshold_eur",
}


def evaluate_high_value_reporting(
    rule: RuleDefinition,
    source: LegalSource,
    as_of: date,
    *,
    category: str | None,
    amount: Amount | None,
    non_commercial_use: bool | None,
) -> RuleResult:
    """PASS = the acquisition falls within the reporting obligation."""
    return finalize(rule, source, as_of, _high_value(rule, category, amount, non_commercial_use))


def _high_value(
    rule: RuleDefinition, category: str | None, amount: Amount | None, non_commercial: bool | None
) -> Evaluation:
    if category is None:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("CATEGORY_MISSING",))
    if category not in CATEGORY_PARAMS:
        return Evaluation(Outcome.NOT_APPLICABLE, ("CATEGORY_NOT_COVERED",))
    if non_commercial is None:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("USE_PURPOSE_UNKNOWN",))
    if non_commercial is False:
        return Evaluation(Outcome.NOT_APPLICABLE, ("COMMERCIAL_ACQUISITION",))
    if amount is None:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("AMOUNT_MISSING",))
    try:
        eur = to_eur(amount)
    except _Missing as e:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, (e.reason,))
    threshold = rule.param(CATEGORY_PARAMS[category]).decimal()
    comparison = str(rule.param("comparison").value)
    computed = {
        "category": category,
        "amount_eur": _fmt(eur),
        "threshold_eur": _fmt(threshold),
        "comparison": comparison,
    }
    if _meets(eur, threshold, comparison):
        return Evaluation(Outcome.PASS, ("REPORTING_THRESHOLD_REACHED",), computed)
    return Evaluation(Outcome.FAIL, ("BELOW_REPORTING_THRESHOLD",), computed)
