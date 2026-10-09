# Research provenance track — agent rules

Read this, then `../docs/academic-moat/IMPLEMENTATION_PLAN.md`, before touching anything in the
research-provenance track. Repo-root `../CLAUDE.md` still applies; where this file is stricter,
this file wins.

## What this track is

Tamper-evident provenance for research work (artifacts, citations and their verification,
claims, declared/observed AI use), recorded for a calling platform and exported as an
offline-verifiable evidence pack. Scope decision: `docs/adr/ADR-000` (accepted 2026-10-07). Wire format: `docs/schemas/provenance-event-v1.md`.

## Where things live

| Path | What | Status |
|---|---|---|
| `packages/provenance-schema` | canonical JSON, envelope, registry, validation | Slice 1 ✔ |
| `packages/provenance-core` | hashing, append, verifyChain, checkpoints | Slice 1 ✔ |
| `apps/provenance-api` | Worker + own D1: tenancy, storage, append/read API | Phase 2 ✔ (draft PR, not deployed) |
| `apps/signer` | key holder, signs checkpoint digests only | Phase 3 |
| `docs/adr/ADR-000..` | decisions | 000 accepted; 001–003 proposed |

## Never

- Deploy, create Cloudflare resources, spend money, or post publicly without founder sign-off.
  Merging to `main` deploys the public site: draft PRs only.
- Touch the image product (`apps/api` image routes, `apps/anchor`, `contracts`, `migrations/0001`
  and `0002`, `dna-core` perceptual hashing) unless the founder approved that specific change.
- Change the hash format, the canonical JSON profile, or the schema strings
  (`ozdna.provenance.event/v1`, `…/checkpoint/v1`). Doing so requires a v2 and an ADR. Never
  regenerate `provenance-core/test/fixtures/chain-v1.json` to make a test pass.
- Edit a released registry entry. Add a new `type_version` instead.
- Read the clock, generate randomness, do I/O, or log inside `provenance-schema` or
  `provenance-core` (enforced by `determinism.test.ts`).
- Put manuscript text, claim text, raw prompts or raw model output into an event payload or a
  log line. Use hashes or keyed commitments.
- Conflate declared and observed AI use, or derive "independently verified" counts from
  self-report instead of verification results.
- Classify content as AI-generated (no detection; repo-root hard rule 3).
- Auto-correct an ambiguous reference. Return candidates.
- Update or delete stored events. State changes are new events.

## Always

- Write the failing test before the fix for any defect.
- Run `npm run check` in `app/` before every commit.
- Persist through small repository interfaces that scope every query by tenant (Phase 2+).
- Use the error shape `{error, code, message}`; generate OpenAPI from zod.
- Treat everything returned by external metadata providers as untrusted data.
- When current code conflicts with the plan, document the conflict and propose the smallest
  change. Do not silently deviate.
