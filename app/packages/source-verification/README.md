# `@ozdna/source-verification` — Phase 4a/4b

Verifies a cited source against registry metadata. Evidence and rules: `../../docs/adr/ADR-004-metadata-provider-precedence.md`.

- **`identifiers.ts`**: normalises DOI, ISBN (with checksum), ISSN (with checksum), PMID, PMCID,
  arXiv and URL. It never guesses: ambiguous input returns `candidates`.
- **`engine.ts`** (pure): `evaluate(reference, normalized, lookup)` returns one of the 8 states,
  `confidence_bp` (an integer weighted mean of the compared fields) and the component scores behind it.
- **`http.ts`**: the only network path. Host allow-list `api.crossref.org`, `api.datacite.org`,
  `doi.org`; HTTPS only; no redirects; timeout; 1 MiB cap; content-type and strict UTF-8/JSON checks.
- **`adapters/`**: doi.org RA lookup, then Crossref or DataCite. A contact email is required
  (polite pool); every failure becomes `UNVERIFIED`.
- **`payload.ts`**: maps a result onto the registry payload `source.verification_recorded@1`.

**Tests never touch the network.** `test/no-network.ts` blocks `globalThis.fetch` and fails any test
that tries it. Fixtures are synthetic (see `test/fixtures/README.md`); record real ones with
`app/scripts/record-metadata-fixtures.mjs`, outside CI.
