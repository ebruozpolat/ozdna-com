# Current state — `app/` audit for research provenance

**Date:** 2026-10-07. **Base:** `main` @ `268d486`. **Author:** audit session (Claude Code).
**Scope:** what exists in `app/` today, what can be reused for research provenance, and defects in
the live image API found along the way (§10).

> Provenance of this document: an earlier session's audit could not be pushed and was not
> recoverable. This version was rewritten from scratch against the code at `268d486`. Every
> finding below was re-checked in the source; nothing is carried over unverified.

## 1. Repo shape

`ozdna-com` is the Netlify marketing site (repo root) plus a Cloudflare Workers monorepo in
`app/` (npm workspaces). Nothing in `app/` is part of the Netlify build. CI
(`.github/workflows/ci.yml`) runs `npm ci && npm run check` in `app/` on PRs touching `app/**`,
plus a forbidden-word gate on HTML and `forge test` for contracts. CI never deploys.

## 2. Packages and apps

| Path | Purpose | Notes |
|---|---|---|
| `packages/dna-core` | SHA-256, Merkle tree, leaf preimage, pHash v1, PDQ distance, bands, verdicts, zod schemas | Pure; one impl for browser + Workers |
| `packages/anchor-backends` | `AnchorBackend` interface, `NullAdapter`, `BaseAdapter` (viem) | Live tx needs secrets + deployed contract |
| `apps/api` | Hono Worker: waitlist, verify, registrations, sign-digest, records, bootstrap, marks, usage, webhooks | D1 `ozdna`; `ENVIRONMENT=production` in wrangler.jsonc |
| `apps/anchor` | Cron Worker: batches `registered` records, Merkle root, adapter submit | `ANCHOR_BACKEND=null` |
| `apps/web` | Vite SPA: C2PA Wasm verify | Not wired to sign-digest |
| `contracts` | `OzDnaAnchor.sol` (Foundry) | |
| `migrations/0001_init.sql`, `0002_webhooks.sql` | D1 schema | users, api_keys, records, anchor_batches, usage_events, waitlist, webhook_endpoints |

## 3. Toolchain

Node ≥22, TypeScript 6.0.3 (strict + `noUncheckedIndexedAccess`), Vitest 4.1.10,
`@cloudflare/vitest-pool-workers` 0.18 for D1 tests, Biome 2.5.2, zod 4, Hono 4, drizzle 0.45.
`npm run check` = typecheck + biome + vitest (root) + vitest workers.

## 4. Test baseline at `268d486`

`npm run check` passes: **96** root tests (18 files) + **3** workers tests (2 files).

## 5. Data model relevant to provenance

- Tenancy is **user-scoped** (`users` → `api_keys`), with no organisation/project concept.
- `records` is image-specific (sha256, phash64, pdq256, bands, file_mime) and mutable
  (`status`, `anchor_batch_id`, `moderation_status` are updated in place).
- `usage_events.event_type` has a CHECK constraint fixed to four image event types.
- No append-only tables, no triggers, no per-tenant sequence.

## 6. Crypto and signing

- `dna-core/merkle.ts`: RFC 6962-style domain-separated leaves/nodes, odd node promoted.
- `dna-core/leaf.ts`: newline-delimited leaf preimage `ozdna.v1`, not JSON.
- `apps/api/routes/sign-digest.ts`: ECDSA P-256 with a JWK from `SIGNING_KEY_JWK`. No key
  registry, no rotation, no key id beyond `SIGNING_KEY_ID ?? "dev"`.
- No Ed25519 anywhere yet.

## 7. Auth

`requireApiKey`: Bearer `ozdna_(live|test)_…`, SHA-256 of the key looked up in `api_keys`, with
revocation honoured. Applied to marks, usage and webhooks only. Not applied to
`/v1/registrations` or `/v1/sign-digest` (see §10).

## 8. Reusable for research provenance

| Reuse | How |
|---|---|
| Monorepo, CI gate, Biome/TS/Vitest config | As-is; new packages are picked up automatically |
| `vitest-pool-workers` + `apply-migrations.ts` pattern | Copy for `apps/provenance-api` with its own migrations dir |
| Hono + zod route style, OpenAPI module | Same style; generate OpenAPI from zod (the image API hand-writes YAML) |
| API-key hashing approach | Same idea for service keys, plus scopes |
| `anchor-backends` | Optional later: anchor checkpoint digests |
| `dna-core` | **Not reused**: image-specific; the provenance packages stay independent (ADR-002) |

## 9. Not reusable / must not be touched by this track

Image routes, `apps/anchor`, `contracts`, migrations 0001/0002, and `dna-core` perceptual code.
Their data model (mutable records, user tenancy) does not fit append-only provenance.

## 10. Defects in the live image API

