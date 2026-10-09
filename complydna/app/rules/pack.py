"""Load and validate a rule pack. The loader enforces the no-fabrication rules."""

from __future__ import annotations

import json
from pathlib import Path

from app.rules.model import InterpretationStatus, Pack, SourceKind, SourceStatus

PACKS_DIR = Path(__file__).parent / "packs"

EVALUATORS = frozenset(
    {
        "beneficial_owner",
        "deadline",
        "review_cycle",
        "crypto_occasional",
        "cash_limit",
        "high_value_reporting",
        "direct_supervision",
        "sector_scope",
    }
)


class PackError(ValueError):
    pass


def validate_pack(pack: Pack) -> Pack:
    for s in pack.sources:
        if s.kind is SourceKind.SYNTHETIC_TEST:
            raise PackError(f"{s.source_id}: synthetic test sources are not allowed in a pack")
    for r in pack.rules:
        src = pack.source(r.provision.source_id)
        if r.evaluator not in EVALUATORS:
            raise PackError(f"{r.rule_id}: unknown evaluator {r.evaluator!r}")
        if src.source_url != r.source_url:
            raise PackError(f"{r.rule_id}: source_url differs from its source record")
        verified_src = src.status is SourceStatus.VERIFIED
        claims = []
        if r.provision.verified:
            claims.append("provision")
        if r.applies_from_verified:
            claims.append("applies_from")
        if r.scope_verified:
            claims.append("scope")
        if r.exceptions_verified:
            claims.append("exceptions")
        if r.interpretation_status is InterpretationStatus.VERIFIED:
            claims.append("interpretation")
        claims += [f"parameter {n}" for n, p in r.parameters.items() if p.verified]
        if claims and not verified_src:
            raise PackError(
                f"{r.rule_id}: {', '.join(claims)} marked verified but source is {src.status}"
            )
        if not r.review_required and r.unverified_items(src):
            raise PackError(f"{r.rule_id}: review_required=false on an unverified rule")
    return pack


def load_pack(pack_id: str, packs_dir: Path = PACKS_DIR) -> Pack:
    path = packs_dir / pack_id / "pack.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    pack = Pack.model_validate(data)
    if pack.pack_id != pack_id:
        raise PackError(f"pack_id {pack.pack_id!r} does not match directory {pack_id!r}")
    return validate_pack(pack)
