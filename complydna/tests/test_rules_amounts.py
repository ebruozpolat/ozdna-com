from __future__ import annotations

from datetime import date

import pytest
from rules_support import SYNTHETIC_SOURCE, T0, pack_rule, synthetic

from app.rules.amounts import (
    Amount,
    FxEvidence,
    NationalOverlay,
    evaluate_cash_limit,
    evaluate_crypto_occasional,
    evaluate_high_value_reporting,
)
from app.rules.model import Outcome

CRYPTO = "eu_amlr_crypto_occasional_cdd"
CASH = "eu_amlr_cash_payment_limit"
HIGH = "eu_amlr_high_value_reporting"
EUR = "EUR"


def eur(v: str) -> Amount:
    return Amount(v, EUR)


# ------------------------------------------------------------ crypto occasional CDD


def crypto(*amounts: Amount, tx_type: str | None = "CRYPTO_ASSET_TRANSFER"):
    return evaluate_crypto_occasional(
        synthetic(CRYPTO), SYNTHETIC_SOURCE, T0, transaction_type=tx_type, linked_amounts=amounts
    )


@pytest.mark.parametrize(
    ("value", "expected"),
    [("999.99", Outcome.FAIL), ("1000.00", Outcome.PASS), ("1000.01", Outcome.PASS)],
)
def test_crypto_threshold_boundary(value: str, expected: Outcome) -> None:
    assert crypto(eur(value)).outcome is expected


def test_below_threshold_flags_separate_obligations() -> None:
    result = crypto(eur("999.99"))
    assert "BELOW_THRESHOLD_OBLIGATIONS_EVALUATED_SEPARATELY" in result.reasons


def test_linked_transactions_are_aggregated() -> None:
    result = crypto(eur("600.00"), eur("400.00"))
    assert result.computed["total_eur"] == "1000"
    assert result.outcome is Outcome.PASS


def test_missing_conversion_rate_is_insufficient_evidence() -> None:
    result = crypto(Amount("1200", "USD"))
    assert result.outcome is Outcome.INSUFFICIENT_EVIDENCE
    assert "CONVERSION_RATE_EVIDENCE_MISSING" in result.reasons


def test_conversion_with_evidence() -> None:
    fx = FxEvidence("USD", "0.85", "synthetic-rate-feed", date(2030, 1, 1))
    below = crypto(Amount("1176.47", "USD", fx))  # 999.9995 EUR
    above = crypto(Amount("1176.48", "USD", fx))  # 1000.008 EUR
    assert below.computed["total_eur"] == "999.9995"
    assert below.outcome is Outcome.FAIL
    assert above.outcome is Outcome.PASS


def test_uncovered_transaction_type_not_applicable() -> None:
    assert crypto(eur("5000"), tx_type="CARD_PAYMENT").outcome is Outcome.NOT_APPLICABLE


def test_missing_transaction_type_insufficient() -> None:
    assert crypto(eur("5000"), tx_type=None).outcome is Outcome.INSUFFICIENT_EVIDENCE


# ------------------------------------------------------------ cash ceiling


NO_STRICTER = {"XA": NationalOverlay("XA", None, True, "synthetic national source")}
STRICTER = {"XB": NationalOverlay("XB", "3000", True, "synthetic national source")}


def cash(value: str, *, country: str | None = "XA", overlays=NO_STRICTER, professional=True):
    return evaluate_cash_limit(
        synthetic(CASH),
        SYNTHETIC_SOURCE,
        T0,
        amount=eur(value),
        country=country,
        professional_context=professional,
        overlays=overlays,
    )


@pytest.mark.parametrize(
    ("value", "expected"),
    [("9999.99", Outcome.PASS), ("10000.00", Outcome.FAIL), ("10000.01", Outcome.FAIL)],
)
def test_cash_eu_limit_boundary(value: str, expected: Outcome) -> None:
    assert cash(value).outcome is expected


@pytest.mark.parametrize(
    ("value", "expected"),
    [("2999.99", Outcome.PASS), ("3000.00", Outcome.FAIL), ("9000.00", Outcome.FAIL)],
)
def test_cash_stricter_national_limit(value: str, expected: Outcome) -> None:
    result = cash(value, country="XB", overlays=STRICTER)
    assert result.outcome is expected
    assert result.computed["jurisdiction_status"] == "RESOLVED"


