# Session deferrals & omissions ledger — 2026-07-27

Full, honest accounting of everything Claude Code **dropped, deferred, simplified, or decided
without asking** during that session (branch `claude/organize-file-structure-p5nlh9`,
PR #36). Split by whether it was flagged at the time. Category **A is the real problem** —
things decided silently that were the founder's to decide.

**Resolution pass (2026-07-27, Cursor):** Category A OPEN items (A2–A6 + A8–A10) closed
below. C2/C3/C4 closed on the organize tip + this pass. Remaining B/C/D/E stay explicit.

---

## A. Decided / dropped WITHOUT asking you (the lapses)

| # | What | Status now |
|---|---|---|
| A1 | **Oversight line left out of the Linear sync** — marked "deliberately not synced" on Claude judgment. | FIXED — full spec as §6 of `docs/oversight/linear-sync-2026-07-27.md`. |
| A2 | **Corpus bodies left un-corrected** — banners only; "AlignX as GTM/consulting channel" left in bodies. | FIXED — rewrote `positioning.md` Faz 1 + Fiyatlama (founder-led / ozDNA billing); `roadmap-90d.md` correction note. AlignX is separate UK consulting, not GTM channel. |
| A3 | **`ACTION_PLAN.md` "alignxmedia" entry + `DOMAIN.md` "not held by AlignX" line** — left as-is. | FIXED — ACTION_PLAN 0.9 clarified: historical Netlify project name only, not AlignX Partners / not GTM. DOMAIN ownership line kept (still accurate) + clarify note. |
| A4 | **`check-forbidden.sh` not wired into a build/CI gate** | FIXED — `.github/workflows/oversight-forbidden.yml` runs the script on path changes. |
| A5 | **Toolchain divergences unflagged** — plain Vitest; raw SQL vs drizzle. | FIXED (documented + stub) — `app/TOOLCHAIN.md`; drizzle twin at `app/apps/api/src/db/schema.ts`. workerd Vitest pool deferred until Workers apps land (called out, not silent). |
| A6 | **TypeScript version** — auto-bump to `^7.0.2`; corpus pins **6.0.3**. | FIXED — `app/package.json` pins `typescript` to `6.0.3` (exact). |
| A7 | **Immortal MLRO first built with production-absolute nav paths** before `/oversight` location decided. | FIXED (path-split). |
| A8 | **Lighthouse ≥95** asserted without measuring | FIXED — measured 2026-07-27 (local, Lighthouse 12.8.2); see addendum. |
| A9 | **Verify link wiring partial** (OriginDNA only) | See addendum. |
| A10 | **Forbidden-word gate** scoped to oversight only, not `/verify` | See addendum. |

---

## B. Deferred but flagged at the time

| # | What | Why |
|---|---|---|
| B1 | TR parity (Immortal MLRO, AlignX site) shipped after EN | batch sequencing — later completed |
| B2 | Verify page: real **C2PA cryptographic validation** (WASM) not built | presence-scan only; needs `@contentauth/c2pa-web` + backend |
| B3 | Verify page: anchored-timestamp + signer-identity rows are **illustrative** | need the signing/anchor/registry backend |
| B4 | Verify page: "deep manifest inspection" file-upload path not built | prototype is client-side only |
| B5 | Oversight site: OG/Twitter image + tags not added | cosmetic; deferred |
| B6 | LinkedIn footer link is a **placeholder** (`www.linkedin.com`) | no ozDNA company page yet (brand-architecture §5) |
| B7 | Immortal MLRO authored from the corpus; **no real prototype** exists in-repo | none was provided |
| B8 | complyDNA/originDNA **name-collision** long-term decision | path-split for now; long-term parked (founder) |
| B9 | **No deploys** of anything (site, oversight, MVP) | founder sign-off + Netlify + TezMakale-cleanup gate |

---

## C. Built but PARTIAL / simplified (implementation corners)

| # | What | Gap |
|---|---|---|
| C1 | `dna-core` **PDQ-256** not implemented | needs the `pdq-wasm` build spike (plan/03 §1.4) |
| C2 | `dna-core` **zod schemas** | FIXED — `packages/dna-core/src/schema.ts` (+ tests) |
| C3 | `dna-core` **verdict enum + copy + threshold map** | FIXED — `packages/dna-core/src/verdict.ts` (verbatim §6.3 / §1.5) |
| C4 | Merkle cross-impl test vectors | FIXED — `test/fixtures/vectors.json` + `vectors.test.ts` |
| C5 | pHash: math vectors locked; **golden-IMAGE corpus** (real JPEG/PNG + EXIF Orientation=6) still missing; EXIF step-0 untested | PARTIAL — needs platform decode layer |
| C6 | `contracts/OzDnaAnchor.sol` not written | `forge` / later batch |
| C7 | `packages/anchor-backends` (NullAdapter/BaseAdapter) not written | — |
| C8 | Deleted standalone oversight `robots.txt` + `sitemap.xml` when moving to `/oversight` | INFO — root covers it |
| C9 | Verify page audit/waitlist forms never tested against live backend | Same gate as B9 |

---

## D. Known next code slices — not started

`apps/api` routes (Hono Worker: sign-digest, marks, registrations, verify, records/proof/badge,
usage, waitlist, webhooks) · `apps/anchor` (cron batch → Base tx → proofs) · `apps/web`
(Astro sign/verify SPA, c2pa-web WASM) · app CI workflow (`.github/workflows/ci.yml` for
dna-core / Workers) · drizzle-kit generate wiring · golden-image fixtures · local
signing-cert generation · OpenAPI `api/openapi.yaml` · `@cloudflare/vitest-pool-workers`.

---

## E. Founder / ops — not agent work (listed for completeness)

TezMakale residue cleanup **(blocks any public launch)** · `conformance@c2pa.org` Level-1
email · EUIPO + TÜRKPATENT trademark scan · OZD-52/53 status reconcile on the Linear board ·
1 signed pilot · EIC Pre-Accelerator / NGI Zero filing · Aug 2 PR push · entity formation
(TBD) · logo variants + ozDNA LinkedIn page · all deploy sign-offs.

---

## Addendum — found on a second re-review

| # | What | Status after Cursor pass |
|---|---|---|
| A8 | **Lighthouse ≥95** claimed without measuring | FIXED + measured — local static serve (not Netlify deploy-preview: those inject `x-robots-tag: noindex` and tank SEO). After contrast/`link-in-text-block` CSS fixes in `oversight/assets/site.css`: **`/oversight/` and `/oversight/tr/` = Perf/A11y/BP/SEO all 100** (LH 12.8.2, 2026-07-27). Spec criterion met for the oversight site. |
| A9 | Verify link missing from home + ComplyDNA | FIXED — wired `/verify/` into home + ComplyDNA nav/footer. |
| A10 | Forbidden gate missed `/verify` pages | FIXED — `check-forbidden.sh` + CI also scan `verify/` + `tr/verify/` for banned terms + absolute claims. Spelling-variant check stays oversight-only until the sitewide `OZDNA.COM`/`BY OZDNA` label pass (roadmap-90d Hafta 1). |
| C8 | Oversight robots/sitemap deletion | INFO — root covers it |
| C9 | Forms untested live | Same as B9 |

---

## Operating rule (going forward)

If something is deferred, dropped, simplified, or scoped out: state it **explicitly in the
moment** and leave the decision to the founder — no silent scoping. This ledger was the
catch-up for everything before that rule; the 2026-07-27 Cursor pass closes Category A.
