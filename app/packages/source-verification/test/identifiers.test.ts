import "./no-network.js";
import { describe, expect, it } from "vitest";
import { normalizeDoi, normalizeIdentifier } from "../src/identifiers.js";

describe("normalizeDoi", () => {
  it.each([
    ["10.1038/nature12373", "10.1038/nature12373"],
    ["doi:10.1038/NATURE12373", "10.1038/nature12373"],
    ["DOI: 10.1038/nature12373", "10.1038/nature12373"],
    ["https://doi.org/10.1038/nature12373", "10.1038/nature12373"],
    ["http://dx.doi.org/10.1038/nature12373", "10.1038/nature12373"],
    ["https://www.doi.org/10.1038/nature12373", "10.1038/nature12373"],
    ["  10.1038/nature12373  ", "10.1038/nature12373"],
    ["https://doi.org/10.1002%2F%28SICI%291097", "10.1002/(sici)1097"],
    ["10.1016/0004-3702(89)90001-2", "10.1016/0004-3702(89)90001-2"],
  ])("normalises %s", (raw, want) => {
    expect(normalizeDoi(raw)).toEqual({ status: "ok", scheme: "doi", value: want });
  });

  it("never auto-corrects trailing punctuation: returns both candidates", () => {
    for (const raw of ["10.1038/nature12373.", "10.1038/nature12373,", "10.1038/nature12373;"]) {
      const r = normalizeDoi(raw);
      expect(r.status, raw).toBe("ambiguous");
      expect(r.status === "ambiguous" && r.candidates).toEqual([
        raw.toLowerCase(),
        "10.1038/nature12373",
      ]);
    }
  });

  it("treats an unbalanced closing bracket as ambiguous, a balanced one as part of the DOI", () => {
    expect(normalizeDoi("10.1000/abc)")).toMatchObject({
      status: "ambiguous",
      candidates: ["10.1000/abc)", "10.1000/abc"],
    });
    expect(normalizeDoi("10.1000/a(b)")).toMatchObject({ status: "ok", value: "10.1000/a(b)" });
    expect(normalizeDoi("10.1000/abc]")).toMatchObject({ status: "ambiguous" });
  });

  it("returns candidates when a string holds more than one DOI", () => {
    expect(normalizeDoi("see 10.1000/aaa and 10.1000/bbb")).toEqual({
      status: "ambiguous",
      scheme: "doi",
      candidates: ["10.1000/aaa", "10.1000/bbb"],
    });
  });

  it.each([
    ["", "empty"],
    ["11.1038/x", "not a DOI"],
    ["10.12/x", "not a DOI"],
    ["10.1038/has space", "not a DOI"],
    ["10.1038/x\u0007", "control characters"],
    ["10.1038/x\u202e", "control characters"],
    ["https://doi.org/10.1038/%E0%A4%A", "bad percent-encoding"],
    ["10.5555/x/../../evil", "dot segment"],
    ["10.5555/./x", "dot segment"],
    [`10.1038/${"a".repeat(3000)}`, "too long"],
  ])("rejects %j (%s)", (raw, reason) => {
    expect(normalizeDoi(raw)).toMatchObject({ status: "invalid", reason });
  });

  it("rejects percent-encoded control characters", () => {
    expect(normalizeDoi("https://doi.org/10.1038/x%00y")).toMatchObject({ status: "invalid" });
  });
});

describe("normalizeIdentifier — other schemes", () => {
  it.each([
    ["isbn", "978-0-306-40615-7", "9780306406157"],
    ["isbn", "0-306-40615-2", "0306406152"],
    ["isbn", "0-8044-2957-x", "080442957X"],
    ["issn", "0317-8471", "0317-8471"],
    ["issn", "2434561X", "2434-561X"],
    ["pmid", "00012345", "12345"],
    ["pmcid", "pmc1234567", "PMC1234567"],
    ["pmcid", "1234567", "PMC1234567"],
    ["arxiv", "arXiv:2310.06825v2", "2310.06825v2"],
    ["arxiv", "hep-th/9901001", "hep-th/9901001"],
    ["url", "https://example.org/paper?id=1", "https://example.org/paper?id=1"],
  ] as const)("%s %s → %s", (scheme, raw, want) => {
    expect(normalizeIdentifier(scheme, raw)).toEqual({ status: "ok", scheme, value: want });
  });

  it.each([
    ["isbn", "978-0-306-40615-8"],
    ["issn", "0317-8472"],
    ["pmid", "123456789"],
    ["arxiv", "2310.682"],
    ["url", "javascript:alert(1)"],
    ["url", "https://user:pw@example.org/"],
    ["other", "anything"],
  ] as const)("rejects %s %s", (scheme, raw) => {
    expect(normalizeIdentifier(scheme, raw).status).toBe("invalid");
  });
});
