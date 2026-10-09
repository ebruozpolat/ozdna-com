# `@ozdna/provenance-api` — research-provenance API (Phase 2)

Cloudflare Worker for the research-provenance track: tenancy, append-only event storage and the
append/read/verify API. It has its **own D1 database** (`PROV_DB`, migrations in `./migrations`),
separate from the image API's database. **Not provisioned and not deployed**: the D1 id in
`wrangler.jsonc` is a placeholder for local runs only. Rules: `../../CLAUDE-ACADEMIC.md`.
Decisions: `../../docs/adr/ADR-003-provenance-api-tenancy-and-storage.md`.

## Endpoints (`/v1/provenance`)

| Method | Path | Scope | What |
|---|---|---|---|
| POST | `/admin/tenants` | `X-Admin-Token` | Create a tenant and its first service key (shown once) |
| POST | `/projects` | `projects:write` | Create a project and its `project.created` genesis event |
| GET | `/projects` | `events:read` | List this tenant's projects |
| GET | `/projects/{id}` | `events:read` | Get a project |
| POST | `/projects/{id}/artifacts` | `artifacts:write` | Register an artifact (`artifact.registered`); `Idempotency-Key` supported |
| POST | `/projects/{id}/events` | `events:append` | Append an event; `Idempotency-Key` supported |
| GET | `/projects/{id}/events` | `events:read` | Events in seq order (`after_seq`, `limit` ≤ 500) |
| GET | `/projects/{id}/verify` | `events:read` | Re-verify the stored chain from canonical JSON |
| POST | `/projects/{id}/checkpoints` | `checkpoints:write` | Signed checkpoint of the current head (via the signer) |
| GET | `/projects/{id}/checkpoints/latest` | `events:read` | Latest checkpoint + signature |
| POST | `/admin/keys/rotate` | `X-Admin-Token` | Register the signer's key as active; retire the previous one |
| POST | `/admin/keys/{key_id}/revoke` | `X-Admin-Token` | Revoke a key (compromise) |
| GET | `/v1/keys/{key_id}` (note: outside `/v1/provenance`) | none | Public key record |
| GET | `/openapi.json` | none | OpenAPI 3.1, generated from the zod schemas |

Every error is `{error, code, message}` (plus `issues` for validation failures).

## How it works

- **Tenancy.** A calling platform authenticates with a service key (`ozp_…`, only its SHA-256 is
  stored). The key's `service_id` becomes `actor.asserted_by` on every event, and callers cannot
  set it. Everything is reached through repository interfaces (`src/repo/stores.ts`) that take the
  tenant id from the key; another tenant's ids return 404, like ids that do not exist.
- **Append-only.** SQLite triggers abort `UPDATE`/`DELETE` on `events`, `artifacts`,
  `idempotency_keys` and `projects`.
- **Concurrency.** `PRIMARY KEY (project_id, seq)`. An append reads the head, builds the event
  with `@ozdna/provenance-core`, and commits it together with any companion rows in one
  `db.batch()`. The loser of a race hits the key, rolls back, and retries on the new head, up to
  5 attempts (then `503 APPEND_CONTENTION`).
- **Idempotency.** `Idempotency-Key` is scoped per project. The same key with the same body
  replays the original event (200); the same key with a different body is `409`.
- **Verify** reads only `events.canonical`, not the denormalised columns, parses it with
  `parseCanonical` and runs `verifyChain` (integrity). Attestation comes from signed checkpoints.
- **Checkpoints** (Phase 3, ADR-007): the API builds the body from the verified chain, the
  signer (service binding `SIGNER`) signs it, and the API re-verifies the signature against the
  registered active key before storing. Offline check: `app/scripts/verify-checkpoint.mjs`.
  In tests the real signer Worker runs as an auxiliary worker, bundled by `vitest.config.ts`
  with a key generated per run.
- **No logging** of bodies, payloads or keys (tested).

## Run

```bash
cd app
npm run test:workers          # includes this Worker's suites (vitest-pool-workers, local D1)
npm run typecheck -w @ozdna/provenance-api
```
