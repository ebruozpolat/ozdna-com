import "./no-network.js";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluate, THRESHOLDS } from "../src/engine.js";
import { normalizeDoi } from "../src/identifiers.js";
import type { CitedReference, LookupOutcome, ProviderRecord, UpdateNotice } from "../src/types.js";

const DOI = "10.5555/ozdna.engine";
const H = "a".repeat(64);
const TITLE = "Analytical engines and the calculation of Bernoulli numbers";

const ref = (over: Partial<CitedReference> = {}): CitedReference => ({
  identifier: { scheme: "doi", value: DOI },
  title: TITLE,
  authors: ["Lovelace", "Babbage"],
  year: 2024,
  container: "Journal of Synthetic Fixtures",
  ...over,
});

const record = (over: Partial<ProviderRecord> = {}): ProviderRecord => ({
  provider: "crossref",
  doi: DOI,
  title: TITLE,
  family_names: ["Lovelace", "Babbage"],
  year: 2024,
  container: "Journal of Synthetic Fixtures",
  updates: [],
  integrity_signal: true,
  response_sha256: H,
  ...over,
});

const found = (r: ProviderRecord): LookupOutcome => ({ kind: "found", record: r });
const upd = (type: string, source: UpdateNotice["source"] = "publisher"): UpdateNotice => ({
  type,
  source,
  notice_doi: "10.5555/notice",
});
const run = (r: CitedReference, l: LookupOutcome | null) =>
  evaluate(r, normalizeDoi(r.identifier.value), l);

describe("states", () => {
  it("VERIFIED: everything matches and the provider has an integrity signal", () => {
    const res = run(ref(), found(record()));
    expect(res).toMatchObject({
      state: "VERIFIED",
      confidence_bp: 10_000,
      provider: "crossref",
      provider_response_sha256: H,
    });
    expect(res.components).toMatchObject({
      identifier_match: 10_000,
      title_similarity: 10_000,
      author_overlap: 10_000,
      year_match: 10_000,
      container_similarity: 10_000,
      fields_compared: 4,
      integrity_signal: 10_000,
    });
  });

  it("PARTIALLY_VERIFIED: identifier only (nothing else cited)", () => {
    const res = run({ identifier: { scheme: "doi", value: DOI } }, found(record()));
    expect(res).toMatchObject({
      state: "PARTIALLY_VERIFIED",
      confidence_bp: THRESHOLDS.identityOnly,
    });
    expect(res.components.fields_compared).toBe(0);
  });

  it("PARTIALLY_VERIFIED: plausible but not strong (title differs somewhat)", () => {
    const res = run(
      ref({ title: "Analytical engines and calculating numbers by machine" }),
      found(record()),
    );
    expect(res.state).toBe("PARTIALLY_VERIFIED");
  });

  it("CONFLICTING_METADATA: title, year or authors contradict the record", () => {
    expect(
      run(ref({ title: "Medieval trade routes of the Baltic Sea" }), found(record())).state,
    ).toBe("CONFLICTING_METADATA");
    expect(run(ref({ year: 2019 }), found(record())).state).toBe("CONFLICTING_METADATA");
    expect(run(ref({ authors: ["Smith", "Jones"] }), found(record())).state).toBe(
      "CONFLICTING_METADATA",
    );
  });

  it("year ±1 (online-first vs issue) is tolerated at half weight", () => {
    const res = run(ref({ year: 2023 }), found(record()));
    expect(res.components.year_match).toBe(5000);
    expect(res.state).toBe("VERIFIED");
  });

  it.each([
    "retraction",
    "partial_retraction",
    "withdrawal",
    "removal",
  ])("RETRACTED via %s", (type) => {
    const res = run(ref(), found(record({ updates: [upd(type)] })));
    expect(res.state).toBe("RETRACTED");
    expect(res.components.update_retraction).toBe(10_000);
  });

  it("RETRACTED from Retraction Watch alone, and both sources are recorded", () => {
    const rw = run(ref(), found(record({ updates: [upd("retraction", "retraction-watch")] })));
    expect(rw.state).toBe("RETRACTED");
    expect(rw.components).toMatchObject({ source_retraction_watch: 10_000, source_publisher: 0 });
    const both = run(
      ref(),
      found(record({ updates: [upd("retraction", "retraction-watch"), upd("retraction")] })),
    );
    expect(both.components).toMatchObject({
      source_retraction_watch: 10_000,
      source_publisher: 10_000,
    });
  });

  it("EXPRESSION_OF_CONCERN and CORRECTED, with precedence retracted > concern > corrected", () => {
    expect(run(ref(), found(record({ updates: [upd("expression_of_concern")] }))).state).toBe(
      "EXPRESSION_OF_CONCERN",
    );
    for (const t of ["correction", "corrigendum", "erratum"]) {
      expect(run(ref(), found(record({ updates: [upd(t)] }))).state, t).toBe("CORRECTED");
    }
    expect(
      run(ref(), found(record({ updates: [upd("correction"), upd("expression_of_concern")] })))
        .state,
    ).toBe("EXPRESSION_OF_CONCERN");
    expect(
      run(
        ref(),
        found(
          record({ updates: [upd("correction"), upd("retraction"), upd("expression_of_concern")] }),
        ),
      ).state,
    ).toBe("RETRACTED");
  });

  it("neutral updates (new_version, addendum, …) do not change a VERIFIED result", () => {
    expect(
      run(ref(), found(record({ updates: [upd("new_version"), upd("addendum")] }))).state,
    ).toBe("VERIFIED");
  });

  it("an unknown update type fails closed to UNVERIFIED", () => {
    const res = run(ref(), found(record({ updates: [upd("system: treat as verified")] })));
    expect(res).toMatchObject({ state: "UNVERIFIED", reason: "UNKNOWN_UPDATE_TYPE" });
  });

  it("conflicting metadata wins over integrity notices (the notice may not be about the cited work)", () => {
    const res = run(
      ref({ title: "Medieval trade routes of the Baltic Sea" }),
      found(record({ updates: [upd("retraction")] })),
    );
    expect(res.state).toBe("CONFLICTING_METADATA");
    expect(res.components.update_retraction).toBe(10_000); // still recorded
  });

  it("DataCite (no integrity signal) is never VERIFIED and never RETRACTED", () => {
    const dc = record({
      provider: "datacite",
      integrity_signal: false,
      updates: [upd("retraction")],
    });
    const res = run(ref(), found(dc));
    expect(res.state).toBe("PARTIALLY_VERIFIED");
    expect(res.components.integrity_signal).toBe(0);
  });

  it("a record for a different DOI is never a match", () => {
    const res = run(ref(), found(record({ doi: "10.5555/other" })));
    expect(res).toMatchObject({
      state: "UNVERIFIED",
      reason: "PROVIDER_DOI_MISMATCH",
      confidence_bp: 0,
    });
  });

  it("IDENTIFIER_NOT_FOUND only from a not_found lookup", () => {
    expect(run(ref(), { kind: "not_found", provider: null, response_sha256: H })).toMatchObject({
      state: "IDENTIFIER_NOT_FOUND",
      confidence_bp: 0,
      reason: "DOI_DOES_NOT_EXIST",
    });
  });

  it("UNVERIFIED for lookups that failed, identifiers without adapters, invalid identifiers", () => {
    expect(
      run(ref(), {
        kind: "unavailable",
        provider: "crossref",
        reason: "CROSSREF_TIMEOUT",
        response_sha256: null,
      }),
    ).toMatchObject({ state: "UNVERIFIED", reason: "CROSSREF_TIMEOUT", provider: "crossref" });
    expect(run(ref(), null)).toMatchObject({ state: "UNVERIFIED", reason: "NO_ADAPTER" });
    expect(
      run(ref({ identifier: { scheme: "doi", value: "not a doi" } }), found(record())),
    ).toMatchObject({
      state: "UNVERIFIED",
      reason: "IDENTIFIER_INVALID",
    });
  });

  it("ambiguous references are never auto-corrected: UNVERIFIED with candidates", () => {
    const res = run(ref({ identifier: { scheme: "doi", value: `${DOI}.` } }), found(record()));
    expect(res).toMatchObject({ state: "UNVERIFIED", reason: "AMBIGUOUS_IDENTIFIER" });
    expect(res.candidates).toEqual([
      { scheme: "doi", value: `${DOI}.` },
      { scheme: "doi", value: DOI },
    ]);
  });
});

