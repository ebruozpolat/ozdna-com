# ADR-000 — Research provenance as a separate track inside `app/`

**Status:** accepted, ratified by the founder on 2026-10-07. **Date:** 2026-10-07.
**Context docs:** `docs/academic-moat/CURRENT_STATE.md`, `GAP_ANALYSIS.md`, `IMPLEMENTATION_PLAN.md`.

## Context

The image content-provenance MVP in `app/` (C2PA signing, pHash/PDQ registry, Merkle anchoring)
is the only built product. A new capability is proposed: tamper-evident provenance for
**research work** (manuscripts, datasets, citations, claims and AI assistance), recorded on
behalf of a calling platform (the "Academic Platform") and exported as a verifiable evidence pack.

This collides with two standing rules in the repo-root `CLAUDE.md`:

- **Hard rule 6, "v1 scope: images only."** Research provenance is not image provenance.
- **Hard rule 3, "No AI detection classifiers."** Research provenance records *declared* and
  *observed* AI use reported by the platform; it never classifies text as AI-written.

## Decision

1. Treat research provenance as a **separate track**, not a change to image v1. Image code
   (`apps/api` image routes, `apps/anchor`, `contracts`, `dna-core` perceptual hashing) is not
   modified by this track except through separately approved, specifically scoped fixes.
2. Build it **additively** in the same monorepo: new packages
   (`packages/provenance-schema`, `packages/provenance-core`), and later new Workers
   (`apps/provenance-api`, `apps/signer`) with their **own D1 database**.
3. **No detection.** AI use is recorded from platform assertions (`ai.use_declared`) and
   platform observations (`ai.use_observed`), never inferred from content.
4. **No new chain dependency.** The hash chain + signed checkpoints are self-contained; optional
   public anchoring of checkpoint digests can reuse `anchor-backends` later, invisibly, under the
   same "blockchain is plumbing" rule.
5. Hard rules 1, 2, 4 and 5 apply unchanged: no token, no custody, no "AI × Blockchain"
   framing, no overclaiming.

## Consequences

- Slice 1 is pure library code with no deploy, no spend, and no change to the public site.
- Ratified 2026-10-07. Hard rule 6 in repo-root `CLAUDE.md` now states that "images only"
  applies to the image product line and names this track as the exception. Deploying or
  marketing anything from this track still needs separate founder sign-off.
- Nothing here creates a product page, a pricing claim or a marketing mention.

## Alternatives considered

- *Extend the image `records` table with a `kind = research` row type.* Rejected: it couples a
  new data model to the live image schema (migrations 0001/0002) and the anchor job.
- *A separate repo.* Deferred: `app/` itself is planned for extraction (see `app/README.md`);
  splitting earlier adds tooling cost now with no benefit.
