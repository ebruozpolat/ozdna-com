# ADR-004 — Metadata providers: precedence, signals, and what we could not confirm

**Status:** proposed. **Date:** 2026-10-07. **Implements:** IMPLEMENTATION_PLAN.md Phase 4a/4b
(`app/packages/source-verification`).

## How this research was done (read first)

The spike ran in a sandbox whose egress proxy **blocked every provider host**: `www.crossref.org`,
`api.crossref.org`, `doi.org`/`www.doi.org`, `api.datacite.org`, `support.datacite.org`,
`datacite-metadata-schema.readthedocs.io` and `crossref.gitlab.io` all returned
`connect_rejected`. Consequences:

- Facts below come from **web-search excerpts of the official pages** (cited by URL). Where the
  only evidence is a third-party source, it is marked as such and treated as **unconfirmed**.
- **No live responses were recorded.** The test fixtures are **synthetic**, shaped from the
  documented field names, and use test DOI prefixes (`10.5555` Crossref, `10.5072` DataCite).
  `app/scripts/record-metadata-fixtures.mjs` records real responses from a machine with network
  access. **Before Phase 4c ships, someone must record real fixtures and re-run the adapter
  tests against them.**

Legend: **✔ confirmed** (official source); **~ partly confirmed** (official source names the
field, but its inner shape comes from third parties); **✘ not confirmed**.

## 1. How corrections and retractions appear

### Crossref