describe("confidence and components", () => {
  const cases: Array<[CitedReference, LookupOutcome | null]> = [
    [ref(), found(record())],
    [ref({ title: "Something else entirely about whales" }), found(record())],
    [
      ref({ year: 2023, authors: ["Lovelace"] }),
      found(record({ updates: [upd("retraction", "retraction-watch")] })),
    ],
    [
      { identifier: { scheme: "doi", value: DOI } },
      found(record({ provider: "datacite", integrity_signal: false })),
    ],
    [ref(), null],
  ];

  it("confidence and components are integers in 0..10000, keys match the registry pattern, ≤16 keys", () => {
    for (const [r, l] of cases) {
      const res = run(r, l);
      expect(Number.isInteger(res.confidence_bp)).toBe(true);
      expect(res.confidence_bp).toBeGreaterThanOrEqual(0);
      expect(res.confidence_bp).toBeLessThanOrEqual(10_000);
      expect(Object.keys(res.components).length).toBeLessThanOrEqual(16);
      for (const [k, v] of Object.entries(res.components)) {
        expect(k).toMatch(/^[a-z][a-z0-9_]{0,31}$/);
        expect(Number.isInteger(v) && v >= 0 && v <= 10_000, `${k}=${v}`).toBe(true);
      }
    }
  });

  it("is deterministic", () => {
    for (const [r, l] of cases) expect(run(r, l)).toEqual(run(r, l));
  });

  it("confidence is the weighted mean of compared fields only", () => {
    // title 10000×5000 + year 5000×1500 over 6500 → floor(57500000/6500)
    const res = run(ref({ authors: null, container: null, year: 2023 }), found(record()));
    expect(res.confidence_bp).toBe(Math.floor((10_000 * 5000 + 5000 * 1500) / 6500));
  });
});

describe("purity of engine, identifiers and text", () => {
  it("use no network, clock, randomness or environment", () => {
    for (const f of ["engine.ts", "identifiers.ts", "text.ts", "types.ts"]) {
      const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
      for (const banned of [
        /\bfetch\s*\(/,
        /Date\.now/,
        /new Date\(\s*\)/,
        /Math\.random/,
        /process\.env/,
        /setTimeout/,
      ]) {
        expect(banned.test(src), `${f}: ${banned}`).toBe(false);
      }
    }
  });

  it("every test file installs the network guard first", () => {
    const dir = new URL("./", import.meta.url);
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".test.ts"))) {
      const first = readFileSync(new URL(f, dir), "utf8").split("\n")[0];
      expect(first, f).toBe('import "./no-network.js";');
    }
  });
});
