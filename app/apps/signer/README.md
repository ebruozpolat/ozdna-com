# `@ozdna/signer` — research-provenance signer (Phase 3)

Holds the **only** Ed25519 private key for research provenance. It has no HTTP surface: no routes,
`workers_dev` off, and a fetch handler that returns 404. The provenance API reaches it through a
service binding to the RPC entrypoint `Signer`:

| Method | Signs | Refuses |
|---|---|---|
| `publicKey()` | n/a; returns `{key_id, algorithm, public_key}` | n/a |
| `signCheckpoint(body)` | checkpoint/v1 preimage | anything that isn't a strict checkpoint body; `issued_at` more than 5 minutes from its clock |
| `signEvent(event)` | event preimage | non-`signatureRequired` types; invalid events; wrong `event_hash` |

There is no "sign arbitrary bytes" method. **Not deployed.** The key is the secret
`SIGNING_KEY_ED25519_JWK` (an Ed25519 private JWK); it is never in the repo, tests or logs, and
tests generate their own keys. Design and operations: `../../docs/adr/ADR-007-signing-and-key-management.md`.

```bash
cd app && npx vitest run -c apps/signer/vitest.config.ts
```
