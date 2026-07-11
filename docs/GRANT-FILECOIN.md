# Filecoin Open Grant Application — OriginDNA Public Provenance Archive

**Status: DRAFT (prepared July 10, 2026). To be FILED after the October MVP ships (Nov–Dec 2026), per ACTION_PLAN Phase 2.1 — apply with a live product.**
**Template: `filecoin-project/devgrants` → Open Grant Application. Sections below mirror the official template. Items marked `{FOUNDER}` need founder input before filing.**

---

## Project Name

OriginDNA Public Provenance Archive — content-addressed archival of C2PA manifests and perceptual-fingerprint records on Filecoin

## Proposal Category

Developer and data tooling *(secondary fit: Storage)*

## Individual or Entity Name

Find Below Ventures (Sharjah Publishing City Free Zone, UAE)

## Proposer

`{FOUNDER: GitHub username}`

## Project Repo(s)

- `ebruozpolat/ozdna-com` (product monorepo; the grant-funded archive tooling will live in a dedicated public repo, see Open Source Commitment)
- `{new repo: origindna-archive — created at grant start}`

## Filecoin Ecosystem Affiliations

None.

## Technical Sponsor

None yet.

## Open Source Commitment

**Yes.** All grant-funded work (the archive exporter, CID index, retrieval/verification tooling and docs) will be dual-licensed MIT/Apache-2 in a public repository. *(Note: the OriginDNA commercial API itself is outside grant scope and remains proprietary; the archive layer is the open, ecosystem-facing component.)*

## Project Summary

