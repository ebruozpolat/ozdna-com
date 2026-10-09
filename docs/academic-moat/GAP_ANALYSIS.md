# Gap analysis — research provenance vs what `app/` has

**Date:** 2026-10-07. Companion to `CURRENT_STATE.md` (what exists) and
`IMPLEMENTATION_PLAN.md` (how to close the gaps).

## Target capability (summary)

A calling platform (the "Academic Platform") records, per research project: artifacts and their
versions, cited sources and the result of verifying them against registries (Crossref,
DataCite), claims and which sources they rely on, and declared vs observed AI use. ozDNA keeps
this as an append-only, tamper-evident history, signs checkpoints, and produces an evidence pack
that anyone can verify offline with only the public key. A public endpoint confirms a pack
without revealing its contents.

## Gaps

| # | Capability | Today | Gap | Phase |
|---|---|---|---|---|
| G1 | Event model + canonical hashing | Image leaf preimage only (newline template) | Generic, versioned, strictly validated event envelope; cross-language canonical JSON | **1 ✔** |
| G2 | Tamper-evident history | Merkle batches of mutable image records | Append-only per-project chain; verify + first-bad-seq reporting | **1 ✔** (pure) / 2 (storage) |
| G3 | Tenancy | user → api_keys | tenant → projects; service keys with scopes; platform-asserted actors | 2 |
| G4 | Append-only storage | Mutable rows, no triggers | Own D1; `UPDATE`/`DELETE` blocked by triggers; `UNIQUE(project_id, seq)`; idempotency keys | 2 |
| G5 | Tenant isolation | Per-user `WHERE user_id = ?` in each route | Repository layer that scopes every query; cross-tenant leak tests | 2 |
| G6 | Signing + keys | One P-256 JWK, unauthenticated oracle (E-01), no registry/rotation | Isolated signer Worker (service binding only), signs only checkpoint digests + signature-required types; key registry with rotation/revocation | 3 |
| G7 | Offline verification | None for research | `verify-checkpoint.mjs` and `verify-pack.mjs` using only `node:crypto` | 3 / 7 |
| G8 | Source verification | None | Pure engine (8 states, basis-point confidence with stored components), DOI/identifier normalisation, Crossref/DataCite adapters with SSRF/size/timeout guards and recorded fixtures | 4a / 4b |
| G9 | Verification history | None | State changes as new events; retraction propagation to dependent claims | 4c / 7 |
| G10 | Claim graph | None | Claims as keyed commitments; claim↔source links; text stays in the platform | 5 |
| G11 | AI provenance | None (and no detection; hard rule 3) | Declared vs observed use as distinct types; raw prompts rejected unless a tenant setting allows them, and then only as artifacts | 6 |
| G12 | Evidence pack + public verify | None | Deterministic pack (no `generated_at` in hashed body); generation is an event; ≥128-bit `verification_id`; minimal public response | 7 |
| G13 | OpenAPI from schema | Hand-written YAML for image API | Generate from zod for the provenance API | 2 |

## Cross-cutting gaps

- **Scope ratification**: done. ADR-000 was accepted on 2026-10-07 and hard rule 6 now scopes
  "images only" to the image product line.
- **Data retention / privacy position**: needed before production. Which identifiers count as
  personal data (actor ids), retention of provider responses, erasure vs append-only (answer:
  crypto-shredding of artifact content and per-tenant keyed commitments; events keep only
  hashes).
- **Acceptance criteria**: the earlier brief's §37 "15-step acceptance test" is not in this
  repo. Phase 7 needs it supplied, or a reconstruction approved.
- **Image-API defects** E-01..E-08 (`CURRENT_STATE.md` §10) are independent of this track. E-01
  matters to it because a future signer must never be an open oracle.

## Risks

| Risk | Mitigation |
|---|---|
| Two implementations hash differently | Restricted JCS profile, frozen vectors, independent re-implementation test (ADR-001) |
| Chain forged wholesale | verifyChain ≠ authenticity; signed checkpoints + published keys (Phase 3) |
| Prompt/manuscript leakage via payload or logs | Strict payloads with no free-text bodies; commitments only; no-content logging rule |
| Provider data used as instructions (prompt injection) | All provider text treated as data; hostile-payload fixtures (Phase 4b) |
| SSRF via identifier resolution | Fixed host allow-list, no redirects off-list, size/time caps (Phase 4b) |
| D1 concurrency on append | `UNIQUE(project_id, seq)` + bounded retry inside `db.batch()` (Phase 2) |
