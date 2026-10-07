# Provenance event v1 — normative spec

**Schema strings:** `ozdna.provenance.event/v1`, `ozdna.provenance.checkpoint/v1`
**Status:** Slice 1, proposed (see ADR-000..002). Implemented by `@ozdna/provenance-schema`
(wire format) and `@ozdna/provenance-core` (hashing, chain, checkpoints).
**Test vectors:** `app/packages/provenance-core/test/fixtures/chain-v1.json` (frozen).

This document is the contract an independent verifier implements. If code and this document
disagree, that is a bug; fix the code, or change this document via a new schema version + ADR.
"MUST", "MUST NOT", "SHOULD" are used in the RFC 2119 sense.

---

## 1. Model

A **project** owns exactly one append-only **chain** of **events**. Event `seq` numbers start at
0 and are contiguous. Each event commits to the previous one through `prev_hash`, so the hash of
the last event commits to the entire history. A **checkpoint** is a small object committing to
the chain head at a given `seq`; in Phase 3 ozDNA signs it, which is what makes the history
*attributable*. Without a signed checkpoint, a valid chain proves only internal consistency:
anyone can build a self-consistent chain from scratch.

ozDNA records **assertions** from a calling platform (e.g. the Academic Platform): who did what
and when, as that platform states it. ozDNA does not authenticate end users and does not hold
manuscript text, claim text or raw prompts — only hashes, keyed commitments, identifiers and
short labels.

## 2. Event envelope

Every event is a JSON object with exactly these members (no others — readers MUST reject unknown
members, never strip them):

| Member | Type | Rule |
|---|---|---|
| `schema` | string | `"ozdna.provenance.event/v1"` |
| `event_id` | string | `evt_` + 8–64 `[0-9A-Za-z]`; unique within the chain |
| `project_id` | string | `prj_` + 8–64 `[0-9A-Za-z]`; same for every event in the chain |
| `seq` | integer | 0 … 2^53−1; equals the event's position |
| `prev_hash` | string | 64 lowercase hex; `event_hash` of `seq−1`, or 64 × `"0"` for seq 0 |
| `type` | string | dotted lowercase, 2–4 segments, e.g. `source.cited`; MUST be registered (§5) |
| `type_version` | integer | 1 … 1000; registered together with `type` |
| `occurred_at` | string | `YYYY-MM-DDTHH:MM:SS.sssZ`, a real UTC instant; asserted by the platform |
| `recorded_at` | string | same format; assigned by ozDNA at append; non-decreasing along the chain |
| `actor` | object | `{kind, id, asserted_by}` — exactly these members |
| `actor.kind` | string | `person` \| `service` \| `ai_system` |
| `actor.id` | string | 1–128 chars, safe text (§2.1); the platform's id for the actor |
| `actor.asserted_by` | string | `svc_` id of the platform making the assertion |
| `artifact_id` | string \| null | `art_` id, or `null`; required/forbidden per type (§5) |
| `payload` | object | validated by the registry entry for (`type`, `type_version`) |
| `event_hash` | string | 64 lowercase hex (§4); present on stored events only |

Additional chain rules: seq 0 MUST be `project.created`; `project.created` MUST NOT appear at any
other seq. Limits: one event ≤ 64 KiB canonical UTF-8; nesting depth ≤ 12; payload ≤ the type's
`maxPayloadBytes` (8 KiB for every v1 type).

### 2.1 Safe text

Free-text fields (`label`, `tool`, `actor.id`, identifier values, …) MUST NOT contain C0/C1
control characters (U+0000–U+001F, U+007F–U+009F), U+2028/U+2029, bidi embeddings/overrides
(U+202A–U+202E), bidi isolates (U+2066–U+2069) or U+FEFF. Text is data: a value such as
"ignore previous instructions" is stored verbatim and MUST NOT be interpreted.

## 3. Canonical JSON — `ozdna-cjson/v1`

Hashes are computed over a canonical serialisation. The profile is RFC 8785 (JCS), restricted so
that every value has exactly one encoding in every language:

1. **Values** allowed: `null`, `true`, `false`, integers in ±(2^53−1), strings, arrays, objects.
   No floats, NaN, ±Infinity, or big integers. `-0` serialises as `0`.