OriginDNA is content provenance infrastructure for the EU AI Act era. From August 2, 2026, Article 50 requires providers of generative AI systems to mark AI-generated content in machine-readable form (California's SB 942 takes effect the same day; the grace period for systems already on the market ends December 2, 2026). OriginDNA gives every image a "DNA": a C2PA cryptographic signature at creation, a timestamp anchored in a public append-only record, and two perceptual fingerprints (64-bit DCT pHash + PDQ-256) stored in a registry — so that a copy whose metadata has been stripped by a social platform can still be matched back to its origin record.

The registry is the load-bearing piece: platforms strip C2PA metadata in transit, and the C2PA specification (v2.4) explicitly anticipates third-party manifest repositories to re-attach provenance — yet the only live implementation is vendor-run. OriginDNA operates the neutral, API-first registry. But a registry run by one small company has a trust ceiling: **"independently verifiable" must survive the operator.**

This grant funds the **Public Provenance Archive**: signed C2PA manifests and fingerprint records batched into content-addressed archives (CAR files) and stored on Filecoin on a published cadence, with a public CID index. Anyone — a court, a newsroom, a regulator, a platform — can retrieve and verify provenance records without OriginDNA's cooperation or existence. Filecoin is not bolted on: content-addressed, provably persistent storage is precisely what a provenance archive requires, and it completes the product's core promise.

## Impact

**Pain point.** Provenance systems concentrate trust in their operators. If the registry operator disappears, gets acquired, or is compelled to alter records, downstream verifiers lose the evidence trail — the exact failure mode provenance exists to prevent. Regulated users (EU AI Act compliance, legal evidence) need proof that outlives the vendor.

**Benefit to the Filecoin ecosystem.** (1) A concrete, regulation-driven use case for verifiable storage with real deadline-driven demand (Aug 2 / Dec 2, 2026), demonstrable to policymakers and enterprises. (2) Open-source tooling for archiving C2PA provenance data to Filecoin — reusable by any Content Credentials implementer, newsroom archive, or fact-checking organization. (3) Ongoing, growing data onboarding tied to a revenue-backed SaaS (not grant-dependent storage).

**Risks.** Retrieval latency is acceptable for our use case (the hot path stays in the registry; Filecoin is the cold, canonical archive). Deal renewal/monitoring is scoped into M3. Adoption risk is mitigated by the regulatory calendar and an already-live segmented waitlist.

**Success looks like:** every OriginDNA provenance record publicly resolvable to a CID; an independent third party retrieving and verifying a record end-to-end with no OriginDNA involvement, following only public docs.

## Outcomes

1. **`origindna-archive` (MIT/Apache-2):** exporter that batches manifests + fingerprint records into CAR files, makes storage deals (via an onboarding service or direct deals), and maintains a public, signed CID index.
2. **Verify-page integration:** every record on the public verify page displays its archive CID and a "retrieve it yourself" path.
3. **Independent verification guide:** step-by-step docs proving records are checkable without us.
4. Published snapshot cadence + deal-health monitoring with public status.

## Data Onboarding

Directional projections (JPG/PNG manifests + fingerprint records are small; volume scales with signing activity after the December 2 launch wave):

| Month 1 | Month 3 | Month 6 | Month 12 |
|---|---|---|---|
| ~1–5 GB | ~10–25 GB | ~50–100 GB | ~150–300 GB |

## Adoption, Reach, and Growth Strategies

Primary audience: small GenAI applications facing the December 2, 2026 marking deadline (self-serve API, live waitlist with AI-company segment); secondary: marketplace sellers (Etsy AI-disclosure regime) and fact-checking organizations (free forever — flagship users, including TR/MENA newsrooms). Distribution is founder-led PR and SEO around the Aug 2 and Dec 2 news cycles (prep pack ready), plus C2PA/CAI ecosystem visibility (CAI membership applied). The archive tooling itself will be promoted to other Content Credentials implementers as reusable open source.

## Development Roadmap

*Timeline assumes grant start ~December 2026, immediately after MVP launch. One full-stack engineer + founder (project management, docs, ecosystem liaison).*

**Milestone 1 — Archive exporter + first deals (4 weeks, $12,000)**
Batch registry records into CAR files; content-address and store on Filecoin; public signed CID index; automated cadence. *Deliverable: public repo with exporter + first production snapshots on Filecoin.*

**Milestone 2 — Verify integration + record lineage (3 weeks, $8,000)**
Public verify page shows per-record CID + retrieval instructions; registry API returns archive pointers. *Deliverable: any live provenance record resolvable to its Filecoin archive.*

**Milestone 3 — Independent verification guide + deal-health ops (3 weeks, $10,000)**
End-to-end third-party verification walkthrough; deal renewal/monitoring with public status page; v1.0 release of the open-source tooling with docs. *Deliverable: documented, reproducible no-trust verification; sustainable ops.*

## Total Budget Requested

| # | Description | Deliverables | Completion | Funding |
|---|---|---|---|---|
| 1 | Archive exporter + first Filecoin deals | Open-source exporter, CID index, production snapshots | T+4 wks | $12,000 |
| 2 | Verify-page + API integration | Per-record CID lineage live | T+7 wks | $8,000 |
| 3 | Verification guide + deal-health ops, v1.0 release | Docs, monitoring, tagged release | T+10 wks | $10,000 |
| | **Total** | | | **$30,000** |

Budget covers engineering time, storage/deal costs during the grant period, and documentation. Requested amount is deliberately below the $50K cap; scope is complete-in-itself.

## Team

- `{FOUNDER: name}` — founder, Find Below Ventures: distribution, PR, SEO, project management. `{LinkedIn}`
- `{Engineer: to be named at filing — the October MVP engineer}` `{LinkedIn}`

**Team Website:** https://ozdna.com

**Relevant Experience:** `{FOUNDER: 2–3 sentences — 5+ years in crypto exchanges and communications; shipped ozdna.com two-product platform; MVP shipped October 2026 (will be true at filing)}`

**Team Code Repositories:** `ebruozpolat/ozdna-com` `{+ MVP repos at filing}`

## Additional Information

Found the program via fil.org/grants. Contact: hello@ozdna.com. Supporting material: OriginDNA whitepaper v1.0 (architecture, regulatory map, token-optional stance — attached/linked at filing). OriginDNA is deliberately token-free: this is a SaaS with conventional revenue; the archive layer is public-goods infrastructure, which is why we're seeking grant funding for exactly this component.

---

## İç notlar (başvuruya girmez)

- **Onaylandı (founder, 10 Tem 2026):** Filecoin/IPFS = DNA registry'nin halka açık kalıcı arşiv katmanı. v1 MVP kapsamını değiştirmez (Cloudflare-first, Ekim 4 hafta); arşiv katmanı grant-fonlu MVP-sonrası iş.
- Dosyalama zamanı: MVP canlıya çıktıktan sonra (Kas–Ara 2026), `filecoin-project/devgrants`'ta issue olarak.
- Dosyalamadan önce: `{FOUNDER}` alanları, aylık veri projeksiyonlarının MVP gerçekleriyle güncellenmesi, whitepaper PDF'i, yeni `origindna-archive` deposunun adı.
- Açık kaynak taahhüdü yalnızca arşiv katmanı için — ticari API kapsam dışı (metinde açıkça sınırlandı).
