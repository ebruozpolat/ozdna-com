# AMLR rule pack — implementation and legal-ambiguity report

**Pack:** `app/rules/packs/eu_amlr_2024_1624` (v1) · **Engine:** `app/rules/` · **Date:** 2026-10-08
**Engineering verdict: PARTIAL** — fail-closed engine, provenance model, pack and boundary tests
are in place; **every legal value is BLOCKED** because the primary text could not be acquired.

> Claim restriction: tests prove conformity to *encoded* requirements on *synthetic* rules within
> tested scope. They do not establish that complyDNA or any customer is AMLR-compliant, legally
> certified or production-ready. Not legal advice.

## 1. Blocker: primary law not acquired

| Attempt | Result |
|---|---|
| `https://eur-lex.europa.eu/eli/reg/2024/1624/oj` (curl) | HTTP 202, empty body, `x-amzn-waf-action: challenge` |
| Same via headless Chromium | challenge script host `*.token.awswaf.com` denied by the environment's egress policy |
| `https://publications.europa.eu/resource/celex/32024R1624` (Cellar) | egress policy denied CONNECT (403) |
| WebFetch | DNS failure for eur-lex.europa.eu |

Consequences (stop conditions applied):
- No article numbers, application dates, scope, exceptions, amendments or corrigenda are
  encoded. `provision.article` is `null`, `applies_from` is `null`, sources are `NOT_ACQUIRED`
  with no hash and no retrieval time.
- Candidate values from the brief (25 %, 28/14 days, 1/5 years, EUR 1,000 / 10,000 /
  250,000 / 7,500,000, 2028, 10 July 2029) are stored as `origin: "candidate"`,
  `verified: false` parameters. None is presented as law.
- AMLA cohort/start-date rules need the AMLA Regulation and selection instruments (separate
  sources, not acquired). Legacy AMLD baseline needs Directive (EU) 2015/849 (not acquired).
- National cash overlays: none available; evaluations return `NOT_DETERMINED`
  (`jurisdiction_status: UNRESOLVED`) below the EU ceiling.

**Smallest safe next step:** allow `publications.europa.eu` (Cellar, no bot challenge) — or
`eur-lex.europa.eu` plus its WAF token host — in the environment's network settings, or upload
the official EUR-Lex text. Then: hash the bytes, record `retrieved_at`, and verify each rule's
provision, operator, date, scope and exceptions one by one (each flip to `verified: true` is a
reviewed change; the loader refuses verified claims on an unverified source).

## 2. Architecture decisions

- **Location:** `complydna/app/rules/` (Python, pydantic v2, `StrEnum`) so the existing
  `ComplyDNA Eval` workflow (`pytest -m "not integration"` + `evals/run.py`) gates it. No rule
  engine existed before, so there is no competing source of truth. The RAG `Article` model is
  untouched (changing it would alter chunk ids, the Qdrant payload and golden fixtures); the
  rule `Provision` is a separate, citation-shaped pointer.
- **Outcomes:** `PASS, FAIL, NOT_APPLICABLE, NOT_DETERMINED, INSUFFICIENT_EVIDENCE,
  HUMAN_REVIEW_REQUIRED`. Each rule's `condition` says what PASS asserts. Missing data is never
  PASS.
- **Gate (`gate.py`):** temporal window first (`applies_from` null → `NOT_DETERMINED`; before it →
  `NOT_DETERMINED`, or `NOT_APPLICABLE` only for rules flagged as deferred new obligations; after
  `applies_until` → `NOT_APPLICABLE`). Then any PASS/FAIL/NOT_APPLICABLE from an unverified rule
  becomes `HUMAN_REVIEW_REQUIRED`, with the encoded logic's answer kept in
  `provisional_outcome` and every unverified item listed in `reasons`.
- **Provenance:** `LegalSource` refuses a hash/timestamp on a `NOT_ACQUIRED` source and requires
  a lowercase SHA-256 and a timezone-aware `retrieved_at` on an acquired one. Every
  `RuleResult` carries citation, source URL and source hash.
- **Synthetic rules for tests:** `tests/rules_support.py` copies a pack rule onto a
  `SYNTHETIC_TEST` source with all items verified, to exercise PASS/FAIL paths. The pack loader
  rejects synthetic sources, so test rules cannot leak into a pack.
- **Numbers and dates:** `Decimal` from strings/ints only (floats raise `TypeError`), 80-digit
  context, no rounding before comparison. `as_of` is always an input; no clock reads. Datetimes
  must be timezone-aware and are read in the rule's `reference_timezone`.
- **Data format:** JSON (no new dependency). Only change outside `app/rules`, tests and docs:
  the `opentelemetry-util-genai` pin from PR #76, carried so CI can install.

## 3. Legal mapping (all BLOCKED)

