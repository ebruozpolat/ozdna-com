# OzDNA — Brand Asset Notes

> Changelog — 2026-07-07: Initial brand-asset audit recorded (was only in a prior analysis, not in any file). Inventory + known defects + dev-team handoff.

Reference note for the dev team building the landing/verify pages and for whoever finalizes the logo. Not a spec — see `plan/07-GTM-SEO-PR` for messaging and `docs/ACTION_PLAN.md` for the migration gate.

## TL;DR for developers

- **Primary brand color: `#EA8B36`** (RGB 234,139,54), a warm orange. Consistent across all three current assets. Use this as the site accent.
- **Do NOT reuse the logo currently live on ozdna.com.** That is the partner's LLM-cost product (Space Grotesk wordmark) that is being migrated OFF the domain (see `ACTION_PLAN.md` item 0.9). Its branding is unrelated to OzDNA.
- **Every current asset has at least one defect** (see "Known defects"). Do not ship any of them to a public page or favicon as-is. In particular: the wordmark PNG is unrecoverable, the transparent icon has a dark halo, and there is no vector/SVG yet.
- **Favicon** must be generated from a *clean* icon export, not from the current haloed transparent PNG.
- **Nothing public until metadata is stripped** — see defect (4). This is a provenance/authenticity brand; shipping assets that leak a Canva template name undercuts the entire pitch.
- Reminder (from CLAUDE.md hard rules): nothing deploys to `ozdna.com` until `ACTION_PLAN.md` item 0.9 is logged DONE — until then, pages.dev / subdomain only.

## Concept

Hand-drawn rising sun over dunes, inside a circle. Reinforces "origin" / Turkish "öz" (essence/self) — the proof-of-origin story.

## Asset inventory

All three files currently sit in the **project root** (`/Users/yusufos/Desktop/Projeler/OZDNA/`).

| File | Dimensions | Mode | Background | Notes |
|---|---|---|---|---|
| `OZDNA-Only-Icon.png` | 2000×2000 | RGB | Opaque **black** | Icon only, black backdrop. Usable on dark surfaces. |
| `OZDNA-Only-Icon-BG Removed.png` | 2000×2000 | RGBA | Transparent | Icon only, cut out — but has a halo, see defect (2). |
| `OZDNA - İcon + Wordmark.png` | 2113×695 | RGB | White | Icon + wordmark lockup — but wordmark is **unrecoverable**, see defect (1). |

All raster, **96 DPI**. No vector source in the repo.

## Known defects (each is a to-do)

1. **Wordmark is invisible / unrecoverable.** In `OZDNA - İcon + Wordmark.png` the text was flattened to white-on-white — the right ~70% of the canvas is pure `#FFFFFF`. The wordmark cannot be recovered from this export. **Action:** re-export the wordmark with dark (or transparent-background) text, in both dark-on-light and light-on-dark variants.
2. **Halo on the transparent icon.** `OZDNA-Only-Icon-BG Removed.png` has a 5–11px semi-transparent **black** fringe around the circle; on light backgrounds it renders as a ~`#373737` grey ring. **Action:** clean re-cut from vector, or restrict this file to dark backgrounds only until then.
3. **Raster-only, 96 DPI.** No crisp scaling for web/retina/favicon. **Action:** produce a proper **SVG** vector export as the master.
4. **Leaking Canva XMP metadata.** All three files embed Canva XMP that exposes the source template name ("Purple Black and White Modern Tech Logo") and the creator. **Action:** **strip all metadata** before any public use — doubly important for a provenance/authenticity brand. Trademark caveat: Canva-template artwork generally cannot be trademark-registered and is not exclusive to us, so a **bespoke variation is advisable before the Aug 2 PR push**.

## Prioritized checklist

1. **Strip metadata** from all assets that will ever be published (e.g. `exiftool -all= <file>`), and re-verify none leak the template name.
2. **Re-export the wordmark** with visible text — deliver a dark-on-light variant and a light-on-dark variant.
3. **Produce an SVG** master (icon and lockup) as the source of truth for web/favicon.
4. **Generate a favicon set** (ico + PNG sizes + maskable) from the clean SVG/icon — not from the haloed PNG.
5. **Decide on owning/registering the mark** — commission a bespoke variation off the Canva template and confirm trademark posture before Aug 2.

ASSUMPTION: color/dimension/defect values above are transcribed from the prior brand analysis as provided in the task brief; a human should spot-confirm `#EA8B36` and the wordmark/halo defects against the actual files before commissioning rework.
