"""Supervisory and sector-scope metadata.

AMLA direct supervision is selection-dependent: an entity is directly supervised only if it
was selected; national supervision is never displaced by default. Sector rules with a
deferred application date (e.g. football agents/clubs) use the temporal gate's
NOT_APPLICABLE pre-application outcome.
"""

from __future__ import annotations

from datetime import date

from app.rules.gate import Evaluation, finalize
from app.rules.model import LegalSource, Outcome, RuleDefinition, RuleResult


def evaluate_direct_supervision(
    rule: RuleDefinition, source: LegalSource, as_of: date, *, selected: bool | None
) -> RuleResult:
    """PASS = the entity is directly supervised by AMLA on as_of."""
    if selected is None:
        logic = Evaluation(
            Outcome.INSUFFICIENT_EVIDENCE,
            ("SELECTION_STATUS_UNKNOWN",),
            {"national_supervision": "RETAINED"},
        )
    elif selected:
        logic = Evaluation(
            Outcome.PASS,
            ("SELECTED_FOR_DIRECT_SUPERVISION",),
            {"national_supervision": "NOT_ENCODED"},
        )
    else:
        logic = Evaluation(Outcome.FAIL, ("NOT_SELECTED",), {"national_supervision": "RETAINED"})
    return finalize(rule, source, as_of, logic)


def evaluate_sector_scope(
    rule: RuleDefinition, source: LegalSource, as_of: date, *, in_scope: bool | None
) -> RuleResult:
    """PASS = the rule's obligations apply to the entity on as_of."""
    if in_scope is None:
        logic = Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("SECTOR_SCOPE_UNKNOWN",))
    elif in_scope:
        logic = Evaluation(Outcome.PASS, ("IN_SECTOR_SCOPE",))
    else:
        logic = Evaluation(Outcome.NOT_APPLICABLE, ("OUTSIDE_SECTOR_SCOPE",))
    return finalize(rule, source, as_of, logic)