| Rule | Requirement | Provision | Date | Scope / exceptions | Source hash |
|---|---|---|---|---|---|
| `eu_amlr_bo_ownership_or_control` | REQ-BO-OWN/CTRL/INDIRECT/TEMPORAL | VERIFY | VERIFY | VERIFY | none (not acquired) |
| `eu_amld_bo_ownership_legacy` | REQ-BO-LEGACY | VERIFY (Dir. 2015/849) | VERIFY | VERIFY | none |
| `eu_amlr_bo_register_update_deadline` | REQ-BO-UPDATE | VERIFY | VERIFY | VERIFY | none |
| `eu_amlr_bo_discrepancy_report_deadline` | REQ-BO-DISCREPANCY | VERIFY | VERIFY | VERIFY | none |
| `eu_amlr_cdd_review_interval` | REQ-CDD-REFRESH | VERIFY | VERIFY | VERIFY | none |
| `eu_amlr_crypto_occasional_cdd` | REQ-CRYPTO-CDD | VERIFY | VERIFY | VERIFY | none |
| `eu_amlr_cash_payment_limit` | REQ-CASH | VERIFY | VERIFY | VERIFY | none |
| `eu_amlr_high_value_reporting` | REQ-HIGH-VALUE | VERIFY (brief: Art. 74) | VERIFY | VERIFY | none |
| `eu_amla_direct_supervision` | REQ-AMLA | VERIFY (AMLA Reg.) | VERIFY | VERIFY | none |
| `eu_amlr_football_scope` | REQ-FOOTBALL | VERIFY | VERIFY (brief: 2029-07-10) | VERIFY | none |

Machine-readable: `pack.json` (rules + sources) and `traceability.json`
(requirement → rule → tests → evidence; status `ENGINE_TESTED_LEGAL_BLOCKED`).

## 4. Interpretation choices that need a legal decision

Encoded as explicit, unverified parameters or fail-closed outcomes, never silent defaults:

1. **Ownership operator** at exactly 25 % (`GTE` candidate vs legacy `GT`).
2. **Indirect ownership method:** only `MULTIPLY_SUM` (multiply along each chain, add chains) is
   implemented; any other method → `NOT_DETERMINED`.
3. **Cyclic holdings:** simple chains give a lower bound; below threshold → `HUMAN_REVIEW_REQUIRED`.
   Cycle detection is conservative (any cycle reachable from the person).
4. **Unknown links/control:** unknown percent never counts as 0 when it could matter;
   missing control evidence is `UNKNOWN`, not `ABSENT`; control has no percentage floor.
5. **Day counting:** `DAY_AFTER_TRIGGER` (day 1 = day after trigger; deadline = trigger + N,
   inclusive). Business-day or end-of-day rules not encoded. Pending period → `NOT_DETERMINED`.
6. **Review interval:** due on the anniversary, inclusive; 29 Feb anniversaries need an explicit
   `leap_day_rule` (`FEB_28`/`MAR_1`) — null in the pack → `NOT_DETERMINED`.
7. **Event-driven CDD updates:** surfaced as `HUMAN_REVIEW_REQUIRED`; timing not encoded.
8. **Crypto threshold operator** at exactly EUR 1,000, covered transaction types (placeholder
   `CRYPTO_ASSET_TRANSFER`), and below-threshold duties (separate rules, not encoded).
9. **Cash ceiling operator** at exactly EUR 10,000 (`prohibited_comparison: GTE` candidate),
   actor scope (`professional_context`), exceptions; national overlays apply only when verified.
10. **High-value reporting:** only motor vehicles, watercraft, aircraft; other high-value goods
    → `NOT_APPLICABLE` (no inference). Reporting actor and "non-commercial" test to verify.
11. **AMLA:** selection-dependent; unselected → national supervision retained; unknown selection →
    `INSUFFICIENT_EVIDENCE`.
12. **Pre-application periods:** BO test before its date → `NOT_DETERMINED` (earlier regime
    governed); football before its deferred date → `NOT_APPLICABLE` (flagged per rule).
13. **Linked transactions:** linkage is supplied by the caller, not inferred.

## 5. Test evidence

```
cd complydna
pytest -q tests/test_rules_*.py          # 117 passed
pytest -m "not integration" -q           # 174 passed, 1 deselected (57 existing + 117 new)
python evals/run.py                      # exit 0 (citation_precision 0.700, recall 0.700, hit@5 0.900)
ruff check app/rules tests/test_rules_*.py tests/rules_support.py   # clean
```

Boundary coverage: 24.99/25.00/25.01 (+ legacy >25), zero/10 % ownership with control, unknown
control, single/multi-chain exact 25, missing links, cycles; D27/28/29 and D13/14/15, missing
trigger, naive/aware datetimes; 1/5-year anniversaries, leap day (both rules + undetermined),
material change, unknown risk, missing last review; EUR 999.99/1,000/1,000.01, linked
transactions, missing FX evidence; EUR 9,999.99/10,000/10,000.01, stricter verified overlay,
missing/unverified overlay; category thresholds and exclusions; AMLA selected/unselected/unknown;
football 2028 / day before / 2029-07-10; after-application period; provenance and loader
refusals; claims-language scan; traceability completeness.

Pre-existing, unrelated: `ruff check .` reports 5 issues in files this work does not touch
(`llm_openai.py`, `evals/cli.py`, `evals/metrics.py`, `scripts/pilot_demo.py`,
`tests/test_llm_openai.py`); CI does not run ruff.

## 6. Open issues for human review

- Acquire and hash the primary text (AMLR + amendments/corrigenda; AMLA Regulation; AMLD for the
  legacy baseline) and verify each item in §3–§4.
- National overlays for any jurisdiction to be served (cash limits, BO register specifics).
- Whether results should ever be exposed through the API (`/v1/rules/...`) — not done; the
  public product page frames these modules as design-partner scope.
