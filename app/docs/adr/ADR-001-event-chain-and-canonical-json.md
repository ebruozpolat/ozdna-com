# ADR-001 — Per-project hash chain over a restricted canonical JSON

**Status:** proposed. **Date:** 2026-10-07. **Spec:** `app/docs/schemas/provenance-event-v1.md`.

## Context

Research-provenance events must be tamper-evident, independently verifiable by third parties in
any language, and cheap to store on D1 (SQLite). Two implementations hashing "the same" event
differently would make evidence worthless, so the serialisation is the core risk.

## Decisions

### 1. One linear chain per project

Each event carries `seq` (0-based, contiguous) and `prev_hash`. Concurrency is resolved by the
storage layer (Phase 2: `UNIQUE(project_id, seq)` + bounded retry), not by the data model.
A Merkle tree over events was considered; a linear chain is simpler to verify, and checkpoint
signatures (Phase 3) give the same "commit to everything so far" property. A Merkle layer can
be added later over checkpoint digests without changing event hashes.

### 2. Canonical JSON = JCS, restricted

We use RFC 8785 ordering and escaping, which off-the-shelf libraries implement, and remove
everything that varies across languages:

| Edge case | Decision | Why |
|---|---|---|
| Floats | **Rejected**; integers ≤ 2^53−1 only | Float formatting differs across runtimes; scores use integer basis points |
| Unicode normalisation | **Must already be NFC; verifiers reject, never normalise** | Normalising on verify means hashed bytes ≠ stored bytes; writers normalise before hashing |
| Lone surrogates | **Rejected** | UTF-8 encoders silently replace them with U+FFFD, so two different strings would hash the same |
| Key order | UTF-16 code units (JCS) | Matches JCS libraries; tests pin the astral-vs-BMP case |
| `__proto__` key | **Rejected** | JS object handling of it is inconsistent (literal vs `JSON.parse` vs spread) |
| `undefined`, getters, class instances, sparse arrays | **Rejected** | `JSON.stringify` silently drops or reshapes them |
| Duplicate keys in stored text | **Rejected** via `parseCanonical` | Parsers disagree on first-wins vs last-wins |

### 3. Domain-separated SHA-256

`event_hash = SHA-256("ozdna.provenance.event/v1\n" ‖ cjson(event − event_hash))`, and the
checkpoint digest uses `"ozdna.provenance.checkpoint/v1\n"`. The prefix is the schema string, so
a version bump automatically changes every hash and no preimage is valid in two roles.

### 4. Strict envelope

Unknown members are rejected, never stripped. Stripping would let a stored row carry extra data
that is not covered by its hash while still verifying.

### 5. What verification means

`verifyChain` proves integrity (well-formed, contiguous, linked, hashes match), **not
authorship**: anyone can mint a self-consistent chain. `verifyAgainstCheckpoint` adds rollback,
truncation and rewrite detection relative to a checkpoint; the checkpoint's signature (Phase 3)
supplies authenticity. Tests make this limit explicit.

## Consequences

- Hash format and schema string are frozen by `test/fixtures/chain-v1.json`. Changing either
  requires a v2 schema string and a new ADR; refreshing the fixture to make a test pass is not
  allowed.
- Third-party verifiers need only SHA-256 and a JCS serialiser (or the 30-line one in
  `vectors.test.ts`) for ordinary data.
- Writers must NFC-normalise input; `appendEvent` does this.
