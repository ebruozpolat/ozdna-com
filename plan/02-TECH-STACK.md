# 02 — OzDNA Technology Stack: Locked Choices, Versions, Rationale

> **Changelog**
> 2026-07-06 · ratification pass — pHash + anchor-cadence ratified

*Written July 6, 2026. All package versions and service limits below were verified against npm / vendor documentation **on this date** — re-verify anything older than ~60 days before the October build starts (one `npm view <pkg> version` per package is enough). Claims that could not be verified today are prefixed `UNVERIFIED:` and collected in §17.*

**Audience:** a future Claude Code session implementing the MVP with no memory of this planning conversation, supervised by a non-engineer founder. Every choice comes with the plain-language "why."

**Division of labor with sibling documents:** this document owns *which tool*. `03-ALGORITHMS.md` owns hash algorithm parameters and match thresholds. `04-MVP-SPEC.md` owns endpoint shapes, schemas, and what actually ships in the 4-week October build. `05-RISK-REGISTER.md` owns risks and kill criteria. Where those documents disagree with an example given here, they win.

---

## 0. Constraints that shaped every decision

1. **Budget:** $0/mo target, $20/mo absolute ceiling (CLAUDE.md). Every layer below has a free tier or a one-time cost.
2. **Cloudflare-first** (hard rule 7): Vercel Hobby bans commercial use; the whole stack lives on Cloudflare's free tier until revenue justifies Workers Paid ($5/mo).
3. **Client pays compute** (hard rule 6): image signing and hashing happen in the visitor's browser via WASM wherever possible.
4. **Maintained by Claude, supervised by a non-engineer:** prefer boring, single-tool, well-documented choices over clever ones. Fewer moving parts beats marginal performance.
5. **Never overclaim C2PA** (hard rule 5): our signatures are self-signed → "unknown source" in the official Verify tool. The stack must make *our own* verify page + chain anchor first-class, because that is the trust story v1 can actually deliver.

---

## 1. (a) Browser C2PA signing — `@contentauth/c2pa-web`

| | |
|---|---|
| **Locked choice** | `@contentauth/c2pa-web` **0.12.0** (published 2026-06-16; verified via `npm view` 2026-07-06) |
| **License** | Adobe open-source (part of contentauth/c2pa-js monorepo) |
| **Cost** | $0 — WASM runs in the visitor's browser |

### What we verified (by downloading and inspecting the 0.12.0 tarball, 2026-07-06)

The signing API is **real and shipped**, not roadmap. From `dist/lib/builder.d.ts` in the published package:

```typescript
// Builder interface, @contentauth/c2pa-web@0.12.0
sign: (signer: Signer, format: string, blob: Blob) => Promise<Uint8Array>;
signAndGetManifestBytes: (signer: Signer, format: string, blob: Blob)
  => Promise<ManifestAndAssetBytes>; // { manifest: Uint8Array; asset: Uint8Array }
```

And from `dist/lib/signer.d.ts`:

```typescript
export type SigningAlg = 'es256' | 'es384' | 'es512' | 'ps256' | 'ps384' | 'ps512' | 'ed25519';
export interface Signer {
  sign: (data: Uint8Array, reserveSize: number) => Promise<Uint8Array>;
  reserveSize: () => Promise<number>;
  alg: SigningAlg;
}
```

