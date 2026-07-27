import { describe, expect, it } from "vitest";
import { pickBestMatch, scorePerceptualCandidates, usablePdq } from "../src/match.js";
import { PDQ_QUALITY_MIN, pdqQualityOk } from "../src/pdq.js";

describe("scorePerceptualCandidates", () => {
  const query = 0x80025e2e7b3f972bn;
  const zeros = new Uint8Array(32);
  const ones = new Uint8Array(32).fill(0xff);

  it("ranks exact pHash + confirming PDQ as VISUAL_MATCH_HIGH showAsMatch", () => {
    const scored = scorePerceptualCandidates(
      query,
      [{ id: "rec_a", phash64: BigInt.asIntN(64, query), pdq256: zeros }],
      zeros,
    );
    expect(scored[0]!.classification.verdict).toBe("VISUAL_MATCH_HIGH");
    expect(scored[0]!.classification.showAsMatch).toBe(true);
    expect(scored[0]!.pdqDistance).toBe(0);
  });

  it("rejects PDQ confirmation when query quality is too low", () => {
    expect(pdqQualityOk(PDQ_QUALITY_MIN - 1)).toBe(false);
    const scored = scorePerceptualCandidates(
      query,
      [{ id: "rec_a", phash64: BigInt.asIntN(64, query), pdq256: zeros }],
      zeros,
      PDQ_QUALITY_MIN - 1,
    );
    expect(scored[0]!.pdqDistance).toBeNull();
  });

  it("probable band without PDQ does not showAsMatch", () => {
    // Flip 8 bits in query to land in probable band (7–10) — construct known distance
    // Use a candidate whose Hamming we control via XOR pattern on low bits.
    const cand = query ^ 0xffn; // 8 bits flipped
    const scored = scorePerceptualCandidates(query, [
      { id: "rec_b", phash64: BigInt.asIntN(64, cand), pdq256: null },
    ]);
    expect(scored[0]!.phashDistance).toBe(8);
    expect(scored[0]!.classification.verdict).toBe("VISUAL_MATCH_PROBABLE");
    expect(scored[0]!.classification.showAsMatch).toBe(false);
  });

  it("pickBestMatch prefers showAsMatch over near-miss", () => {
    const scored = scorePerceptualCandidates(
      query,
      [
        { id: "near", phash64: BigInt.asIntN(64, query ^ 0xfffn), pdq256: null }, // 12 bits
        { id: "hit", phash64: BigInt.asIntN(64, query), pdq256: zeros },
      ],
      zeros,
    );
    const { best } = pickBestMatch(scored);
    expect(best?.id).toBe("hit");
  });

  it("usablePdq drops low quality", () => {
    expect(usablePdq({ hash: ones, quality: 10 })).toBeNull();
    expect(usablePdq({ hash: ones, quality: 90 })?.quality).toBe(90);
  });
});
