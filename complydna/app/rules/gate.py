"""Temporal and provenance gate: turns an evaluator's logic outcome into the published outcome."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from app.rules.model import LegalSource, Outcome, RuleDefinition, RuleResult

#: Outcomes that assert something about the law and therefore need a verified rule.
_GATED = frozenset({Outcome.PASS, Outcome.FAIL, Outcome.NOT_APPLICABLE})


@dataclass(frozen=True)
class Evaluation:
    """What a rule's encoded logic concluded from the facts, before any gating."""

    outcome: Outcome
    reasons: tuple[str, ...] = ()
    computed: dict[str, str] = field(default_factory=dict)


def temporal(rule: RuleDefinition, as_of: date) -> Evaluation | None:
    """Outcome forced by dates alone, or None when the rule is in its application window."""
    if rule.applies_from is None:
        return Evaluation(Outcome.NOT_DETERMINED, ("APPLICATION_DATE_UNKNOWN",))
    if as_of < rule.applies_from:
        if rule.pre_application_outcome == "NOT_APPLICABLE":
            return Evaluation(Outcome.NOT_APPLICABLE, ("BEFORE_DEFERRED_APPLICATION_DATE",))
        return Evaluation(
            Outcome.NOT_DETERMINED, ("BEFORE_APPLICATION_DATE_NO_VERIFIED_HISTORICAL_RULE",)
        )
    if rule.applies_until is not None and as_of > rule.applies_until:
        return Evaluation(Outcome.NOT_APPLICABLE, ("AFTER_APPLICATION_PERIOD",))
    return None


def finalize(
    rule: RuleDefinition, source: LegalSource, as_of: date, logic: Evaluation
) -> RuleResult:
    """Apply the temporal window, then fail closed on anything unverified."""
    if source.source_id != rule.provision.source_id:
        raise ValueError("source does not match the rule's provision")
    forced = temporal(rule, as_of)
    evaluation = forced if forced is not None else logic
    computed = dict(logic.computed) if forced is None else {}
    reasons = list(evaluation.reasons)
    unverified = rule.unverified_items(source)

    if evaluation.outcome in _GATED and unverified:
        outcome = Outcome.HUMAN_REVIEW_REQUIRED
        provisional: Outcome | None = evaluation.outcome
    else:
        outcome = evaluation.outcome
        provisional = evaluation.outcome if evaluation.outcome in _GATED else None
    reasons.extend(unverified)

    return RuleResult(
        rule_id=rule.rule_id,
        rule_version=rule.version,
        as_of=as_of,
        outcome=outcome,
        provisional_outcome=provisional,
        reasons=tuple(dict.fromkeys(reasons)),
        computed=computed,
        citation=rule.provision.citation(),
        source_url=rule.source_url,
        source_sha256=source.source_sha256,
        exceptions=rule.exceptions,
        review_required=rule.review_required or outcome is not evaluation.outcome,
    )
