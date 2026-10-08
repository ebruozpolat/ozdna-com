"""Beneficial ownership: ownership and control evaluated as independent paths.

Ownership is computed on a directed graph (owner -> owned, percent). Indirect ownership uses
the only supported method, MULTIPLY_SUM: multiply the percentages along each simple chain
from the person to the target and add the chains. Whether the primary text prescribes this
method is recorded on the rule as an unverified parameter.

Fail-closed choices:
- An edge with an unknown percent contributes nothing to the lower bound; if the lower bound
  alone does not decide the case, the result is INSUFFICIENT_EVIDENCE, never FAIL.
- Missing control evidence is UNKNOWN, never ABSENT. Control has no percentage floor.
- Cycles: simple chains give a lower bound; if that bound does not reach the threshold the
  case goes to human review rather than guessing how cross-holdings aggregate.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, localcontext
from enum import StrEnum

from app.rules.gate import Evaluation, finalize
from app.rules.model import LegalSource, Outcome, RuleDefinition, RuleResult, to_decimal

HUNDRED = Decimal(100)
SUPPORTED_METHODS = frozenset({"MULTIPLY_SUM"})


class ControlStatus(StrEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class Edge:
    owner: str
    owned: str
    #: Percent of the owned entity held by owner, as a string/int; None when unknown.
    percent: str | int | None

    def share(self) -> Decimal | None:
        if self.percent is None:
            return None
        value = to_decimal(self.percent)
        if value < 0 or value > HUNDRED:
            raise ValueError(f"percent out of range 0..100: {self.percent!r}")
        return value


@dataclass(frozen=True)
class ControlFact:
    person: str
    entity: str
    status: ControlStatus
    basis: str = ""


@dataclass(frozen=True)
class Structure:
    target: str
    natural_persons: frozenset[str]
    edges: tuple[Edge, ...]
    control: tuple[ControlFact, ...] = field(default=())


@dataclass(frozen=True)
class Ownership:
    lower_bound: Decimal
    chains: int
    unknown_chains: int
    cyclic: bool
    inconsistent: tuple[str, ...]


def _compare(value: Decimal, threshold: Decimal, comparison: str) -> bool:
    if comparison == "GTE":
        return value >= threshold
    if comparison == "GT":
        return value > threshold
    raise ValueError(f"unknown comparison {comparison!r}")


def effective_ownership(structure: Structure, person: str) -> Ownership:
    """Lower bound of person's ownership of the target over all simple chains."""
    out: dict[str, list[Edge]] = defaultdict(list)
    incoming: dict[str, Decimal] = defaultdict(Decimal)
    for e in structure.edges:
        out[e.owner].append(e)
        s = e.share()
        if s is not None:
            incoming[e.owned] += s
    inconsistent = tuple(sorted(n for n, total in incoming.items() if total > HUNDRED))

    total = Decimal(0)
    chains = unknown = 0
    cyclic = False
    with localcontext() as ctx:
        ctx.prec = 80  # exact for any realistic chain; no rounding before comparison

        def walk(node: str, product: Decimal | None, seen: frozenset[str]) -> None:
            nonlocal total, chains, unknown, cyclic
            for e in out.get(node, ()):
                if e.owned in seen:
                    cyclic = True
                    continue
                s = e.share()
                nxt = None if (product is None or s is None) else product * s / HUNDRED
                if e.owned == structure.target:
                    chains += 1
                    if nxt is None:
                        unknown += 1
                    else:
                        total += nxt
                    continue
                walk(e.owned, nxt, seen | {e.owned})

        walk(person, HUNDRED, frozenset({person}))
    return Ownership(total, chains, unknown, cyclic, inconsistent)


def _control(structure: Structure, person: str) -> ControlStatus:
    facts = [f for f in structure.control if f.person == person and f.entity == structure.target]
    statuses = {f.status for f in facts}
    if ControlStatus.PRESENT in statuses:
        return ControlStatus.PRESENT
    if statuses == {ControlStatus.ABSENT}:
        return ControlStatus.ABSENT
    return ControlStatus.UNKNOWN


def evaluate_beneficial_owner(
    rule: RuleDefinition,
    source: LegalSource,
    as_of: date,
    structure: Structure,
    person: str,
) -> RuleResult:
    """PASS = person qualifies as a beneficial owner of the target (ownership or control)."""
    return finalize(rule, source, as_of, _logic(rule, structure, person))


def _logic(rule: RuleDefinition, structure: Structure, person: str) -> Evaluation:
    if person not in structure.natural_persons:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("PERSON_NOT_A_KNOWN_NATURAL_PERSON",))
    method = rule.param("indirect_method").value
    if method not in SUPPORTED_METHODS:
        return Evaluation(Outcome.NOT_DETERMINED, ("UNSUPPORTED_INDIRECT_METHOD",))
    threshold = rule.param("threshold_percent").decimal()
    comparison = str(rule.param("comparison").value)

    own = effective_ownership(structure, person)
    control = _control(structure, person)
    computed = {
        "effective_percent_lower_bound": format(own.lower_bound.normalize(), "f"),
        "chains": str(own.chains),
        "chains_with_unknown_percent": str(own.unknown_chains),
        "cyclic": str(own.cyclic).lower(),
        "control": control.value,
        "threshold_percent": format(threshold, "f"),
        "comparison": comparison,
    }
    if own.inconsistent:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("SHARES_EXCEED_100_PERCENT",), computed)

    reasons: list[str] = []
    if _compare(own.lower_bound, threshold, comparison):
        reasons.append("OWNERSHIP_THRESHOLD_MET")
        if own.unknown_chains or own.cyclic:
            reasons.append("DECIDED_ON_LOWER_BOUND")
        if control is ControlStatus.PRESENT:
            reasons.append("CONTROL_PRESENT")
        return Evaluation(Outcome.PASS, tuple(reasons), computed)
    if control is ControlStatus.PRESENT:
        return Evaluation(Outcome.PASS, ("CONTROL_PRESENT",), computed)

    # Ownership not shown to reach the threshold and control not shown present.
    if own.cyclic:
        return Evaluation(Outcome.HUMAN_REVIEW_REQUIRED, ("CYCLIC_OWNERSHIP_STRUCTURE",), computed)
    if own.unknown_chains:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("UNKNOWN_OWNERSHIP_LINK",), computed)
    if control is ControlStatus.UNKNOWN:
        return Evaluation(Outcome.INSUFFICIENT_EVIDENCE, ("CONTROL_EVIDENCE_UNKNOWN",), computed)
    return Evaluation(Outcome.FAIL, ("BELOW_OWNERSHIP_THRESHOLD", "CONTROL_ABSENT"), computed)
