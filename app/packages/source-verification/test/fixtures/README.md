# Metadata provider fixtures — SYNTHETIC

**Every file here is synthetic.** The Phase 4 spike ran in a sandbox that could not reach Crossref,
DataCite or doi.org (ADR-004, "How this research was done"). The files are shaped from the field
names documented in ADR-004 and use test DOI prefixes (`10.5555` Crossref, `10.5072` DataCite), so
they can never be mistaken for real records.

| File | Scenario | Expected state |
|---|---|---|
| `crossref-normal.json` | clean record | VERIFIED (when the citation matches) |
| `crossref-corrected.json` | `updated-by` correction (publisher) | CORRECTED |
| `crossref-retracted.json` | `updated-by` retraction from both `retraction-watch` (with `record-id`) and `publisher` | RETRACTED |
| `crossref-eoc.json` | `updated-by` expression_of_concern | EXPRESSION_OF_CONCERN |
| `doira-not-found.json` | doi.org RA lookup: "DOI does not exist" | IDENTIFIER_NOT_FOUND |
| `crossref-not-indexed.txt` | Crossref 404 body after the RA confirmed the DOI | UNVERIFIED (CROSSREF_404) |
| `datacite-dataset.json` | DataCite dataset (JSON:API) | PARTIALLY_VERIFIED at best (no integrity signal) |
| `crossref-malformed.json` | right wrapper, wrong field types | UNVERIFIED (CROSSREF_MALFORMED) |
| `crossref-hostile.json` | control/bidi characters, markup, prompt-injection text, a bogus update type | sanitised; never VERIFIED |

The hostile test also generates a multi-megabyte title at runtime (it is not stored), to
exercise the response-size cap.

**To replace these with real recordings**, run on a machine with network access, outside CI:

```bash
node app/scripts/record-metadata-fixtures.mjs --mailto you@example.org --out recorded/ <doi> [<doi> ...]
```

Then point the adapter tests at the recorded files and check that the documented fields still hold.
