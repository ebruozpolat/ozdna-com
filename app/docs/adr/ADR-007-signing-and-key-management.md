# ADR-007 — Signing and key management (Ed25519, isolated signer)

**Status:** proposed. **Date:** 2026-10-07. **Implements:** IMPLEMENTATION_PLAN.md Phase 3.

## Spike result (2026-10-07)

Question: does Ed25519 signing and verification work in the Workers runtime, both under
`@cloudflare/vitest-pool-workers` (0.18) and under `wrangler dev` (4.x)?

| Runtime | generateKey | sign / verify | raw + JWK import/export | Deterministic |
|---|---|---|---|---|
| vitest-pool-workers (workerd) | ✔ | ✔ (64-byte sig; tampered message fails) | ✔ | ✔ |
| `wrangler dev --local` | ✔ | ✔ | — | — |
| Node 22 WebCrypto (offline verifier, tests) | ✔ | ✔ | ✔ | ✔ |

**Decision: native WebCrypto `{ name: "Ed25519" }`. `@noble/ed25519` is not needed.**

Interop finding from the spike: **Node 22 exports Ed25519 JWKs with `"alg": "Ed25519"`, and
workerd's `importKey` rejects that** (it expects `"EdDSA"`). A key minted with Node, the obvious
way an operator would create the secret, would fail to load. The signer therefore imports only
`{kty, crv, d, x}` and ignores JWK metadata; a test pins this.

## Decisions

1. **Algorithm:** Ed25519 only (deterministic, small keys, fast verification, supported by
   WebCrypto everywhere we run).
2. **Isolated signer.** `apps/signer` holds the only private key (`SIGNING_KEY_ED25519_JWK`,
   a Worker secret). It has **no HTTP surface**: no routes, `workers_dev` off, and a fetch
   handler that returns 404. It is reachable only through a **service binding** to its RPC
   entrypoint `Signer` (`publicKey`, `signCheckpoint`, `signEvent`).
3. **It signs objects, never bytes.** `signCheckpoint` takes a checkpoint body (strictly
   validated) and signs its domain-separated preimage. `signEvent` signs only registry types
   marked `signatureRequired`, and only if `event_hash` matches. There is no "sign these bytes"
   method (contrast image-API finding E-01). The signer also refuses checkpoints whose
   `issued_at` is more than 5 minutes from its own clock, so even a compromised API cannot
   obtain backdated attestations.
4. **key_id is a fingerprint:** `ed25519-` + the first 32 hex characters of SHA-256(raw public
   key). Verifiers recompute it, so a registry row cannot relabel another key.
5. **Registry (`signing_keys`, provenance DB migration 0003).** Statuses go
   `active → retired → revoked` and never backwards; at most one key is active (partial unique
   index); identity columns are immutable; rows are never deleted (all enforced by triggers).
6. **Rotation vs revocation.**
   - *Rotation* retires the old key with `valid_to = rotation time`. Checkpoints it signed
     with `issued_at ≤ valid_to` **stay valid**.
   - *Revocation* (compromise) distrusts **every** signature by that key, whatever its
     `issued_at`, because a key holder can backdate. The chain itself is untouched; the project
     is re-checkpointed with the new key.
7. **The API double-checks the signer.** After signing, the API requires that the signed body
   equals the body it built, that `key_id` is the registered active key, and that the
   signature verifies against the registry record, before storing anything.
8. **Offline verification.** `app/scripts/verify-checkpoint.mjs` checks chain + checkpoint +
   signature with only `node:crypto`; when given a key record it also checks status and
   validity window.

## Operations (needs founder sign-off; nothing is provisioned)

1. Generate a key **outside the repo** (e.g. `node -e` with WebCrypto, exporting the private
   JWK) and set it with `wrangler secret put SIGNING_KEY_ED25519_JWK` on `ozdna-provenance-signer`.
2. Deploy the signer, then the API (service binding `SIGNER`).
3. `POST /v1/provenance/admin/keys/rotate` (admin token) registers the key.
4. Rotation: replace the secret, then call rotate again. Compromise: `POST /admin/keys/{key_id}/revoke`,
   replace the secret, rotate, and re-checkpoint affected projects.

## Not covered yet

- Hardware or KMS-backed keys (the secret lives in Cloudflare's secret store).
- Publishing key history somewhere independent of ozDNA, e.g. anchoring checkpoint digests via
  `anchor-backends`.
