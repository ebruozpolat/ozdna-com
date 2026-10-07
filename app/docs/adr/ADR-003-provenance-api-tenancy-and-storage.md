# ADR-003 — Provenance API: tenancy, append-only storage, concurrent appends

**Status:** proposed. **Date:** 2026-10-07. **Implements:** IMPLEMENTATION_PLAN.md Phase 2.

## Decisions

1. **Separate Worker, separate database.** `apps/provenance-api` with its own D1 database and
   migrations directory. The image database and its migrations 0001/0002 are untouched.
   Numbering: this database's migrations start at its own 0001.
2. **Service keys with scopes.** A tenant is a calling platform. Keys are `ozp_` plus 40
   unbiased base62 characters; only the SHA-256 is stored. Scopes: `projects:write`,
   `artifacts:write`, `events:append`, `events:read`. Tenant bootstrap is admin-only
   (`ADMIN_TOKEN`, constant-time compare).
3. **Actors are asserted by the platform.** The request carries `{kind, id}`, and the server adds
   `asserted_by` = the key's service id. ozDNA records who claimed what; it does not
   authenticate end users.
4. **Append-only by construction.** Triggers abort `UPDATE`/`DELETE` on event tables, so a code
   bug cannot rewrite history.
5. **Canonical text is the record.** `events.canonical` holds `ozdna-cjson/v1` text, which is read
   back with `parseCanonical`. The other columns are lookup helpers that verification never
   trusts.
6. **Concurrency.** `PRIMARY KEY (project_id, seq)` + read-head / build / `db.batch()` commit +
   bounded retry (5). Companion rows (project, artifact, idempotency key) are written in the same
   batch, so they exist if and only if their event does.
7. **Repository layer.** `ProjectStore`, `EventStore`, `ArtifactStore`, `IdempotencyStore` and
   `TenantStore`. Every tenant-data query binds `tenant_id`. Writes are returned as statements and
   committed through `UnitOfWork`, so several stores can commit atomically.
8. **Type routing.** `project.created` and `artifact.registered` only come from their own
   endpoints. Signature-required types (`evidence_pack.generated`) are refused until the signer
   exists (Phase 3).

## Consequences

- `/verify` loads up to 100 000 events per call; longer chains need checkpoints (Phase 3).
- Artifact *content* is not stored yet; only metadata (hash, size, type) is. Content storage
  (R2) arrives with Phase 4c.
- No rate limiting yet; it belongs at the edge or in a later phase.
