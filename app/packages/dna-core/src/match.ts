// Perceptual candidate scoring — plan/03 §1.5 / §2.4.
// Pure: takes already-fetched candidates + query hashes; no D1.

import { hammingU64, toUnsignedU64 } from "./bands.js";
import { effectivePdqDistance, type Pdq256Result, pdqDistance, pdqQualityOk } from "./pdq.js";
import { classifyPerceptual, type PerceptualResult } from "./verdict.js";

export type PerceptualCandidate = {
  readonly id: string;
  /** Signed or unsigned 64-bit pHash as stored/returned from D1 INTEGER. */
  readonly phash64: number | bigint;
  /** 32-byte PDQ when present. */
  readonly pdq256?: Uint8Array | null;
  readonly pdqQuality?: number | null;
};

export type ScoredCandidate = {
  readonly id: string;
  readonly phashDistance: number;
  readonly pdqDistance: number | null;
  readonly classification: PerceptualResult;
};

/**
 * Score candidates against a query pHash (+ optional query PDQ).
 * Sort key: (pdqDistance ascending nulls last, phashDistance ascending).
 */
export function scorePerceptualCandidates(
  queryPhashU64: bigint,
  candidates: readonly PerceptualCandidate[],
  queryPdq?: Uint8Array | null,
  queryPdqQuality?: number | null,
): ScoredCandidate[] {
  const queryPdqOk =
    queryPdq &&
    queryPdq.byteLength === 32 &&
    (queryPdqQuality == null || pdqQualityOk(queryPdqQuality));

  const scored: ScoredCandidate[] = [];
  for (const c of candidates) {
    const candU = toUnsignedU64(BigInt(c.phash64));
    const phD = hammingU64(queryPhashU64, candU);

    let pdD: number | null = null;
    if (queryPdqOk && c.pdq256 && c.pdq256.byteLength === 32) {
      if (c.pdqQuality == null || pdqQualityOk(c.pdqQuality)) {
        pdD = effectivePdqDistance(pdqDistance(queryPdq!, c.pdq256), c.pdqQuality);
      }
    }

    scored.push({
      id: c.id,
      phashDistance: phD,
      pdqDistance: pdD,
      classification: classifyPerceptual(phD, pdD),
    });
  }

  scored.sort((a, b) => {
    const ap = a.pdqDistance ?? 999;
    const bp = b.pdqDistance ?? 999;
    if (ap !== bp) return ap - bp;
    return a.phashDistance - b.phashDistance;
  });
  return scored;
}

/** Pick the best showAsMatch candidate, else best overall for near-miss listing. */
export function pickBestMatch(scored: readonly ScoredCandidate[]): {
  best: ScoredCandidate | null;
  nearMisses: ScoredCandidate[];
} {
  const match = scored.find((s) => s.classification.showAsMatch) ?? null;
  const nearMisses = scored.filter((s) => s.classification.verdict === "NEAR_MISS");
  return { best: match ?? scored[0] ?? null, nearMisses };
}

/** Helper: drop PDQ from a hash result when quality is too low. */
export function usablePdq(result: Pdq256Result): Pdq256Result | null {
  return pdqQualityOk(result.quality) ? result : null;
}
