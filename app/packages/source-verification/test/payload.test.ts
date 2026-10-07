import "./no-network.js";
import { REGISTRY_V1 } from "@ozdna/provenance-schema";
import { describe, expect, it } from "vitest";
import { evaluate } from "../src/engine.js";
import { normalizeDoi } from "../src/identifiers.js";
import { toVerificationPayload } from "../src/payload.js";
import type { LookupOutcome, ProviderRecord } from "../src/types.js";

const doi = "10.5555/ozdna.payload";
const rec: ProviderRecord = {
  provider: "crossref",
  doi,
  title: "A title of reasonable length",
  family_names: ["Lovelace"],
  year: 2024,
  container: null,
  updates: [{ type: "retraction", source: "retraction-watch", notice_doi: null }],
  integrity_signal: true,
  response_sha256: "b".repeat(64),
};

describe("toVerificationPayload", () => {
  it("produces registry-valid source.verification_recorded@1 payloads", () => {
    const outcomes: LookupOutcome[] = [
      { kind: "found", record: rec },
      { kind: "found", record: { ...rec, updates: [] } },
      {
        kind: "found",
        record: { ...rec, provider: "datacite", integrity_signal: false, updates: [] },
      },
      {
        kind: "unavailable",
        provider: "crossref",
        reason: "CROSSREF_TIMEOUT",
        response_sha256: null,
      },
    ];
    const def = REGISTRY_V1.get("source.verification_recorded", 1)!;
    for (const o of outcomes) {
      const r = evaluate(
        {
          identifier: { scheme: "doi", value: doi },
          title: "A title of reasonable length",
          authors: ["Lovelace"],
        },
        normalizeDoi(doi),
        o,
      );
      const p = toVerificationPayload(r, "cit_0000000001");
      expect(p).not.toBeNull();
      expect(def.payload.safeParse(p).success).toBe(true);
    }
  });

  it("carries candidates for ambiguous references (provider known)", () => {
    const r = evaluate(
      { identifier: { scheme: "doi", value: `${doi}.` } },
      normalizeDoi(`${doi}.`),
      null,
    );
    expect(r.candidates).toHaveLength(2);
    expect(toVerificationPayload({ ...r, provider: "crossref" }, "cit_0000000001")).toMatchObject({
      state: "UNVERIFIED",
      candidates: [
        { scheme: "doi", value: `${doi}.` },
        { scheme: "doi", value: doi },
      ],
    });
  });

  it("returns null when there is no provider to record (registry v1 gap, ADR-004 §6)", () => {
    const r = evaluate({ identifier: { scheme: "doi", value: doi } }, normalizeDoi(doi), {
      kind: "not_found",
      provider: null,
      response_sha256: null,
    });
    expect(toVerificationPayload(r, "cit_0000000001")).toBeNull();
  });
});