Severity is for the image product as deployed with the current wrangler config. **None are fixed
in Slice 1.** Fixing E-01/E-05/E-06 is Prompt 2 and needs founder approval.

| ID | Sev | Where | Finding |
|---|---|---|---|
| **E-01** | High | `apps/api/src/routes/sign-digest.ts` | `POST /v1/sign-digest` has **no auth and no rate limit**, and signs **arbitrary caller-supplied bytes** with `SIGNING_KEY_JWK`. CORS reflects any `Origin`, so any website can call it. Anyone can obtain ozDNA-key signatures over anything (a signing oracle), and usage is not metered (`sign_digest` usage events are never written). |
| **E-02** | High | `apps/api/src/routes/registrations.ts` | `POST /v1/registrations` has **no auth, no Turnstile** (`TURNSTILE_SECRET` is declared in `env.ts` but never read) and no rate limit. Anyone can insert public, anchorable records with `user_id NULL`. Because `idx_records_sha256` is unique and dedupe is first-writer-wins, a third party can **squat** an image hash before its creator registers it. |
| **E-03** | Medium | `apps/anchor/src/index.ts` | The anchor run is not atomic: batch row → `adapter.anchor()` → per-record `UPDATE`s run one by one, outside `db.batch()`. A failure after `anchor()` leaves records `registered`, and they are re-anchored in a later batch. Nothing ever sets records to `anchored` or batches to `confirmed`, so `exactVerdict(row.status === "anchored")` in `/v1/verify` is never true. The batch `chain` column is hard-coded `base-mainnet` even when the adapter targets Sepolia. |
| **E-04** | Medium | `apps/api/src/routes/records.ts` | `GET /v1/anchors/:batchId/proof/:recordId` returns `proof: []`: sibling paths are never persisted, so no record can be independently verified against an anchored root. The route also does not filter `is_test`. |
| **E-05** | Low | `apps/api/src/routes/marks.ts` (and `registrations.ts`) | The response's `created_at` comes from the JS clock (`new Date().toISOString()`), while the stored row uses the D1 default, and the **anchor leaf preimage uses the stored value**. The timestamp a client receives is not the one committed to the Merkle leaf, so a client cannot recompute its own leaf. |
| **E-06** | Medium (needs decision) | `apps/api/src/routes/sign-digest.ts` | `crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, digest)` hashes its input. If the client sends a SHA-256 **digest**, as the route name and `digest_b64` imply, the signature is over SHA-256(digest), and a standard ES256 verifier checking the original data will reject it. Either the client must send the full to-be-signed bytes (then 1024 base64 chars ≈ 768 bytes may be too small for a COSE `Sig_structure`), or the server needs a prehash-aware signer. Do not change the algorithm without a decision. |
| E-07 | Low | `auth.ts`, `registrations.ts` (`ulidish`) | Ids are `Date.now().toString(36) + Math.random()`, not ULIDs: not monotonic, and they use a non-CSPRNG source. Harmless for public record ids; do not reuse the helper for anything secret. |
| E-08 | Low | `bootstrap.ts` | `X-Bootstrap-Token` is compared with `!==` (not constant-time). Low impact: the endpoint is one-shot and token-gated. |

## 11. Slice 1 delivered (this branch)

`packages/provenance-schema`, `packages/provenance-core`, ADR-000..002,
`app/docs/schemas/provenance-event-v1.md`, `app/CLAUDE-ACADEMIC.md`, and these three docs. After
Slice 1 and its adversarial review (§12), `npm run check` gives **248** root tests (96 existing
+ 152 new) + 3 workers tests.

## 12. Slice 1 adversarial review (2026-10-07)

Hash format and schema strings unchanged (frozen vectors still pass).

| ID | Sev | Finding | Fix |
|---|---|---|---|
| R-1 | Medium | `verifyAgainstCheckpoint` returned `valid: true` for a chain with a forged, re-hashed tail after the checkpoint head (only `unattested_count` hinted at it) | Fails closed with `UNATTESTED_EVENTS` unless `allowUnattested` is set |
| R-2 | Low | Validation read the caller's object twice (descriptors for the canonical pass, `[[Get]]` for zod), so a Proxy could show each a different value | Validate and return a snapshot parsed from the canonical text; `appendEvent`/checkpoint code read only validated snapshots |
| R-3 | Low | A checkpoint could be issued (and verified) with `issued_at` earlier than its head event's `recorded_at` | `buildCheckpoint` throws; verify reports `CHECKPOINT_PREDATES_HEAD` |
| R-4 | Low | Year `0000` accepted; common date libraries (e.g. Python) reject it, so verifiers would disagree on validity | Years limited to 0001–9999 |
| R-5 | Info | Spec ambiguities: length unit, depth counting, leap seconds, mid-chain slice limits, Unicode-version NFC caveat | Clarified in the spec; leap second / hour 24 rejection now tested |