| Fact | Status | Source |
|---|---|---|
| Update notices (e.g. a retraction notice) carry an **`update-to`** array naming the DOIs they update | ✔ | [Crossref: Retraction Watch](https://www.crossref.org/documentation/retrieve-metadata/retraction-watch/); [blog: RW retractions now in the API](https://www.crossref.org/blog/retraction-watch-retractions-now-in-the-crossref-api/) |
| The **updated (e.g. retracted) work** carries an **`updated-by`** array ("see the updated-by field to know if a particular record has been retracted and when") | ✔ | [Crossref Labs: Retraction Watch data](https://www.crossref.org/labs/retraction-watch/) |
| Each update entry has a **`source`** of `publisher` or `retraction-watch` | ✔ | [Crossref: Retraction Watch](https://www.crossref.org/documentation/retrieve-metadata/retraction-watch/) |
| Retraction Watch entries carry a **Record ID** ("an internal identifier from Retraction Watch") | ✔ (named) | same |
| Inner keys of an `updated-by` entry: `DOI`, `type`, `label`, `source`, `updated` (`date-parts`), optional `record-id` | ~ | the official pages name `update-to`/`updated-by`/`source`; the full key list is from a third-party fixture write-up ([Lekta PR #292](https://github.com/danielrisavi77-create/Lekta/pull/292)) |
| The same update can appear **twice**, once per source | ~ | [blog](https://www.crossref.org/blog/retraction-watch-retractions-now-in-the-crossref-api/), third-party fixtures |
| Crossmark update `type` vocabulary: `addendum, clarification, correction, corrigendum, erratum, expression_of_concern, new_edition, new_version, partial_retraction, removal, retraction, withdrawal` | ~ | [Crossref Crossmark webinar (2017)](https://www.crossref.org/pdfs/crossmark-update-webinar-feb23-2017.pdf); current schema not checked |
| Retraction Watch's own "nature" values differ from Crossref's update types | ✔ | [Crossref: Retraction Watch](https://www.crossref.org/documentation/retrieve-metadata/retraction-watch/) |
| Work record wrapper `{status, "message-type": "work", message}`; bibliographic fields `message.title[]`, `message.author[].family`, `message.issued["date-parts"]`, `message["container-title"][]` | ~ | third-party clients only ([libraries.io crossrefapi](https://libraries.io/pypi/crossrefapi), [scholkit schema](https://beta.pkg.go.dev/github.com/miku/scholkit/schema/crossref)). **Fail-closed property:** if a field name is wrong, the field is simply *not compared*; `VERIFIED` requires a strong title match, so a wrong field name can only lower the result, never produce a false `VERIFIED` |
| A missing `updated-by` does **not** prove a work was never retracted (coverage depends on deposits) | ✔ (by design) | [Registering updates](https://www.crossref.org/documentation/register-maintain-records/maintaining-your-metadata/registering-updates/) |
| A Crossref 404 does not prove a DOI doesn't exist (alias DOIs are hidden; other registration agencies' DOIs are not indexed; indexing lag) | ✔ (staff answers) | [forum 3443](https://community.crossref.org/t/api-returns-no-works-for-a-doi-that-does-resolve/3443), [forum 4111](https://community.crossref.org/t/known-working-doi-gives-resource-not-found-in-crossref-api/4111) |

### DataCite

| Fact | Status | Source |
|---|---|---|
| `GET https://api.datacite.org/dois/{id}` returns a JSON:API document (`data.type = "dois"`, `data.attributes`) | ✔ | [Retrieve a single DOI](https://support.datacite.org/docs/api-get-doi) |
| `attributes` holds `titles[].title`, `creators[]` (`name`, …), `state`, `relatedIdentifiers` | ✔ | same; [Consuming citations](https://support.datacite.org/docs/consuming-citations-and-references) |
| `publicationYear` and `types.resourceTypeGeneral` in **GET** responses | ~ | shown in create/update examples ([Create DOIs](https://support.datacite.org/docs/api-create-dois)), not in a GET example |
| A **retraction/correction relation type** (e.g. `IsRetractedBy`) | **✘** | no evidence in schema 4.6; 4.6 added only `IsTranslationOf`/`HasTranslation` ([4.6 announcement](https://datacite.org/blog/announcing-datacite-metadata-schema-4-6/), [relationType list](https://datacite-metadata-schema.readthedocs.io/en/4.6/appendices/appendix-1/relationType/)) |
| 404 body for an unknown DOI | **✘** | not documented in the results found |

## 2. Retraction Watch data: exposure and terms

- **Exposure ✔:** RW retractions and corrections are in the Crossref REST API (`source: "retraction-watch"`),
  in Crossref Labs, and as a CSV dataset updated each working day at
  `gitlab.com/crossref/retraction-watch-data`
  ([Crossref: Retraction Watch](https://www.crossref.org/documentation/retrieve-metadata/retraction-watch/)).
- **Terms ✘ (conflicting):** some sources call the data CC0 (an [Illinois paper](https://www.ideals.illinois.edu/items/132089)
  citing the September 2023 release; [C&EN](https://cen.acs.org/research-integrity/Crossref-acquires-Retraction-Watch-Database/101/web/2023/09):
  "available for free, without any need for license"), while a 2026 [Zenodo record](https://zenodo.org/records/20023531)
  calls it a CC-BY 4.0 redistribution. **The licence file in the GitLab repository was not reachable.**
  - **Decision until confirmed:** we use RW-sourced entries only as a *signal* inside a
    verification result. We store the hash of the provider response, not RW data itself, we
    do not redistribute RW records, and every verification event records which source
    (`publisher` / `retraction-watch`) produced it. **Founder action:** read the licence in the
    GitLab repo before any export or display of RW data.

## 3. Rate limits and identification

| Provider | Limits | Identification | Status |
|---|---|---|---|
| Crossref (from 1 Dec 2025) | public pool: single records 5 req/s, concurrency 1; lists 1 req/s, concurrency 1. **polite pool:** single DOI 10 req/s, concurrency 3; lists 3 req/s, concurrency 3 | `mailto=` parameter with a real address ("polite pool"); a paid *Metadata Plus* tier exists | ✔ [rate-limit announcement](https://www.crossref.org/blog/announcing-changes-to-rest-api-rate-limits/), [access & authentication](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/); whether still in force today ✘ |
| DataCite | authenticated 3000 / 5 min / IP; **email-identified** (User-Agent or `mailto=`) 1000 / 5 min; anonymous 500 / 5 min | `mailto=` or an email address in the User-Agent | ✔ planned for Q3 2025 ([rate limit](https://support.datacite.org/docs/rate-limit)); in force today ✘ |
| doi.org RA lookup | not documented | — | ✘ |

**Decision:** adapters **refuse to run without a contact email** (it goes in both `mailto=` and
the User-Agent). One request per citation, no retries inside the adapter. A 429 or 5xx yields
`UNVERIFIED`; the caller (Phase 4c queue) owns pacing and backoff. We do not hard-code limits.

## 4. Finding a DOI's registration agency

- **✔** `https://doi.org/doiRA/<doi>` returns JSON: a list of `{ "DOI": …, "RA": … }`
  ([DOI Handbook: Which RA?](https://www.doi.org/doi-handbook/HTML/which-ra_-service.html)).
  Documented error states: "Invalid DOI", "DOI does not exist", "Unknown"
  ([DOI resolution documentation](https://www.doi.org/the-identifier/resources/factsheets/doi-resolution-documentation/)).
- **~** The JSON *key* carrying an error state (`"status"`) is shown only by a
  [third-party project](https://github.com/tuub/oagreenservice/blob/master/1-1_doiRA_crossref.md).
- **~** Alternative: `https://api.crossref.org/works/{doi}/agency` (from a Crossref staff forum
  answer). Not used.

**Decision:** resolve the RA with `doiRA` first.

| doiRA result | Outcome |
|---|---|
| RA `Crossref` | Crossref adapter |
| RA `DataCite` | DataCite adapter |
| any other RA (mEDRA, JaLC, …) | `UNVERIFIED` (no adapter) |
| a status of exactly "DOI does not exist" | `IDENTIFIER_NOT_FOUND` |
| anything else ("Invalid DOI", "Unknown", an unknown shape, HTTP error) | `UNVERIFIED` |

This is the **only** path to `IDENTIFIER_NOT_FOUND`. A provider 404 *after* the RA confirmed the
DOI is treated as `UNVERIFIED` (alias, indexing lag), never as "not found".

## 5. Precedence and fail-closed rules (summary)

1. Normalisation never guesses. Ambiguous input (trailing punctuation, several DOIs) produces
   **candidates** and the state `UNVERIFIED`.
2. Integrity outranks match quality, but only from **Crossref** `updated-by`:
   - **RETRACTED:** `retraction`, `partial_retraction`, `withdrawal`, `removal`
   - **EXPRESSION_OF_CONCERN:** `expression_of_concern`
   - **CORRECTED:** `correction`, `corrigendum`, `erratum`
   - **ignored** (do not change the state): `addendum`, `clarification`, `new_version`, `new_edition`
   - **an unrecognised type, or a malformed entry → `UNVERIFIED`**

   Either source (`publisher`, `retraction-watch`) counts, and both are recorded as separate
   components.
3. **DataCite has no confirmed integrity signal**, so a DataCite match is at most
   `PARTIALLY_VERIFIED` (component `integrity_signal = 0`), never `VERIFIED`.
4. A missing `updated-by` on Crossref is read as "no update recorded by Crossref as of the fetch",
   which is the documented limitation. `VERIFIED` means exactly that, not "never retracted".
5. All provider text is untrusted. It is length-capped, stripped of control and bidi characters,
   compared as tokens only, and never interpreted.

## 6. Open items for the founder

- Confirm the Retraction Watch data licence (GitLab repository licence file).
- Record real fixtures with `scripts/record-metadata-fixtures.mjs` from a machine with network access, then re-run the tests.
- Decide the contact email to use for `mailto` (it must be a monitored address).
- Registry gap: `source.verification_recorded@1` has `provider ∈ {crossref, datacite, manual}`.
  Results from unsupported RAs or failed RA lookups have no provider value and cannot be recorded
  as events yet; a `@2` with `provider: "doi_ra" | "none"` is proposed for Phase 4c.
