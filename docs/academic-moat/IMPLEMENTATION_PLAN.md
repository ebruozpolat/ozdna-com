# Implementation plan — research provenance

**Date:** 2026-10-07. **Status:** Phase 1 (Slice 1) done on a draft PR; Phases 2–7 not started.
Read `app/CLAUDE-ACADEMIC.md` first. Every phase ships as its own **draft PR**. Nothing is
deployed, no Cloudflare resources are created, and nothing is merged without founder sign-off.

## Data rules (apply to every phase)

1. Append-only: state changes are new events/rows, never `UPDATE`/`DELETE`.
2. No manuscript text, claim text or raw prompts in events or logs: hashes and keyed
   commitments only. Raw prompts are rejected unless a tenant setting enables them, and even then
   they are stored as an artifact, never in a payload.
3. Declared vs observed AI use are never conflated. "AI-suggested vs independently verified"
   counts come from verification results, not self-report.
4. Deterministic evidence: no clock or randomness in pure paths; timestamps are inputs.
5. Every query is tenant-scoped through a repository layer.
6. Error shape `{error, code, message}`. OpenAPI generated from zod.
7. External text is untrusted data.

## Phase 1 — Core (Slice 1) ✔

`packages/provenance-schema` (canonical JSON, envelope v1, registry v1, validation) and
`packages/provenance-core` (event hash, `appendEvent`, `verifyChain`, checkpoints,
`verifyAgainstCheckpoint`). ADR-000..002, spec `app/docs/schemas/provenance-event-v1.md`, frozen
vectors. **Exit:** `npm run check` green; no change to image code.

## Phase 1b — Adversarial review (Prompt 1)

Try to forge/alter events that still verify, to find canonicalisation divergences (NFC,
ordering, surrogates, numbers, `__proto__`, sparse arrays), to bypass registry validation, and
to break determinism. Write the failing test first, then fix. The hash format and schema string
change only if a flaw makes it unavoidable, and then only with an explanation first.

## Phase 2 — Tenancy, storage, append API ✔ (draft PR; ADR-003; `apps/provenance-api/README.md`)

- New Worker `apps/provenance-api` with its **own D1 database** and migrations dir
  (`apps/provenance-api/migrations/`).
- Migrations: `0001_tenancy.sql` (tenants, service_keys with scopes, projects),
  `0002_events.sql` (events with `UNIQUE(project_id, seq)`, `UNIQUE(project_id, event_id)`,
  idempotency keys, artifacts metadata; **triggers abort `UPDATE` and `DELETE`** on event tables).
- Auth: service keys (hashed, scoped, e.g. `events:append`, `events:read`, `projects:write`).
  Actors are asserted by the calling platform (`actor.asserted_by` = the key's service id).
- Repository interfaces `EventStore`, `ArtifactStore`; every method takes the tenant from
  the auth context.
- Append: load head → `appendEvent` → insert inside `db.batch()`. On a `UNIQUE(project_id, seq)`
  conflict, retry a bounded number of times. Store canonical JSON text, and read it back via
  `parseCanonical`.
- Endpoints: `POST /v1/provenance/projects`, `POST /v1/provenance/projects/{id}/artifacts`,
  `POST /v1/provenance/projects/{id}/events` (Idempotency-Key),
  `GET /v1/provenance/projects/{id}/events`, `GET /v1/provenance/projects/{id}/verify`.
- Tests: cross-tenant leak (read/write/list); direct UPDATE/DELETE aborts; two concurrent
  appends → seq n and n+1, valid chain; idempotent append; oversized/malformed rejection;
  end-to-end create → append → GET → verify, and mutating a stored row in a test DB makes
  `/verify` report the right `first_bad_seq`.

## Phase 3 — Signer, key registry, signed checkpoints ✔ (draft PR; ADR-007; spec §8)

- Spike: Ed25519 in workerd (vitest-pool-workers + `wrangler dev`). If unsupported, use
  `@noble/ed25519`. Record in `ADR-007-signing-and-key-management.md` (proposed).
- `apps/signer`: service-binding only, holds the only private key, and signs only checkpoint
  digests and signature-required event types (`evidence_pack.generated`), never arbitrary
  bytes (contrast E-01).
- Migration `0003_signing.sql`: `signing_keys(key_id, algorithm, public_key, status,
  valid_from, valid_to, revoked_at)`, `checkpoints`.
- Endpoints: `GET /v1/keys/{key_id}`, `POST /v1/provenance/projects/{id}/checkpoints`,
  `GET …/checkpoints/latest`.
- `app/scripts/verify-checkpoint.mjs`: `node:crypto` + public key only, with no ozDNA imports.
- Tests: verifies with the public key alone; tampered checkpoint fails; signer refuses other
  payloads; revocation/rotation; old checkpoints stay valid after rotation. Use test-generated
  keys only, never committed keys.

## Phase 4a/4b — Source verification engine and adapters ✔ (draft PR; ADR-004; `packages/source-verification`; fixtures synthetic, record real ones before 4c)

- Spike recorded in `ADR-004-metadata-provider-precedence.md`, citing current Crossref and
  DataCite docs: how corrections/retractions appear, Retraction Watch availability and terms,
  rate limits and polite-pool identification, and registration-agency lookup. Anything
  unconfirmed fails closed to `UNVERIFIED`.
- Pure engine: the 8 states, integer basis-point confidence from structured signals with
  persisted components, no auto-correction (return candidates).
- DOI/identifier normalisation; Crossref and DataCite adapters with a fixed host allow-list,
  timeouts, size caps and content-type checks.
- CI never touches the network (a test fails on unmocked `fetch`). Fixtures: normal, corrected,
  retracted, expression of concern, not found, DataCite dataset, malformed, and hostile (huge
  title, control characters, prompt-injection string). A separate script, not run in CI, records
  fixtures.

## Phase 4c — Verification storage (migration 0004)

Verification results as `source.verification_recorded` events plus an index table; provider
responses stored as artifacts referenced by hash.

## Phase 5 — Claim graph (migration 0005)

`claim.recorded` (keyed commitment only) and `claim.source_linked`; graph queries for "claims
relying on source X".

## Phase 6 — AI provenance (migration 0006)

`ai.use_declared` / `ai.use_observed`; tenant setting for raw-prompt artifacts (off by default);
summaries keep declared and observed separate; AI-suggested vs independently-verified counts
derived from verification results.

## Phase 7 — Evidence pack, public verify, end-to-end

- The pack is a pure function of (events up to a checkpoint, schema versions). There is no
  `generated_at` in the hashed body and no live re-verification. Generation is itself an
  `evidence_pack.generated` event.
- `verification_id` ≥ 128-bit CSPRNG. The public verify endpoint returns only the artifact hash,
  chain validity, signature validity, checkpoint time and aggregate counts.
- `app/scripts/verify-pack.mjs` works offline.
- Acceptance: the 15-step test from the original brief's §37 (**not in this repo; must be
  supplied**), plus retraction propagation (a VERIFIED source becomes RETRACTED, history is
  preserved, dependants are flagged, a new pack reports it) and "mutating any historical event
  fails verification".
- Output: the list of what the founder must provide for staging (Cloudflare resources, secrets,
  DNS) and for production (sign-off, data-retention position).

## Out of scope for this track

Image API fixes (E-01..E-08) go in separate small PRs from `main`, with explicit approval (Prompt 2).
