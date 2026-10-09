# ADR-002 — Pure core, closed event registry

**Status:** proposed. **Date:** 2026-10-07.

## Context

Evidence packs (Phase 7) must be reproducible: the same events must always yield the same bytes
and hashes. Payload shapes also determine what data ozDNA holds, and therefore its privacy and
retention position.

## Decisions

### 1. Two pure packages

- `@ozdna/provenance-schema`: canonical JSON, the strict envelope, the registry, validation.
  It depends only on `zod`.
- `@ozdna/provenance-core`: hashing, `appendEvent`, `verifyChain`, checkpoints. Its only async
  operation is Web Crypto SHA-256 (Node 22, Workers and browsers alike).

Neither package reads the clock, generates randomness, does I/O, logs, or reads the
environment. Timestamps (`occurred_at`, `recorded_at`, `issued_at`) and ids are **inputs**.
`test/determinism.test.ts` enforces this by scanning `src/`.

Neither package imports `@ozdna/dna-core`. That keeps the image product untouched, and the
research packages extractable on their own. The small duplicated helper (`toHex`) is deliberate.

### 2. Closed, versioned registry

- Every event's `(type, type_version)` must be registered; unknown types are rejected.
- Payload schemas are strict, size-capped, and checked for `__proto__` / `constructor` /
  `prototype` keys at any depth. Lookups use a `Map`, so `type: "constructor"` resolves to
  nothing.
- Registered entries are never edited after release. Changes ship as a new `type_version`.

### 3. Content rules enforced by schema, not by convention

- Claim text never enters ozDNA: `claim.recorded` holds only an HMAC commitment computed by the
  platform.
- Raw prompts/outputs never enter an event: `ai.use_observed` holds SHA-256 commitments only. A
  future tenant setting may let raw prompts be stored as an *artifact* (Phase 6), never in a
  payload.
- Declared and observed AI use are distinct types.
- Free text is short and stripped of control and bidi characters (Trojan-Source style
  display attacks).
- Verification states are a closed set of eight; confidence is integer basis points with its
  component scores stored alongside.

### 4. Validation order

canonical-JSON pass → strict envelope (zod) → registry lookup → forbidden-key scan → payload size
cap → strict payload. The canonical pass runs first, so zod never touches getters, cycles,
prototypes or oversized input, and the hash is computed over exactly the object that was
validated.

## Consequences

- A registry entry is a schema migration: it needs review like one.
- Phase 2+ code (Workers, D1) stays outside these packages and calls them; I/O never leaks in.