2. **Strings** (values *and* keys) MUST be well-formed UTF-16 (no lone surrogates) and already in
   Unicode **NFC**. Verifiers MUST reject non-NFC input; they MUST NOT normalise it. (Writers
   SHOULD normalise to NFC *before* hashing.)
3. **String escaping** is JCS / ECMAScript `JSON.stringify`: `\"`, `\\`, `\b`, `\f`, `\n`, `\r`,
   `\t`; other code points below U+0020 as `\u00xx` (lowercase hex); everything else literal,
   including `/`, U+007F and non-ASCII.
4. **Objects**: members sorted by key, comparing keys as sequences of **UTF-16 code units** (JCS
   §3.2.3). The key `__proto__` is forbidden. No duplicate keys.
5. **Arrays**: order preserved; no holes.
6. **No whitespace** anywhere outside strings.
7. Output is UTF-8.

`parseCanonical(text)` accepts JSON text only if re-canonicalising the parsed value reproduces the
text byte for byte. This rejects duplicate keys, `1.0`, `1e2`, unnecessary escapes, and key order
drift: anything two parsers might read differently. Stored events SHOULD be kept in canonical
form (Phase 2).

## 4. Event hash

```
event_hash = lowercase_hex( SHA-256( UTF8("ozdna.provenance.event/v1" + "\n") ‖ cjson(E) ) )
```

where `E` is the event **without** its `event_hash` member. The schema string is both the version
tag and a domain-separation prefix, so an event preimage can never collide with a checkpoint
preimage.

Example (from the vectors): the genesis preimage is

```
ozdna.provenance.event/v1
{"actor":{"asserted_by":"svc_academicplatform","id":"user-17","kind":"person"},"artifact_id":null,"event_id":"evt_00000000010000","occurred_at":"2026-10-07T10:00:00.000Z","payload":{"external_ref":"acad-proj-42"},"prev_hash":"0000000000000000000000000000000000000000000000000000000000000000","project_id":"prj_0000000001","recorded_at":"2026-10-07T10:00:01.000Z","schema":"ozdna.provenance.event/v1","seq":0,"type":"project.created","type_version":1}
```

(one `\n` between the two lines, none at the end).

### 4.1 Chain verification

Given events `e[0..n)` claimed to start at `seq = s` with trusted `prev = p` (for a full chain,
`s = 0`, `p = 0^64`), a verifier MUST, for each `i` in order:

1. validate `e[i]` against §2 and §5 (strict; unknown members and unregistered types fail);
2. check `project_id` equals the chain's project;
3. check `seq == s + i`;
4. check seq-0 / `project.created` rules;
5. check `prev_hash == p`;
6. check `event_id` has not appeared earlier in the input;
7. check `recorded_at ≥` the previous event's `recorded_at`;
8. recompute `h = event_hash(e[i])` and check `h == e[i].event_hash`; set `p = h`.

The first failure is reported with its code and `first_bad_seq = s + i`. Implementations SHOULD
cap the number of events per call (reference: 100 000).

## 5. Event-type registry v1

Payloads are strict objects: every listed member is required (nullable members must be present
as `null`), and no other members are allowed. Keys `__proto__`, `constructor`, `prototype` are
forbidden anywhere inside a payload. Hash fields are 64 lowercase hex. Scores are integer basis
points 0–10 000.

| type@version | artifact | payload |
|---|---|---|
| `project.created@1` | forbidden | `external_ref` (safe text ≤128) |
| `artifact.registered@1` | required | `kind` (manuscript\|dataset\|figure\|code\|supplement\|review\|other), `content_sha256`, `byte_length` (0…2^40), `media_type` (`type/subtype`, ≤127), `label` (safe text ≤200 \| null) |
| `artifact.version_added@1` | required | `content_sha256`, `byte_length`, `media_type`, `supersedes_sha256` |
| `source.cited@1` | required | `citation_id` (`cit_`), `identifier` {`scheme`: doi\|isbn\|issn\|pmid\|pmcid\|arxiv\|url\|other, `value`: safe text ≤512}, `locator` (safe text ≤64 \| null) |
| `source.verification_recorded@1` | optional | `citation_id`, `state` (§5.1), `confidence_bp`, `components` (≤16 entries, key `[a-z][a-z0-9_]{0,31}` → bp), `provider` (crossref\|datacite\|manual), `provider_response_sha256` (\| null), `candidates` (≤10 identifiers) |
| `claim.recorded@1` | required | `claim_id` (`clm_`), `claim_commitment` (hex), `commitment_scheme` = `"hmac-sha256/v1"` |
| `claim.source_linked@1` | required | `claim_id`, `citation_id`, `relation` (supports\|contradicts\|mentions) |
| `ai.use_declared@1` | optional | `tool` (safe text ≤128), `purpose` (drafting\|editing\|translation\|literature_search\|data_analysis\|code\|other) |
| `ai.use_observed@1` | optional | `tool`, `operation` (generation\|rewrite\|suggestion_accepted\|suggestion_rejected\|citation_suggested), `prompt_sha256` (\| null), `output_sha256` (\| null), `citation_id` (\| null) |
| `evidence_pack.generated@1` | optional | `pack_schema` = `"ozdna.provenance.pack/v1"`, `pack_sha256`, `checkpoint_seq`, `checkpoint_digest` — **signature-required** |