def test_missing_national_overlay_is_unresolved() -> None:
    result = cash("2000", country="XC")
    assert result.outcome is Outcome.NOT_DETERMINED
    assert result.computed["jurisdiction_status"] == "UNRESOLVED"


def test_unverified_national_overlay_is_not_applied() -> None:
    overlays = {"XD": NationalOverlay("XD", "1000", False, "unverified")}
    result = cash("2000", country="XD", overlays=overlays)
    assert result.outcome is Outcome.NOT_DETERMINED
    assert "NATIONAL_OVERLAY_UNVERIFIED" in result.reasons


def test_eu_limit_breach_does_not_depend_on_overlay() -> None:
    assert cash("15000", country="XC").outcome is Outcome.FAIL


def test_missing_country_is_insufficient() -> None:
    assert cash("2000", country=None).outcome is Outcome.INSUFFICIENT_EVIDENCE


def test_non_professional_context_not_applicable() -> None:
    assert cash("50000", professional=False).outcome is Outcome.NOT_APPLICABLE


def test_unknown_professional_context_insufficient() -> None:
    assert cash("50000", professional=None).outcome is Outcome.INSUFFICIENT_EVIDENCE


# ------------------------------------------------------------ high-value goods reporting


def high(category: str | None, value: str | None, non_commercial: bool | None = True):
    return evaluate_high_value_reporting(
        synthetic(HIGH),
        SYNTHETIC_SOURCE,
        T0,
        category=category,
        amount=eur(value) if value is not None else None,
        non_commercial_use=non_commercial,
    )


@pytest.mark.parametrize(
    ("category", "value", "expected"),
    [
        ("MOTOR_VEHICLE", "249999.99", Outcome.FAIL),
        ("MOTOR_VEHICLE", "250000.00", Outcome.PASS),
        ("WATERCRAFT", "7499999.99", Outcome.FAIL),
        ("WATERCRAFT", "7500000.00", Outcome.PASS),
        ("AIRCRAFT", "7499999.99", Outcome.FAIL),
        ("AIRCRAFT", "7500000.00", Outcome.PASS),
    ],
)
def test_high_value_category_thresholds(category: str, value: str, expected: Outcome) -> None:
    assert high(category, value).outcome is expected


def test_motor_vehicle_threshold_not_applied_to_aircraft() -> None:
    # 300k reaches the motor-vehicle threshold but not the aircraft one.
    assert high("AIRCRAFT", "300000").outcome is Outcome.FAIL


def test_other_high_value_goods_are_not_inferred() -> None:
    result = high("JEWELLERY", "9000000")
    assert result.outcome is Outcome.NOT_APPLICABLE
    assert "CATEGORY_NOT_COVERED" in result.reasons


def test_commercial_acquisition_not_applicable() -> None:
    assert high("MOTOR_VEHICLE", "300000", non_commercial=False).outcome is Outcome.NOT_APPLICABLE


def test_unknown_use_purpose_insufficient() -> None:
    assert high("MOTOR_VEHICLE", "300000", non_commercial=None).outcome is (
        Outcome.INSUFFICIENT_EVIDENCE
    )


def dated(rule_id: str):
    rule, source = pack_rule(rule_id)
    return rule.model_copy(update={"applies_from": T0}), source


def test_pack_amount_rules_are_not_definite() -> None:
    rule, source = dated(CRYPTO)
    crypto_result = evaluate_crypto_occasional(
        rule, source, T0, transaction_type="CRYPTO_ASSET_TRANSFER", linked_amounts=(eur("5000"),)
    )
    rule, source = dated(CASH)
    cash_result = evaluate_cash_limit(
        rule,
        source,
        T0,
        amount=eur("15000"),
        country="XA",
        professional_context=True,
        overlays=NO_STRICTER,
    )
    rule, source = dated(HIGH)
    high_result = evaluate_high_value_reporting(
        rule, source, T0, category="MOTOR_VEHICLE", amount=eur("300000"), non_commercial_use=True
    )
    for result, provisional in (
        (crypto_result, Outcome.PASS),
        (cash_result, Outcome.FAIL),
        (high_result, Outcome.PASS),
    ):
        assert result.outcome is Outcome.HUMAN_REVIEW_REQUIRED
        assert result.provisional_outcome is provisional
        assert "SOURCE_NOT_ACQUIRED" in result.reasons
