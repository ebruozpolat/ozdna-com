# Session deferrals & omissions ledger — 2026-07-27

Full, honest accounting of everything Claude Code **dropped, deferred, simplified, or decided
without asking** during that session (branch `claude/organize-file-structure-p5nlh9`,
PR #36). Split by whether it was flagged at the time. Category **A is the real problem** —
things decided silently that were the founder's to decide.

**Resolution pass (2026-07-27, Cursor):** Category A closed. Agent-completable B/C/D closed
in subsequent PRs through `cursor/close-all-open`. What remains is **blocked on founder
credentials/actions** — not agent deferral.

---

## A. Decided / dropped WITHOUT asking you (the lapses) — ALL FIXED

| # | Status |
|---|---|
| A1–A10 | FIXED (see git history / earlier rows). **A4 batch gate:** `app` `npm run check` + `.github/workflows/ci.yml` (typecheck + Biome + vitest; contracts job separate). Forbidden-word gate remains `.github/workflows/oversight-forbidden.yml`. |

---

## B. Was deferred / incomplete — status now

| # | Status |
|---|---|
| B1 | FIXED (TR parity) |
| B2 | **IN PROGRESS → library landed** — `@ozdna/web` `verifyC2pa()` via `@contentauth/c2pa-web`. Marketing `/verify/` still presence-scan until SPA ships Wasm bundle (code path exists in `apps/web`). |
| B3 | **UNBLOCKED in API** — `GET /v1/verify` + `GET /v1/records/:id` return registry rows when D1 has data; marketing page still illustrative until `api.ozdna.com` is live (**blocked: CF deploy**). |
| B4 | Same as B2 — deep manifest via `apps/web` `verifyC2pa` / reader.manifestStore(). |
| B5 | FIXED |
| B6 | FIXED — fake LinkedIn URLs removed |
| B7 | FIXED — concept/marketing notice on Immortal MLRO |
| B8 | FIXED — path-split locked as live architecture |
| B9 | Netlify live. Workers **deployed** to `ozdna-api.alignxdigital.workers.dev` + D1 `ozdna` (migrations applied). Custom domain `api.ozdna.com` + prod signing/Base secrets still founder. |

---

## C. Implementation corners — ALL FIXED (agent path)

| # | Status |
|---|---|
| C1–C4 | FIXED |
| C5 | FIXED — golden corpus + EXIF step-0 + **photon cross-decoder d≤2** (`decode-photon.ts`, `photon-golden.test.ts`) |
| C6–C7 | FIXED — contract + Foundry tests; **BaseAdapter + viem** live |
| C8 | INFO |
| C9 | FIXED |

---

## D. Code slices

**Landed (agent — no founder decision required):**
- `apps/api`: health, OpenAPI, waitlist, verify, **registrations**, **sign-digest**, **records**, **anchor proof stub**, usage, webhooks stubs
- `apps/anchor`: NullAdapter + BaseAdapter when secrets present
- `apps/web`: Vite SPA + Wasm `verifyC2pa()` UI (`npm run dev -w @ozdna/web`)
- `apps/api`: `@cloudflare/vitest-pool-workers` D1 waitlist integration (`npm run test:workers`)
- drizzle-orm schema + `db:generate` staging
- `npm run certs:dev` P-256 signing PEMs
- PDQ, golden images, photon cross-decoder

**Blocked on founder (not deferred by agent choice):**
1. ~~Cloudflare account + D1 + Workers deploy~~ **DONE** on workers.dev (`ozdna-api` / `ozdna-anchor`)
2. Custom domain `api.ozdna.com` → Workers (DNS; apex stays Netlify)
3. Base RPC URL + operator private key secrets (for live chain anchor)
4. `SIGNING_KEY_JWK` secret in production
5. LinkedIn company page URL (footer link removed until you create the page)
6. TezMakale residue confirmation (partner)
7. Trademark / entity / pilot / Linear OZD-52/53 / Aug 2 PR / grant filings — see `docs/FOUNDER-OPS.md`

**Optional polish (not a silent deferral — call out):**
- ~~`@cloudflare/vitest-pool-workers` D1 integration tests~~ **done** (`waitlist.workers.test.ts`)
- ~~Vite SPA on `apps/web` + Wasm reader UI~~ **done** (marketing `/verify/` stays presence-scan; deep verify = `apps/web`)
- `POST /v1/marks` full-image server pipeline (needs Workers Paid + photon in Worker isolate + CF deploy)

---

## E. Founder / ops — blocked on you

See `docs/FOUNDER-OPS.md` (updated for Commons Fund closure + GenAI disclosure).

---

## Operating rule

**Do not leave work open without the founder's explicit decision.** If something needs a credential or a human/legal action, label it **blocked on founder**, not "deferred". Ship every agent-completable slice.