### 5.1 Verification states

Exactly: `VERIFIED`, `PARTIALLY_VERIFIED`, `CONFLICTING_METADATA`, `IDENTIFIER_NOT_FOUND`,
`RETRACTED`, `CORRECTED`, `EXPRESSION_OF_CONCERN`, `UNVERIFIED`. A state change is a new
`source.verification_recorded` event; earlier results are never edited.

### 5.2 Declared vs observed AI use

`ai.use_declared` (what a person says they used) and `ai.use_observed` (what the platform saw
happen) are separate types so that summaries can never conflate them. Neither type has a field
for raw prompt or output text; only SHA-256 commitments.

### 5.3 Adding types

A new type or a changed payload is a new `(type, type_version)` registry entry. Existing entries
are never edited after release; that would change what old events mean.

## 6. Checkpoint

```json
{
  "body": {
    "schema": "ozdna.provenance.checkpoint/v1",
    "project_id": "prj_…",
    "head_seq": 4,
    "head_hash": "<event_hash of seq 4>",
    "event_count": 5,
    "issued_at": "2026-10-07T12:00:00.000Z"
  },
  "digest": "<hex>"
}
```

```
digest = lowercase_hex( SHA-256( UTF8("ozdna.provenance.checkpoint/v1" + "\n") ‖ cjson(body) ) )
```

`event_count` MUST equal `head_seq + 1`. `issued_at` is supplied by the issuer (Phase 3 signer).
Strict: no other members in `body` or the outer object.

### 6.1 Verifying a chain against a checkpoint

1. Validate the checkpoint shape; recompute `digest` and compare.
2. *(Phase 3)* verify the signature over `digest` with the key from the key registry.
3. Verify the chain from seq 0 per §4.1, requiring `project_id == body.project_id`.
4. The chain MUST reach `head_seq` (else `CHECKPOINT_BEYOND_CHAIN`: truncation or rollback).
5. The event at `head_seq` MUST have `event_hash == head_hash` (else `CHECKPOINT_HEAD_MISMATCH`:
   history was rewritten, even if the rewritten chain is internally consistent).
6. Valid events after `head_seq` are reported as *unattested*: integrity-checked, not yet signed.

## 7. Error codes

Chain: `NOT_AN_ARRAY`, `TOO_MANY_EVENTS`, `EVENT_INVALID`, `PROJECT_MISMATCH`, `SEQ_MISMATCH`,
`PREV_HASH_MISMATCH`, `HASH_MISMATCH`, `DUPLICATE_EVENT_ID`, `GENESIS_TYPE`, `GENESIS_REPEATED`,
`RECORDED_AT_REGRESSION`.
Checkpoint: `CHECKPOINT_INVALID`, `CHECKPOINT_DIGEST_MISMATCH`, `CHAIN_INVALID`,
`CHECKPOINT_BEYOND_CHAIN`, `CHECKPOINT_HEAD_MISMATCH`.
Validation issues: `NOT_CANONICAL_JSON`, `ENVELOPE_INVALID`, `UNKNOWN_EVENT_TYPE`,
`PAYLOAD_INVALID`, `PAYLOAD_TOO_LARGE`, `FORBIDDEN_KEY`, `ARTIFACT_REQUIRED`, `ARTIFACT_FORBIDDEN`.