Also present: `Reader` (read manifests), `Builder.setIntent('create'|'edit'|'update')`, `addAction`, `addIngredientFromBlob`, `setRemoteUrl` + `setNoEmbed` (remote-manifest support — relevant for our registry later), `setThumbnailFromBlob`, `toArchive`/`fromArchive`. The repo README confirms the old `c2pa` package (npm `c2pa` 0.30.17) is **legacy/deprecated** — moved to `c2pa-js-legacy`; do not use it ([github.com/contentauth/c2pa-js](https://github.com/contentauth/c2pa-js)).

### The one architectural insight this API gives us for free

`Signer` is a **callback interface**. The WASM does all the heavy work in the browser (parse image, build manifest, hash, embed JUMBF), then calls our `sign(data, reserveSize)` function with a small byte payload to be COSE-signed. That means:

> **The private key never ships to the browser.** Our `Signer.sign` implementation POSTs the to-be-signed bytes (a few KB, not the image) to a Cloudflare Worker endpoint. That endpoint does more than one bare signature: verified against the 0.12.0 typings, `Signer` is only `{sign, reserveSize, alg}` and the package's `Settings` type has no certificate field anywhere — so the Worker must return a complete **COSE_Sign1 structure carrying our X.509 certificate chain in the `x5chain` header**, assembled server-side (the c2pa-rs remote-signing model). The ECDSA P-256 primitive itself is native WebCrypto (`crypto.subtle.sign`); the CBOR/COSE assembly around it is real code and real CPU — measure it in the September signing-credential spike (§2), don't assume "~1 ms". Client still pays the heavy compute (manifest build, hashing, JUMBF embedding over the full image); the OzDNA signing key stays in a Worker secret.

This is the recommended production pattern (remote/callback signing) in CAI's own docs ([opensource.contentauthenticity.org/docs/signing/local-signing/](https://opensource.contentauthenticity.org/docs/signing/local-signing/)). Key management is first-class from day one (BLUEPRINT §3 — Nikon's revoked program is the cautionary tale): the key lives only in `wrangler secret`, is rotatable, and every signature request is logged. **Where the certificate comes from, its validity period, rotation, and the timestamp countersignature are specified in §2 "Signing credential" — read that before implementing this endpoint.** UNVERIFIED: the exact byte payload c2pa-web hands to `sign()` (COSE to-be-signed bytes vs. a fuller structure) — pin it down in the September spike before writing the Worker endpoint (§17.9).

### Practical notes for the implementing session

- The WASM binary in the package (`dist/resources/c2pa_bg.wasm`) is **8.35 MB uncompressed** (measured from the 0.12.0 tarball). Serve it as a **Workers static asset** on our own domain (25 MiB/file limit — fits; static asset requests are free and unlimited, see §6). Do **not** use the `/inline` build (base64-bloats the JS bundle) and do not rely on jsDelivr at runtime (third-party availability + privacy).
- Two import modes: separate `.wasm` fetch (recommended, supports `WebAssembly.compileStreaming`) or inline. Use separate.
- The library targets modern evergreen browsers and runs its own Web Worker (`c2pa_worker.js`) — the signing page must be served with appropriate CORS/COEP headers if `SharedArrayBuffer` paths are used; test early.
- Version churn is real (0.7 → 0.12 in four months, pre-1.0). **Pin the exact version** in `package.json` (no `^`), and budget one afternoon in October to absorb API changes.
- Repo dev prerequisites: Node.js ≥ 22 (from the package README) — matches our local toolchain (§15).

### Alternatives considered

| Alternative | Why rejected |
|---|---|
| npm `c2pa` (legacy JS SDK) 0.30.17 | Officially deprecated; repo moved to `c2pa-js-legacy`. Read-only focus, old API. |
| `@contentauth/c2pa-node` 0.6.0 (c2pa-node-v2, native Rust bindings) server-side for the web flow | Violates "client pays compute"; needs a Node runtime we don't have on Workers; reserved as **fallback** (below). |
| `@trustnxt/c2pa-ts` in the browser | Works, but c2pa-web wraps the reference Rust implementation (`c2pa-rs`) — maximum spec fidelity and Adobe-maintained. c2pa-ts is our *server*-side tool (§2). |

### Decision rule / fallback (if browser signing hits a wall in week 1 of the build)

**Acceptance test (run in build week 1):** sign a 10 MB JPEG and a 5 MB PNG in-browser on a mid-range laptop in < 15 s each; output must validate cleanly in `c2patool` and read correctly in the official Verify tool (showing "unknown source" — expected, per hard rule 5, since we are self-signed and the interim trust list froze Jan 1, 2026). Precondition: the September signing-credential spike (§2) has already proven the cert + COSE + `c2patool` round-trip on a laptop — week 1 only re-runs it wired through the real Worker endpoint, so this test never absorbs unplanned credential work.

If it fails: fallback is **`@contentauth/c2pa-node` 0.6.0 (c2pa-node-v2) as a tiny signing microservice on Vercel Pro ($20/mo — the one pre-approved fixed cost)**, called from the same frontend. Vercel functions allow 250 MB uncompressed bundles (fits the native binding; set `C2PA_LIBRARY_PATH` to skip Rust compilation in CI — per `docs/research-2026-07-06.json`). Do NOT put this on Vercel Hobby (commercial-use ban, hard rule 7). Cloudflare Containers were considered and rejected for v1: they require Workers Paid plus per-container charges and add an ops surface a non-engineer doesn't need.

---

## 2. (b) Server-side C2PA read/verify/sign on Workers — `@trustnxt/c2pa-ts`

| | |
|---|---|
| **Locked choice** | `@trustnxt/c2pa-ts` **0.14.0** (published 2026-04-21; verified via `npm view` 2026-07-06) |
| **License** | Apache-2.0. Maintained by TrustNXT GmbH (Hamburg); active release cadence (9 releases Nov 2025 → Apr 2026) |
| **Cost** | $0 (pure TypeScript, zero native deps — runs on Workers as-is) |

### Verified capabilities (from the 0.14.0 README, npm, 2026-07-06)

| Capability | Status in 0.14.0 |
|---|---|
| Reading manifests | ✅ complete |
| **Creating (signing) manifests** | ✅ complete — with a pluggable signer; Workers' WebCrypto covers ES256 |
| Validating manifests | 🚧 "mostly implemented **except chain-of-trust validation**" |
| Formats | ✅ JPEG, PNG (our entire v1 scope), plus HEIC/HEIF, MP3, MP4; ❌ GIF/TIFF/WebP |
| Spec target | C2PA **2.1** (reads older-version structures for back-compat) |
| Assertions | Data Hash ✅, Thumbnail ✅, Actions ✅, Ingredient ✅, Metadata ✅, Training & Data Mining ✅ (the assertion our AI Act customers need) |

The README carries a plain warning: *"This library is under active development and not fully functional yet. Proceed with caution!"* — take it seriously, see mitigations below.

### What each capability is used for

1. **The `/verify` path (public verify page + API `GET /v1/verify`):** read the manifest from an uploaded image, cryptographically validate it, and cross-check the content hash against our D1 registry + on-chain anchor. The missing chain-of-trust validation in c2pa-ts is **acceptable for v1** because our trust story is *our own registry + anchor*, not the C2PA trust list (which we can't be on yet anyway — hard rule 5). For assets signed by *others* (Adobe, cameras), the verdict copy enumerates only what we actually checked — e.g. "hash and signature checks passed; full trust evaluation at verify.contentauthenticity.org" — and never renders our own trust verdict, nor the stronger phrase "signature cryptographically valid". Reason: c2pa-ts describes its own validation as only "mostly implemented" ("proceed with caution"), and a tampered manifest the immature validator misses would otherwise be labeled "valid" by a company whose entire brand is trust (rule-5-adjacent overclaim). **Validation differential test (build week 1 gate):** run c2pa-ts verdicts against `c2patool` on a corpus that includes tampered/malformed assets from the CAI public test-file sets; the stronger copy is allowed only after this test passes with zero verdict divergence. (OzDNA-signed assets are unaffected either way: their verdict comes from our registry SHA-256 + anchor cross-check, independent of c2pa-ts.)
2. **The API signing path (wedge #1, paying customers):** compliance customers POST an image to our REST API and get back a signed image. This *cannot* be browser signing — it's server-to-server. c2pa-ts creates and signs the manifest on the Worker using WebCrypto with the same ES256 key (Worker secret) **and the same certificate chain** — c2pa-ts's signing path explicitly requires `certificate: X509Certificate; chainCertificates: X509Certificate[]` (verified in the 0.14.0 typings); see "Signing credential" below. **Interop acceptance test (build week 1): images signed by c2pa-ts must validate in `c2patool` (c2pa-rs) byte-for-byte-compatibly.** This is the single riskiest technical assumption in the stack — test it before building anything on top. **Rule-6 note (ratified 2026-07-06):** this server-side signing path is the *sanctioned primary revenue mode*, not a pending exception. Hard rule 6 has been amended in CLAUDE.md accordingly: the **free** flow signs client-side in-browser (the client pays compute); **paid** API tenants may use our metered server-side Worker compute, priced into their tier — so we never pay compute for free users, where $49+/mo revenue funds Workers Paid by definition. Full-image server-side signing (`04-MVP-SPEC.md`'s `POST /v1/marks`) is the sanctioned primary revenue path, no longer "pending sign-off"; the SDK/hash mode (client hashes, we assemble/sign) remains an available option, not the default posture. Do not "fix" this by removing the primary revenue path — it is the product.

### Signing credential — the X.509 layer both signing paths share

C2PA signing is not "a key signs bytes": every manifest embeds an **end-entity X.509 certificate (plus chain)** in the COSE `x5chain` header, and validators evaluate the signature against that certificate. Neither §1 nor this section works without answering where that certificate comes from. Locked answers:

- **Generation (one openssl session on the founder's laptop, $0):** a minimal self-signed ES256 chain — OzDNA root CA + one end-entity signing cert on curve prime256v1 (`openssl ecparam -name prime256v1 -genkey -noout -out signer.key`, then a root cert and a root-signed end-entity cert; exact commands recorded in the spike notes when run). Self-signed is deliberate and fine: it is exactly why the official Verify tool shows "unknown source" (hard rule 5 — our copy says so and never promises "trusted Content Credentials").
- **Validity period:** end-entity cert **3 years** (through mid-2029), root **10 years**. Long enough to outlive v1; short enough to force a practiced rotation.
- **Storage:** the certificate chain is **public** material — it ships inside every signed image anyway — so the PEMs live in `wrangler.jsonc` vars and the repo. The **private key** lives only in `wrangler secret` (staging and prod use different key+cert pairs), same discipline as the anchor wallet.
- **Rotation:** issue a new end-entity cert from the same root; previously signed assets keep their embedded cert and stay verifiable; registry rows record the signing cert's serial per asset. Rotate immediately on suspicion of compromise, otherwise at expiry-minus-6-months.
- **COSE assembly on the Worker (browser flow, §1):** the endpoint behind c2pa-web's `Signer` callback assembles the COSE_Sign1 with `x5chain` server-side — reuse c2pa-ts's `cose` module (already in the stack) rather than hand-rolling CBOR.
- **Timestamp countersignature — the silent-expiry trap:** without an RFC 3161 timestamp-authority (TSA) countersignature, C2PA signatures generally stop validating once the signing cert expires — "proof that survives" would silently break in 2029, and no acceptance test above would catch it (`c2patool` validates fine until expiry day). Decision: **attempt a free public TSA (e.g. DigiCert, `http://timestamp.digicert.com`) in the September spike.** If our signing paths can't attach it cleanly, ship without it and make the copy say so explicitly: *C2PA-level validity is bounded by our certificate lifetime; the Base anchor is the long-term, expiry-proof timestamp.* Either way this is a rule-5-critical copy decision made by the spike outcome, never left implicit.
- **September laptop-only spike (pre-build, $0, no deploy — fits hard rule 8):** generate the cert chain → sign a JPEG via c2pa-ts with it → assemble a COSE_Sign1 for a c2pa-web-shaped callback → round-trip through `c2patool` (and Verify: expect "unknown source") → attempt the TSA countersignature. This de-risks the most under-specified layer of the stack *before* the already-full October build week 1.

### CPU budget reality check

Workers free tier allows **10 ms CPU per request** ([developers.cloudflare.com/workers/platform/limits/](https://developers.cloudflare.com/workers/platform/limits/)). Manifest *reading* of a JPEG is mostly parsing + one SHA-256 over the image via native `crypto.subtle.digest` — feasible but tight for large files on free. Manifest *creation* + hashing + JUMBF embedding in pure TS will exceed 10 ms for multi-MB images. Therefore:

> **Phase rule (aligned 2026-07-06 to 06-COST-MODEL §2 and 04-MVP-SPEC §8, the owners):** the pre-build phase (landing, waitlist — Jul–Sep) runs on Workers **Free**. **Workers Paid ($5/mo — 30 s CPU default, up to 5 min; 10 MB script limit) is switched on during the October build (start of W3) and stays on from launch day**, voluntarily — free-tier limits are hard daily caps (one PR spike would take the API down), and test-key customers must be able to evaluate server-side signing before paying (01-ARCHITECTURE §3.2). An earlier draft of this rule ("$0 fixed until first revenue" / "at first paying customer") is superseded.

### Fallbacks

| Failure mode | Fallback |
|---|---|
| c2pa-ts signing output fails c2patool interop | Fall back to `@contentauth/c2pa-node` 0.6.0 on Vercel Pro ($20/mo, pre-approved) for the API signing path only; keep c2pa-ts for reads. |
| c2pa-ts read/validate gaps bite | `@contentauth/c2pa-wasm` 0.9.0 (the wasm-bindgen build behind c2pa-web) *might* run on Workers Paid (10 MB compressed limit; the 8.35 MB WASM likely compresses under it). UNVERIFIED: c2pa-wasm on the Workers runtime is untested — it may assume browser APIs. Treat as an experiment, not a plan. |

---

## 3. (c) Perceptual hashing — OzDNA pHash v1 + PDQ-256 (`pdq-wasm`), `@cf-wasm/photon` for server-side decode

| | |
|---|---|
| **Locked choice (fast match hash)** | **OzDNA pHash v1** — our own DCT-based 64-bit perceptual hash (~70-line TS, identical in browser and Worker); normative spec in `03-ALGORITHMS.md` (the owner) |
| **Locked choice (confirmation hash, stored from day one)** | **PDQ-256** via `pdq-wasm` **0.3.9** — the stronger secondary/confirmation hash, stored alongside pHash v1 on every asset |
| **Locked choice (server-side image decode)** | `@cf-wasm/photon` **0.3.6** (Apache-2.0, published 2026-05-29 — actively maintained; "Photon library for Cloudflare workers, Next.js and Node.js") |
| **Cost** | $0 |

### Why this set (two hashes computed the same way in both runtimes)

The DNA registry's moat is: *the same image must produce the same fingerprint whether hashed in a visitor's browser at signing time or on our Worker at verify/API time.* That forces one implementation of the hash math shared by both runtimes — which rules out anything native (sharp) and anything browser-only (canvas-coupled libs).

- **OzDNA pHash v1 (fast match hash)** is our own DCT-based 64-bit perceptual hash — ~70 lines of dependency-free TypeScript that we own outright, so it is byte-identical in the browser and on the Worker by construction and immune to npm-supply-chain surprises. It is the hash the D1 band-lookup probes at verify/API time. The normative spec (DCT parameters, canonical size, bit layout, Hamming-distance match thresholds) is **owned by `03-ALGORITHMS.md`** — this document only records that pHash v1 is the locked fast hash.
- **PDQ-256 (confirmation hash), via `pdq-wasm` 0.3.9,** is stored on every asset from day one as the stronger, industry-credible fingerprint (PDQ speaks the NCMEC/GIFCT language the fact-checker audience knows). It is not the primary lookup hash in v1 — it is the confirmation/tie-break column and the upgrade path. Two **approved September spikes** de-risk it before the October build: **(1) a `pdq-wasm` build/integration spike** — does 0.3.9 compile and run identically in the browser and on workerd; and **(2) a golden-image cross-runtime test including EXIF-orientation handling** — the same corpus must produce identical pHash v1 *and* PDQ-256 outputs in both runtimes.
- **Pixel sources:** in the **browser**, decode via `<canvas>`/`OffscreenCanvas` → `getImageData()` (free, native). On the **Worker** (no canvas API), decode + resize via `@cf-wasm/photon` (Rust `photon-rs` compiled to WASM, packaged specifically for Workers) → raw RGBA → the same pHash v1 and PDQ-256 routines.
- **Normalization pipeline (critical for cross-runtime consistency):** decode → apply EXIF orientation → resize to the canonical size (owned by 03) → RGBA → hash. JPEG decoders can differ by ±1 LSB per pixel between canvas and photon; the DCT/quantisation step absorbs this, but the resize step must be pinned (same target size, same filter) on both sides and EXIF orientation normalised identically — exactly what September spike (2) proves. Canonical size, bits, and Hamming-distance match thresholds are **owned by `03-ALGORITHMS.md`** — this document only locks the libraries.
- **CPU:** photon decode+resize of a multi-MB JPEG costs tens of ms — fine on Workers Paid (API path), too hot for the free tier. Consistent with the §2 phase rule: the browser computes the hashes in the free flow (client pays); the Worker computes them only on the paid API path.

### Alternatives considered

| Option | Verdict (verified 2026-07-06) |
|---|---|
| `blockhash-core` 0.1.0 (blockhash, pure JS) | ❌ **Considered and rejected.** Earlier drafts of this doc locked it; `03-ALGORITHMS.md` (the owner) rejects it and this doc now agrees. npm shows 0.1.0 **last published 2019-12-07** — unmaintained (not the "2022" an earlier draft assumed); the algorithm is **DCT-less** (block-average, not frequency-domain) and measurably weaker than a DCT hash. Superseded by OzDNA pHash v1 + PDQ-256. |
| `sharp-phash` 2.2.0 (DCT pHash) | ❌ Requires `sharp` (native libvips) — **cannot run on Workers or in browsers**. Node-only. Rejected. |
| `image-hash` 7.0.1 | ❌ Node-only (uses jimp/file I/O internally), not runtime-portable. |
| `jimp` 1.6.1 pure-JS decode on Worker | Viable but slower and heavier than photon's WASM; photon is purpose-built for Workers. Kept as fallback decoder if `@cf-wasm/photon` breaks. |

### Licensing note

OzDNA pHash v1 (our own code), `pdq-wasm` 0.3.9 (confirm the exact published license during the September integration spike), photon Apache-2.0, c2pa-ts Apache-2.0, c2pa-web Adobe OSS — all compatible with a commercial SaaS, no copyleft obligations.

---

## 4. (d) Frontend — Astro (static output) served as Workers Static Assets

| | |
|---|---|
| **Locked choice** | **Astro 7** (7.0.6 current, published 2026-07-02; pin `^7` and take the latest 7.x at build time) + `@astrojs/sitemap` 3.7.3. Deployed as **static assets on a Cloudflare Worker** (not Cloudflare Pages — see below). `@astrojs/cloudflare` 14.1.1 adapter only if a page later needs SSR; v1 needs none. |
| **Cost** | $0 — static asset requests on Workers are **"free and unlimited"** and don't count against the 100k/day Worker request quota ([developers.cloudflare.com/workers/static-assets/billing-and-limitations/](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)) |

### Why Astro (vs the alternatives)

- **SEO is the acquisition strategy** (customers ranked: wedge #1 is won on "EU AI Act content marking" queries). Astro emits zero-JS static HTML by default — perfect Core Web Vitals, trivial meta/OG/sitemap/schema.org control, content collections for the SEO article library the founder will write. This is the single most SEO-native framework that still allows interactive islands.
- **Interactive islands where needed:** the `/sign` page (c2pa-web WASM UI) and `/verify` page (file-drop + API call) are Astro islands (vanilla TS or Preact — implementer's choice, prefer vanilla to keep deps minimal). The rest of the site is pure HTML.
- **Low maintenance for future Claude sessions:** file-based routing, markdown content, one config file. No app server, no hydration debugging.

| Alternative | Why rejected |
|---|---|
| Next.js on Workers (OpenNext / next-on-pages) | Massive framework surface for a site with two interactive pages; adapter layer churn; slower builds; worse SEO defaults (client JS by default). Wrong tool for a content-led site. |
| Plain HTML (keep partner's Netlify skeleton) | Considered — see below. Rejected: no components/layouts means every SEO article is copy-paste HTML; consolidating on one host (Cloudflare) beats keeping a second platform for free; Workers static hosting is equally free with no build-minute caps that matter. |
| Hugo/Eleventy | Fine SSGs, but no first-class islands story for the WASM signing page; Astro covers both worlds with one tool. |

### Keep-or-port decision for the partner's skeleton

**Port, don't keep.** The current ozdna.com (partner's unrelated LLM-cost site, plain HTML on Netlify) is being migrated off the domain. **Planning assumption: domain reclaimed and DNS on Cloudflare by September 1, 2026** — no authoritative date exists anywhere (earlier drafts of this doc said "mid-July per CLAUDE.md" and "by October"; CLAUDE.md contains no domain note — dangling citation removed), so the date is UNVERIFIED (§17.10) and an open founder question (§18.3). September 1 is the latest date that keeps the September Paddle application (which reviews the live site), SPF/DKIM email setup, and Workers routes off the critical path. If reclaim slips past the Paddle application, we apply with a workers.dev/staging URL — a weaker approval submission. Reuse: the `llms.txt` idea (ship `/llms.txt` as an Astro static file — cheap AI-search visibility), and any DNS learnings. Everything else is rebuilt in Astro under Cloudflare. One platform, one deploy command, one mental model.

### Why Workers Static Assets and not Cloudflare Pages

Cloudflare's own guidance for new projects in 2026: build on **Workers with static assets**; Pages still works but new features land Workers-first ([developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)). One Worker serves the Astro `dist/` (free, unlimited) *and* can front the API — one deployment unit, one `wrangler.jsonc`. Limits verified: 20,000 files/version and 25 MiB/file on free — the 8.35 MB c2pa WASM ships as a static asset comfortably ([developers.cloudflare.com/workers/platform/limits/](https://developers.cloudflare.com/workers/platform/limits/)).

---

## 5. (e) API framework — Hono + `@hono/zod-openapi` + Scalar docs

| | |
|---|---|
| **Locked choice** | **Hono 4.12.28** + **`@hono/zod-openapi` 1.4.0** (peer-verified against hono ≥4.10, zod ^4 — we pin **zod 4.4.3**) + **`@scalar/hono-api-reference` 0.11.8** for the `/docs` page |
| **Cost** | $0 (all MIT, run inside the Worker) |

### Why

- **Hono** is the de-facto standard Workers framework: tiny (fits free tier's 3 MB limit with room to spare), Web-standard `Request`/`Response`, first-class Cloudflare bindings typing, massive ecosystem. Boring in the best way.
- **`@hono/zod-openapi`**: routes are *defined by* zod schemas → runtime request validation and the OpenAPI document are the same source of truth — they cannot drift. It generates **OpenAPI 3.1**. For a compliance-adjacent product, a clean, accurate, always-current OpenAPI spec at `/openapi.json` is itself a sales asset (wedge #1 customers are developers).
- **Scalar** renders `/openapi.json` as a polished interactive docs page — one middleware line, no separate docs site to maintain. (Alternative `chanfana` 3.3.0, Cloudflare's own OpenAPI framework, is credible; rejected because `@hono/zod-openapi` is Hono-official, zod-4-native, and keeps validation and spec in one artifact. `hono-openapi` 1.3.1 also exists; same reasoning.)
- The concrete endpoint list, schemas, and error envelope are **owned by `04-MVP-SPEC.md`**.

---

## 6. (f) Data layer — D1 (source of truth) + R2 (bytes) + KV (cache), migrations via Drizzle

| | |
|---|---|
| **Locked choices** | **Cloudflare D1** (SQLite) + **R2** + **KV**, with **drizzle-orm 0.45.2 / drizzle-kit 0.31.10** for schema + migrations (applied via `wrangler d1 migrations apply`) |
| **Cost** | $0 within verified free limits below |

### Free-tier limits (all verified 2026-07-06 on developers.cloudflare.com)

| Service | Free limits | Source |
|---|---|---|
| **D1** | 10 databases; 500 MB/db; 5 GB total; **5M rows read/day; 100k rows written/day**; 50 queries per Worker invocation; 100 KB max SQL statement | [d1/platform/limits](https://developers.cloudflare.com/d1/platform/limits/), [d1/platform/pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| **R2** | 10 GB storage; 1M Class A ops/mo; 10M Class B ops/mo; **egress free** (Standard storage only) | [r2/pricing](https://developers.cloudflare.com/r2/pricing/) |
| **KV** | 100k reads/day; **1k writes/day**; 1 GB storage | [kv/platform/limits](https://developers.cloudflare.com/kv/platform/limits/) |
| **Queues** | Available on free plan: 10k operations/day | [queues/platform/pricing](https://developers.cloudflare.com/queues/platform/pricing/) |
| **Cron Triggers** | 5 per account on free | [workers/platform/limits](https://developers.cloudflare.com/workers/platform/limits/) |

### What lives where (plain language: D1 is the database, R2 is the file cabinet, KV is the sticky note)

| Data | Store | Why |
|---|---|---|
| Registry records (asset id, SHA-256, perceptual hash + band columns for candidate lookup, anchor batch id, created_at, customer id), customers, API keys (hashed), waitlist, anchor batches | **D1** | Relational queries (hash-band candidate lookup, per-customer usage counts) need SQL. 500 MB ≈ millions of rows of this shape. Row budget: even 10k signs/day ≈ ~50k writes/day — half the free write cap. |
| Manifest bytes (`.c2pa`), thumbnails (≤ ~50 KB webp) | **R2** | Blobs don't belong in SQLite; R2 egress is free so the verify page can serve thumbnails at zero cost. Keyed by asset id. |
| Hot verify-page lookups | **KV** (cache only, TTL) | Absorbs read spikes (e.g. a viral verify link) without touching D1. **Never** source of truth — KV's 1k writes/day cap means write-through caching only on read-miss. |
| Rate-limit counters | **Workers Rate Limiting binding** — never KV | Counters write on ~every request: KV's 1k writes/day free cap would be exhausted in minutes, and its 1 write/sec/key ceiling (all plans) fails exactly during the burst a limiter exists to stop. The Rate Limiting binding is on-box, free, Cloudflare-native. Fallback if its per-location approximation ever matters: a SQLite-backed Durable Object (free tier exists). |

- **Hamming-distance matching on D1:** SQLite has no native hamming search. v1 uses multi-index banding per `03-ALGORITHMS.md` §2 (the owner): the 64-bit hash splits into 4 indexed 16-bit band columns, probed with multi-index variants (complete to d ≤ 10 at probe radius 2); candidates get an exact Hamming re-rank in the Worker. Pure SQL, no extra service.
- **Why Drizzle (vs raw SQL / Prisma / kysely):** drizzle-kit generates plain `.sql` migration files that `wrangler d1 migrations apply` runs natively — no runtime magic, TypeScript-typed queries, officially documented D1 driver, and it's the ORM `better-auth` (§10) peers with (`drizzle-orm ^0.45.2` — exact match with our pin, verified via npm peerDependencies 2026-07-06). Prisma's engine story on Workers is heavier; raw SQL loses type safety for future Claude sessions.
- **Backups:** D1 Time Travel gives 30-day point-in-time restore on all plans; additionally, a weekly cron Worker exports critical tables as JSONL to R2 (belt and suspenders, still $0).

---

## 7. (g) Anchoring — Base L2, minimal event-emitting contract, viem

| | |
|---|---|
| **Locked choices** | **Base mainnet** (chain id 8453) for anchors; **Base Sepolia** (84532) for tests; **viem 2.54.6** as the only chain library; a ~15-line Solidity contract compiled/deployed with **Foundry** (solc 0.8.x line, currently 0.8.35); Merkle construction per **`03-ALGORITHMS.md` §3.3** (the owner: hand-rolled ~50-line SHA-256 tree with 0x00/0x01 domain separation and committed test vectors — no external Merkle library; `@openzeppelin/merkle-tree`'s keccak/sorted-pair format is incompatible with that spec, and this document's earlier lock on it is withdrawn) |
| **Cost** | Base typical tx < $0.01 post-EIP-4844 (range $0.001–0.05 — [docs.base.org network fees](https://docs.base.org/base-chain/network-information/network-fees), [l2fees.info](https://l2fees.info/)); worst case **~96 tx/day ≈ $53/yr** gas under the threshold cron (`03-ALGORITHMS.md` §3.6), far less at MVP volume; one-time wallet funding ~$10–20 of ETH on Base lasts a year+ |

### Design: event-emitting contract, not raw calldata

One contract, one function, one event:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract OzDNAAnchor {
    event Anchored(uint256 indexed batchId, bytes32 merkleRoot, uint256 count);
    uint256 public nextBatchId;
    address public immutable owner = msg.sender; // deployer = our gas wallet
    function anchor(bytes32 merkleRoot, uint256 count) external {
        require(msg.sender == owner, "not owner");
        emit Anchored(nextBatchId++, merkleRoot, count);
    }
}
```

> **Resolved (2026-07-06 ratification):** the contract above is illustrative only. The canonical anchor contract is **`03-ALGORITHMS.md` §3.5's `OzDnaAnchor`** — the more developed variant with an offline **rotator** key that can swap the hot operator key after a gas-wallet compromise (no forced redeploy, no batch-id sequence pollution). Build the Foundry contract from 03 §3.5, not from the sketch above.

**Why a contract + event instead of calldata-to-self (which is ~21k gas, marginally cheaper):**
1. Events are queryable via standard `eth_getLogs` — the public verify page proves anchor inclusion with a free public RPC call, no indexer, no archive-node dependency on calldata parsing.
2. A deployed, verified contract on Base **is the artifact for Base Builder Grants** (retroactive 1–5 ETH + Base Batches — BLUEPRINT §6). Calldata-to-self is invisible to grant reviewers.
3. Cost difference at our volume is fractions of a cent per day.

**Why Base (vs alternatives):** cheapest credible EVM L2 with a grants program we already target; Numbers' Capture anchors on Base at ~$0.0001/asset — proof the economics work (BLUEPRINT §2). Chain-agnostic by design: the anchor is just `(merkleRoot, timestamp)` — redeployable on any EVM chain for other ecosystems' grants without re-architecture. viem ships `base` and `baseSepolia` chain configs built in.

**Batching flow (mechanism owned by `03-ALGORITHMS.md` §3.4):** a **Cron Trigger** (free plan allows 5/account) runs **every 15 minutes** and anchors a batch **only if** one of three thresholds is met — **(pending ≥ 100)** OR **(oldest pending ≥ 23h)** OR **(any paid-tier item ≥ 40 min old)**. When it fires: pull unanchored registry rows from D1 → build Merkle tree (per `03-ALGORITHMS.md` §3.3) → `anchor(root, count)` via viem `walletClient` → store tx hash + per-asset Merkle proofs back in D1. This drives the public SLA copy **"within 24h (free) / within 1h (paid)"**, while the ToS legal floor stays "no tighter than 7 days" (`05-RISK-REGISTER.md` T9, unchanged). Worst case is **~96 tx/day ≈ $53/yr** (03 §3.6). Queues (10k ops/day free) remain available for finer-grained anchoring later, but the threshold cron is simpler and fine for v1.

**Mainnet from MVP day one (October) — decided:** the public free signing flow anchors to Base **mainnet** from launch, wallet funded by the founder in late September (§18.2; ~$0.50/mo booked in §16). Testnet-only anchors for real users' assets would make "blockchain-anchored" launch copy an overclaim (hard rule 5). Sepolia is staging-only, always.

**Anchor-cron CPU budget (add to the build-week-1 measurement pass, §17.8):** the 10 ms CPU limit on Workers Free applies to cron invocations too, and a JS SHA-256 Merkle build over thousands of leaves plus viem's pure-JS secp256k1 transaction signature can exceed it well below the 10k signs/day volume §6 uses for its D1 math. Mitigations, in order: the threshold cron already bounds batch size (the pending ≥ 100 trigger caps the tree at ~100 leaves rather than a full day's accumulation), chunk the tree build across invocations if a batch ever runs hot, and note that Workers Paid ($5/mo, 30 s CPU) removes the problem the day the first API customer pays.

**Gas wallet ops (hard rule 2 compliant — it's OUR wallet, holds only our own gas money, never user funds):**
- Fresh EOA generated offline; private key only in `wrangler secret put ANCHOR_PRIVATE_KEY` (staging and prod use *different* keys/wallets).
- Fund once with ~$10–20 of ETH bridged to Base (founder does this manually via a CEX withdrawal to Base — cheapest path, one-time).
- The anchor cron also checks `getBalance`; below 0.002 ETH it emails the founder via Resend (§11). A second guard: if a send fails, the batch stays unanchored in D1 and retries next run — anchoring is eventually-consistent by design, never data-lossy.
- RPC: Base's public endpoint `https://mainnet.base.org` (free) with a fallback public RPC configured in viem's transport fallback. No paid RPC plan.

**Test plan:** all contract logic developed against **Base Sepolia** (chain id 84532; funded via the Coinbase Developer Platform faucet — UNVERIFIED: current faucet daily allowance). Foundry unit tests for the contract (trivial); a staging Worker cron anchors to Base Sepolia continuously for a week before mainnet deploy. Mainnet contract deployed once, verified on Basescan (free), address recorded in `wrangler.jsonc` vars.

---

## 8. (h) Payments — Paddle (merchant of record) primary, Polar backup ⚠️ LOAD-BEARING

### The problem being solved

Find Below Ventures is a **UAE Sharjah free-zone company** with a founder **resident in Turkey**. Stripe does not support Turkey-based accounts at all. Stripe **does** operate in the UAE (free-zone establishments explicitly supported, trade license + UAE business verification required — [support.stripe.com/questions/what-types-of-businesses-can-open-a-uae-account](https://support.stripe.com/questions/what-types-of-businesses-can-open-a-uae-account), [uae-account-activation-requirements](https://support.stripe.com/questions/uae-account-activation-requirements)) — **but Stripe is not a merchant of record**: selling $49–199/mo subscriptions into the EU splits by buyer type. **B2C** sales of digital services by a non-EU supplier trigger EU VAT registration/collection/filing from the first euro (non-Union OSS scheme); **B2B** customers with valid VAT IDs are reverse-charge — they self-account, and pure B2B needs no EU VAT registration from us. Our base is mixed (wedge #1 is mostly B2B; wedge #2's Etsy sellers are consumer-ish), and the registration + invoicing + filing admin across that mix is what kills direct Stripe for a solo founder at launch. A **merchant of record (MoR)** resells our product, becomes the seller of record, and handles all EU VAT / global sales tax.

### Verified options (all checked 2026-07-06)

| Provider | Fee | Monthly | Seller in UAE? | EU VAT handled? | Notes |
|---|---|---|---|---|---|
| **Paddle** (locked: PRIMARY) | **5% + $0.50** all-in, no surcharges | $0 | ✅ UAE (and Turkey) absent from Paddle's unsupported-sellers list — "works with software businesses anywhere in the world" minus a sanctions list ([paddle.com/help — which countries are supported](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle)) | ✅ full MoR, 270+ jurisdictions ([paddle.com/pricing](https://www.paddle.com/pricing)) | Vendor approval process reviews your site; B2B reverse-charge VAT handled (matters: our buyers are EU businesses) |
| **Polar** (locked: BACKUP) | Starter: **5% + $0.50** (+**1.5% non-US cards** — hits us hard, EU customer base) ; Pro $20/mo: 3.8% + $0.40 | $0 (Starter) | ✅ UAE and Turkey **explicitly listed** as payout countries via Stripe Connect Express ([polar.sh/docs/merchant-of-record/supported-countries](https://polar.sh/docs/merchant-of-record/supported-countries)) | ✅ MoR | Stripe payout fees passed through ($2/mo active payout + 0.25% + $0.25/payout) ([polar.sh/docs/merchant-of-record/fees](https://polar.sh/docs/merchant-of-record/fees)); open-source, developer-first, great API |
| Lemon Squeezy | 5% + $0.50 | $0 | ⚠️ | ✅ MoR | ❌ **Rejected:** acquired by Stripe (Jul 2024); platform in migration limbo toward "Stripe Managed Payments" (waitlist-gated, availability unclear for UAE entities); development slowed, roadmap unclear ([lemonsqueezy.com/blog/2026-update](https://www.lemonsqueezy.com/blog/2026-update)). Do not build a new business on it in 2026. |
| Stripe UAE direct | ~2.9%+fixed region-dependent | $0 | ✅ with UAE trade license + UAE bank account | ❌ **we** handle VAT | ❌ Rejected for launch; **re-evaluate at ~$5k+ MRR** when fee savings (5% → ~3%) pay for an accountant. Connect is limited in UAE ([support.stripe.com/questions/connect-availability-in-the-uae](https://support.stripe.com/questions/connect-availability-in-the-uae)). |

### Decision

**Paddle, with Polar as the tested backup.** Reasons: flat all-in fee (Polar's +1.5% international-card surcharge applies to essentially our whole EU customer base, making real-world Polar Starter ≈ 6.5% + payout fees); Paddle is the most battle-tested MoR for exactly our shape (B2B SaaS subscriptions into the EU, seller in an unusual jurisdiction); no dependency on Stripe's country matrix.

**Risks & actions (founder, pre-October):**
1. Paddle approval is discretionary and reviews the website. Our copy already keeps blockchain as invisible plumbing (hard rule 4) — keep the pricing/landing pages free of chain/crypto vocabulary before submitting. Apply with the live landing page + clear product description in **September**, before the build, so approval isn't on the critical path. If Paddle declines: activate Polar (integration is a comparable checkout-link/webhook shape; abstract billing behind one `billing.ts` module with a provider interface from day one).
2. UNVERIFIED: Paddle's payout rails to a UAE bank account (method — wire/Payoneer — currency, minimums). Confirm with Paddle sales during approval. Polar's UAE payout is explicit (Stripe Connect), which is partly why it's the backup.
3. Integration shape (for `04-MVP-SPEC.md`): Paddle Billing hosted checkout (overlay) + webhooks (`subscription.activated` / `.canceled` → flip `customers.plan` in D1). No card data ever touches our Worker → minimal PCI surface.

---

## 9. (i) Auth — hand-rolled API keys + better-auth (magic links) for the dashboard

### API keys (the product's real auth — wedge #1 customers are machines)

No library needed; the scheme is small and must be exactly this:

- **Format (canonical: `04-MVP-SPEC.md` §4.1):** `ozdna_live_<32 random base62>` / `ozdna_test_<32 random base62>` (generated via `crypto.getRandomValues`, ~190 bits entropy — far beyond brute force). The prefix makes keys grep-able and mode-obvious (Stripe convention).
- **At rest:** store only `SHA-256(key)` (hex, **indexed** — it is the lookup key) in D1 + a short plaintext `key_prefix` column (e.g. `ozdna_live_k8Qw`, per 04-MVP-SPEC §5) for **dashboard display only** — useless for lookup (it carries only a few random characters). Raw key shown **once** at creation. SHA-256 (not bcrypt/argon2) is correct here: keys are high-entropy random strings, not human passwords — brute force is infeasible and Workers' WebCrypto does SHA-256 natively in microseconds.
- **Verification:** hash the presented key and **look up directly by the indexed `SHA-256(key)` column** — deterministic single-row fetch, since the hash is computable before the query. Then constant-time compare (`crypto.subtle.timingSafeEqual` on Workers) against the fetched row's stored hash as belt-and-suspenders. Per-key `last_used_at`, `revoked_at` columns; header `Authorization: Bearer ozdna_live_…`.

### Dashboard auth (human login — only needed once paying customers exist; likely week 3–4 of the build or post-launch)

| | |
|---|---|
| **Locked choice** | **better-auth 1.6.23** (MIT, very active — last publish 2026-07-02) with the **magic-link plugin**, **Drizzle adapter** (peers exactly with our drizzle-orm 0.45.2 pin — verified), sessions in D1, emails via Resend |
| **Why** | Runs natively on Workers/D1; magic links mean no passwords to store, no reset flows to build, and the customer's email is already their identity (it's where their invoices go). Lucia — the former community favorite — was deprecated by its author into a learning resource (UNVERIFIED: exact deprecation date), which is precisely the maintenance risk we avoid by picking the currently-maintained standard. Auth.js/next-auth is Next-shaped; rolling our own session management is the kind of security surface a non-engineer-supervised repo should not carry. |
| **Cost** | $0 |

Bot protection on public forms (waitlist, magic-link request): **Cloudflare Turnstile** — free, no-CAPTCHA widget, same platform (UNVERIFIED: exact free-tier widget limits — irrelevant at our scale of 1–2 widgets).

---

## 10. (j) Email + waitlist — Resend + D1 double-opt-in

| | |
|---|---|
| **Locked choice** | **Resend** free tier — **3,000 emails/mo, 100/day, 1 verified domain** (verified via [resend.com/pricing](https://resend.com/pricing), 2026-07-06) — SDK `resend` 6.17.1, or plain `fetch` to their REST API from the Worker (prefer plain fetch: one less dependency, the API is two endpoints for us) |
| **Backup** | Postmark (UNVERIFIED: free/developer tier currently ~100 emails/mo — third-party comparisons only); MailChannels' free Workers integration was discontinued in 2024, do not plan on it |
| **Cost** | $0 (waitlist + transactional volume is far below 100/day until we deliberately grow it; the day we exceed it is a good-news problem — Resend Pro is $20/mo but batching/digesting keeps us free longer) |

**Waitlist storage & GDPR double-opt-in (the waitlist IS the demand validation — CLAUDE.md phase ③):**

D1 table `waitlist(id, email, segment, confirmed_at, consent_text_version, created_at, confirm_token_hash, ip_country)` with `segment ∈ {'ai_company','seller_creator','fact_checker','other'}` (canonical enum: 04-MVP-SPEC §5 `waitlist` table; 07-GTM-SEO-PR §2.2 owns the visible form options that map onto it). Flow: form (+ Turnstile) → insert row with `confirmed_at = NULL` → Resend sends a confirm link containing a single-use token (hash stored, 7-day expiry) → click sets `confirmed_at`. Unconfirmed rows purged after 30 days by the weekly cron. Only `confirmed_at IS NOT NULL` rows are ever emailed. This is textbook GDPR double-opt-in: provable, timestamped consent — non-negotiable given our first customers are EU companies and our brand is *compliance*.

DNS for deliverability (founder task, 10 minutes): SPF + DKIM records for `mail.ozdna.com` subdomain in Cloudflare DNS at domain reclaim time; DMARC `p=quarantine`.

---

## 11. (k) Analytics — Cloudflare Web Analytics

| | |
|---|---|
| **Locked choice** | **Cloudflare Web Analytics** (free, one JS beacon, no cookies, no cross-site tracking, no persistent identifiers) |
| **Cost** | $0 |

**Why GA4 is rejected (and this matters for us specifically):** GA4 uses cookies/identifiers → under GDPR/ePrivacy it requires a consent banner, and its EU→US data-transfer posture has been repeatedly challenged by EU DPAs. OzDNA's entire pitch to wedge #1 is *"we make you EU-compliant"* — shipping a consent-banner-wearing, DPA-litigated analytics stack on that landing page is a credibility own-goal. Cloudflare Web Analytics is cookie-less (no banner needed for analytics), first-party, and lives in the dashboard we already use. Trade-off accepted: no ad-attribution/funnel features — we don't buy ads (PR + SEO only, founder's superpower). Search visibility is tracked where it actually lives: **Google Search Console** (free), which is the KPI source for the SEO wedge anyway.

---

## 12. (l) Error tracking — Sentry free + `wrangler tail`

| | |
|---|---|
| **Locked choice** | **Sentry Developer (free): 5,000 errors/mo, 1 user, 30-day retention** (verified via [sentry.io/pricing](https://sentry.io/pricing/), 2026-07-06) using the `@sentry/cloudflare` SDK in the Worker + browser SDK on the sign/verify islands only. Live debugging: `wrangler tail` (free, real-time logs). |
| **Why not tail alone** | `wrangler tail` only shows logs while a terminal is attached — a solo founder will not be watching. Sentry emails on new error types; 5k/mo is ample at our traffic. The 1-user limit is fine (the "user" is the founder; Claude sessions read errors via the founder's screen or the Sentry API). |
| **Discipline** | Sample noisy errors at the SDK level so one bad deploy can't burn the 5k quota in an hour (`sampleRate` + `beforeSend` dedupe). When quota is hit, Sentry silently drops — another reason the weekly review checks Sentry. |
| **Cost** | $0 |

---

## 13. (m) Repo & CI — GitHub free, wrangler, deploy-rarely

| | |
|---|---|
| **Locked choices** | GitHub free private repo (org: Find Below Ventures). **wrangler 4.107.0** (verified npm 2026-07-06; pin `^4`, update monthly-ish). `@cloudflare/workers-types` 5.20260706.1. |
| **Cost** | $0 (GitHub free includes 2,000 Actions minutes/mo on private repos — we barely use CI minutes anyway, see below) |

**Environments (Workers-native, no extra services):**

| Env | How | URL |
|---|---|---|
| local | `wrangler dev` (local D1/R2/KV simulations built in — full stack on the laptop, zero network) | localhost |
| staging | `wrangler deploy --env staging` — separate Worker + **separate** D1/R2/KV/secrets/gas-wallet, anchors to **Base Sepolia** | `staging.ozdna.com` (or workers.dev subdomain until domain reclaim) |
| prod | `wrangler deploy --env production` | `ozdna.com` |

**Deploy-rarely discipline (hard rule 8), encoded as process, not willpower:**
1. All work happens locally against `wrangler dev`; a work batch ends with `npm run check` (types + biome + vitest) green.
2. Deploy to **staging**, run the smoke script (`scripts/smoke.ts`: sign → register → verify → anchor-dry-run round-trip), founder eyeballs the page.
3. One `wrangler deploy --env production` per work batch. Tag the commit (`deploy/YYYY-MM-DD`).
4. CI (GitHub Actions) runs check+test on push — **CI never deploys**. Deploys are manual, local, deliberate (`wrangler` auth stays on the founder's machine only; no CF API token lives in GitHub — smaller attack surface and no accidental deploy-on-push).
5. Secrets only via `wrangler secret put` (prod) / `.dev.vars` (local, git-ignored). Never in `wrangler.jsonc`, never in the repo.

---

## 14. (n) Language & tooling — TypeScript strict, Vitest, Biome

| | |
|---|---|
| **Locked choices** | **TypeScript 6.0.3** (`"strict": true`, plus `noUncheckedIndexedAccess`); **Vitest 4.1.10** with **`@cloudflare/vitest-pool-workers` 0.18.0** (runs tests *inside* the workerd runtime — catches Workers-specific issues that Node-run tests can't); **Biome 2.5.2** for lint + format; Node.js 22 LTS locally (c2pa-js tooling wants ≥22). All verified npm 2026-07-06. |
| **Why Biome over eslint+prettier** | One tool, one config file, one command, ~30× faster, no plugin-version matrix to reconcile. For a repo maintained by successive Claude sessions, minimizing config surface is worth more than eslint's plugin ecosystem — we need "consistent and obviously formatted," not bespoke lint rules. |
| **Repo layout** | Single repo, npm workspaces (component map per 01-ARCHITECTURE §1): `apps/web` (Astro static site + sign/verify islands), `apps/api` (Hono Worker), `apps/anchor` (cron Worker — separate so the gas-wallet secret binds only to it, 01 §8), `packages/dna-core` (shared hash implementation per 03-ALGORITHMS + zod schemas + Merkle + hash-normalization pipeline — **one copy of the math, imported by browser and Workers**), `contracts/` (Foundry). |
| **Cost** | $0 |

---

## 15. Stack at a glance

| Layer | Choice | Version (2026-07-06) | Monthly cost |
|---|---|---|---|
| Browser signing | `@contentauth/c2pa-web` (WASM, remote-Signer callback) | 0.12.0 (pin exact) | $0 |
| Server C2PA read/sign | `@trustnxt/c2pa-ts` on Workers | 0.14.0 | $0 |
| Signing credential | Self-signed ES256 X.509 chain + Worker COSE_Sign1/x5chain assembly (§2); TSA countersignature attempted in Sept spike | — | $0 |
| Signing fallback | `@contentauth/c2pa-node` on Vercel Pro | 0.6.0 | $0 unless triggered ($20) |
| Perceptual hash | OzDNA pHash v1 (own DCT 64-bit, fast match) + PDQ-256 via `pdq-wasm` (confirmation, stored day one); `@cf-wasm/photon` (Worker decode) | pdq-wasm 0.3.9 / photon 0.3.6 | $0 |
| Frontend | Astro static → Workers Static Assets | 7.0.6 | $0 (static requests free/unlimited) |
| API | Hono + `@hono/zod-openapi` (3.1) + Scalar docs | 4.12.28 / 1.4.0 / 0.11.8 | $0 |
| Validation | zod | 4.4.3 | $0 |
| Data | D1 + R2 + KV; drizzle-orm/kit migrations | 0.45.2 / 0.31.10 | $0 |
| Anchoring | Base (8453) event contract; viem; Merkle per 03 §3.3; Foundry | viem 2.54.6 | ~$0.15–0.50 gas |
| Payments | **Paddle MoR** (backup: Polar) | — | $0 fixed; 5% + $0.50/txn |
| Auth | Hand-rolled API keys (SHA-256 at rest) + better-auth magic links | 1.6.23 | $0 |
| Email | Resend (3k/mo, 100/day free) + D1 double-opt-in waitlist | SDK 6.17.1 | $0 |
| Analytics | Cloudflare Web Analytics (+ Search Console) | — | $0 |
| Errors | Sentry Developer (5k errors/mo) + `wrangler tail` | — | $0 |
| Repo/CI | GitHub free; manual local `wrangler` deploys | wrangler 4.107.0 | $0 |
| Language/tooling | TS strict 6.0.3; Vitest 4.1.10 + workers-pool 0.18.0; Biome 2.5.2 | — | $0 |
| Bot protection | Cloudflare Turnstile | — | $0 |

### Signing flows (the two paths that matter)

```mermaid
flowchart LR
  subgraph Free web flow — client pays compute
    B[Browser: c2pa-web WASM<br/>build manifest + hash + embed] -- "few KB to-be-signed bytes" --> W1[Worker: COSE_Sign1 + x5chain cert<br/>ES256 sign, key in secret]
    W1 -- COSE_Sign1 --> B
    B -- "sha256 + phash + manifest" --> D[(D1 registry + R2)]
  end
  subgraph Paid API flow — Workers Paid $5/mo
    C[Customer server] -- "POST image + API key" --> W2[Worker: c2pa-ts sign<br/>photon decode, pHash v1 + PDQ]
    W2 --> D
    W2 -- signed image --> C
  end
  D -- "threshold cron (03 §3.4), Merkle root" --> A[Base: OzDnaAnchor.anchor<br/>03 §3.5]
```

---

## 16. Fixed monthly cost — proving the budget holds

| Item | Pre-revenue (Jul–Nov 2026) | At launch w/ paying customers (Dec 2026+) |
|---|---|---|
| Cloudflare (Workers, D1, R2, KV, Analytics, Turnstile, DNS) | $0 free tier Jul–Sep; **$5 Workers Paid from the October build (W3) onward** — 06-COST-MODEL §2's call | $5 (Workers Paid — unlocks 30s CPU for API signing + 10 MB bundle) |
| ozdna.com renewal (~$12/yr, already owned) | ~$1 | ~$1 |
| Base gas (batched anchor, 15-min threshold cron) | $0 Jul–Sep (Sepolia staging only); **~$0.50/mo from October MVP** — mainnet anchoring from day one of public signing (§7; testnet-only anchors would overclaim, hard rule 5) | ~$0.50 |
| Resend / Sentry / GitHub / Search Console | $0 | $0 |
| Paddle | $0 fixed (5% + $0.50 per transaction, netted from revenue) | $0 fixed |
| One-time, non-monthly: gas wallet funding ~$10–20; Foundry/tooling $0 | — | — |
| **Total fixed** | **~$1/mo (Jul–Sep) → ~$6.50/mo (Oct–Nov: Workers Paid + mainnet anchoring live)** | **~$6.50/mo** |

Contingency (only if a decision-rule fallback triggers): Vercel Pro $20/mo (pre-approved ceiling) — and it would *replace* nothing, so worst case ≈ $26.50/mo, of which $20 is the pre-approved item and $5 is revenue-funded by definition. The plan therefore holds the $0–20 budget in every non-contingency state. Upgrade triggers, restated: **Workers Paid from build W3 / launch day (06-COST-MODEL §2, adopted by 01 §3.2 and 04 §8); Resend Pro if >100 emails/day sustained; Sentry paid never (sample instead); Stripe-direct re-evaluation at ~$5k MRR.**

---

## 17. UNVERIFIED claims (re-check before relying on them)

1. UNVERIFIED: Paddle's payout method/currency/minimums to a **UAE bank account** (Payoneer vs wire; AED/USD). Confirm during vendor approval in September.
2. UNVERIFIED: Paddle approval outcome for our specific site/copy (discretionary review; blockchain-as-plumbing copy should be fine, but it's their call).
3. UNVERIFIED: Postmark's current free/developer tier (~100 emails/mo) — from third-party comparisons, not postmarkapp.com directly. (Backup provider only.)
4. UNVERIFIED: `@contentauth/c2pa-wasm` 0.9.0 running inside the workerd runtime (we do not depend on this; it's a listed experiment only).
5. UNVERIFIED: Coinbase Developer Platform Base-Sepolia faucet current daily allowance.
6. UNVERIFIED: Cloudflare Turnstile free-tier widget-count limit (we need 1–2 widgets; irrelevant at our scale).
7. UNVERIFIED: Lucia's exact deprecation date (its deprecated status is widely documented; date not re-verified).
8. UNVERIFIED: exact CPU-ms cost of c2pa-ts manifest creation on multi-MB JPEGs in workerd (the $5 Workers Paid plan's 30 s budget makes the point moot, but measure in build week 1 anyway). The same measurement pass must cover the browser-flow COSE_Sign1 assembly endpoint (§1) and the anchor-cron Merkle build + tx signing (§7) — both run on the free tier's 10 ms budget.
9. UNVERIFIED: the exact payload contract of c2pa-web's remote `Signer.sign` callback (COSE to-be-signed bytes vs. fuller structure), and whether an RFC 3161 TSA countersignature can be attached on our signing paths (c2pa-ts / Worker COSE assembly). Both resolved by the September signing-credential spike (§2).
10. UNVERIFIED: ozdna.com reclaim date — assumed **by September 1, 2026** in §4; founder to confirm (§18.3). A late reclaim pushes the Paddle application onto a workers.dev/staging URL.

## 18. Open questions only the founder can answer

1. **Paddle account:** apply under Find Below Ventures FZE with the UAE trade license — do you have the license PDF + a UAE or international bank account Paddle can pay out to? (Needed for §8; apply in September.)
2. **Gas wallet funding path:** which exchange/account will you use to withdraw ~$15 of ETH directly to Base mainnet? (One-time, 15 minutes, must be your personal action — hard rule 2 keeps this wallet strictly ours.)
3. **Domain timing:** when exactly is ozdna.com reclaimed and its DNS moved to Cloudflare (nameserver change)? This doc assumes **by September 1** (§4) — earlier notes contradicted each other (mid-July vs. October) and no authoritative date exists, so only you can set it. Email deliverability (SPF/DKIM), Workers routes, and the September Paddle application (which reviews the live site) all hang on this date; a late reclaim means applying to Paddle from a workers.dev/staging URL, which weakens the submission.
4. **Sentry + Resend + GitHub org accounts:** create under which email — findbelow.com or a new ozdna.com mailbox? (Recommend ops@ozdna.com once DNS moves.)
