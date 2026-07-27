import { describe, expect, it } from "vitest";
import {
  classifyPerceptual,
  exactVerdict,
  toMatchProjection,
  VERDICT_COPY,
  VERDICT_FOOTER,
  VERDICTS,
} from "../src/verdict.js";

describe("verdict enum + copy (plan/03 §6.3)", () => {
  it("has exactly the 10 locked verdicts", () => {
    expect(VERDICTS.length).toBe(10);
    expect(new Set(VERDICTS).size).toBe(10);
  });

  it("every verdict has non-empty headline + body copy", () => {
    for (const v of VERDICTS) {
      expect(VERDICT_COPY[v].headline.length, v).toBeGreaterThan(0);
      expect(VERDICT_COPY[v].body.length, v).toBeGreaterThan(0);
    }
  });

  it("footer states registration-not-creation and headlines avoid the banned claim words", () => {
    expect(VERDICT_FOOTER).toMatch(/registration, not creation/);
    // hard rule 5: headlines must never assert authenticity/trust
    for (const v of VERDICTS) {
      expect(VERDICT_COPY[v].headline).not.toMatch(
        /\b(authentic|trusted|verified real|genuine)\b/i,
      );
    }
  });
});

describe("exact + perceptual classification (plan/03 §1.5)", () => {
  it("exact splits by anchor state", () => {
    expect(exactVerdict(true)).toBe("EXACT_ANCHORED");
    expect(exactVerdict(false)).toBe("EXACT_PENDING");
  });

  it("threshold boundaries map to the right verdict", () => {
    expect(classifyPerceptual(0).verdict).toBe("VISUAL_MATCH_HIGH");
    expect(classifyPerceptual(6).verdict).toBe("VISUAL_MATCH_HIGH");
    expect(classifyPerceptual(7).verdict).toBe("VISUAL_MATCH_PROBABLE");
    expect(classifyPerceptual(10).verdict).toBe("VISUAL_MATCH_PROBABLE");
    expect(classifyPerceptual(11).verdict).toBe("NEAR_MISS");
    expect(classifyPerceptual(12).verdict).toBe("NEAR_MISS");
    expect(classifyPerceptual(13).verdict).toBe("NO_RECORD");
  });

  it("PDQ confirmation gates match display per §1.5", () => {
    // strong: no PDQ present → still a match; present & passing → match; present & failing → demoted
    expect(classifyPerceptual(3, null)).toMatchObject({ pdqConfirmed: null, showAsMatch: true });
    expect(classifyPerceptual(3, 9)).toMatchObject({ pdqConfirmed: true, showAsMatch: true });
    expect(classifyPerceptual(3, 40)).toMatchObject({ pdqConfirmed: false, showAsMatch: false });
    // probable: shows as a match ONLY with a present, passing PDQ
    expect(classifyPerceptual(8, null).showAsMatch).toBe(false);
    expect(classifyPerceptual(8, 20).showAsMatch).toBe(true);
    expect(classifyPerceptual(8, 40).showAsMatch).toBe(false);
    // near-miss / none are never matches
    expect(classifyPerceptual(11, 5).showAsMatch).toBe(false);
    expect(classifyPerceptual(20, 5).showAsMatch).toBe(false);
  });
});

describe("match_type/confidence projection (plan/04 §4.4)", () => {
  it("maps every verdict to its documented bucket", () => {
    expect(toMatchProjection("EXACT_ANCHORED")).toEqual({
      matchType: "exact",
      confidence: "exact",
    });
    expect(toMatchProjection("EXACT_PENDING")).toEqual({ matchType: "exact", confidence: "exact" });
    expect(toMatchProjection("SIGNED_BY_OZDNA")).toEqual({
      matchType: "manifest",
      confidence: null,
    });
    expect(toMatchProjection("THIRD_PARTY_CREDENTIALS")).toEqual({
      matchType: "manifest",
      confidence: null,
    });
    expect(toMatchProjection("SIGNATURE_BROKEN")).toEqual({
      matchType: "manifest",
      confidence: null,
    });
    expect(toMatchProjection("SIGNATURE_REVOKED")).toEqual({
      matchType: "manifest",
      confidence: null,
    });
    expect(toMatchProjection("VISUAL_MATCH_HIGH")).toEqual({
      matchType: "perceptual",
      confidence: "high",
    });
    expect(toMatchProjection("VISUAL_MATCH_PROBABLE")).toEqual({
      matchType: "perceptual",
      confidence: "medium",
    });
    expect(toMatchProjection("NEAR_MISS")).toEqual({ matchType: "none", confidence: null });
    expect(toMatchProjection("NO_RECORD")).toEqual({ matchType: "none", confidence: null });
  });
});
