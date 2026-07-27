// Verify verdicts — the single source of truth is plan/03-ALGORITHMS.md §6.3 (locked,
// hard-rule-5-safe strings) with thresholds from §1.5. 04-MVP-SPEC.md §4.4 adopts these
// verbatim; the match_type/confidence projection here is the documented convenience layer.
// Copy is reproduced VERBATIM from §6.3 — do not soften or invent strings. (Note: §6.3's
// own locked NO_RECORD crop-note contains the word "original"; that is the spec's string
// and wins over the global word-list, so it is preserved as-is.)

export const VERDICTS = [
  "EXACT_ANCHORED",
  "EXACT_PENDING",
  "SIGNED_BY_OZDNA",
  "VISUAL_MATCH_HIGH",
  "VISUAL_MATCH_PROBABLE",
  "NEAR_MISS",
  "THIRD_PARTY_CREDENTIALS",
  "SIGNATURE_BROKEN",
  "SIGNATURE_REVOKED",
  "NO_RECORD",
] as const;

export type Verdict = (typeof VERDICTS)[number];

/** Footer shown on EVERY verdict card (§6.3). */
export const VERDICT_FOOTER =
  "OzDNA records registration, not creation. A registration timestamp shows when a fingerprint entered our registry — not when or by whom the image was made, and not whether it is AI-generated.";

/** Appended to the footer when the record's fingerprints were computed in the browser (src = browser). */
export const VERDICT_FOOTER_BROWSER_APPEND =
  "Fingerprints for this record were computed on the registrant's device.";

export interface VerdictCopy {
  readonly headline: string;
  readonly body: string; // template with {placeholders} and {optional} segments, verbatim from §6.3
}

/** Verbatim §6.3 headline + body templates for every verdict. */
export const VERDICT_COPY: Record<Verdict, VerdictCopy> = {
  EXACT_ANCHORED: {
    headline: "Exact file found in the OzDNA registry",
    body: "This exact file (byte-for-byte) was registered by {account} on {registered_at} and anchored on the Base blockchain in block {block_number} on {block_time}. Independent proof: this record has existed, unchanged, since at least {block_time}. [Download proof JSON] [Verify it yourself — no OzDNA required]",
  },
  EXACT_PENDING: {
    headline: "Exact file found — blockchain anchor pending",
    body: "This exact file was registered by {account} on {registered_at}. Blockchain anchoring is pending (records are anchored within 24 hours; paid records within 1 hour). Check back after {eta} for the independent proof.",
  },
  SIGNED_BY_OZDNA: {
    headline: "Carries a valid OzDNA signature",
    body: "This file's embedded provenance signature is cryptographically valid and was made with OzDNA on {signing_time}{, timestamped by an independent time authority}. It matches registry record {record_id}{, anchored in block {block_number} on {block_time}}. Note: OzDNA signatures are not yet on the C2PA public trust list, so other verification tools may label the signer 'unknown source'. The blockchain anchor above is independently checkable regardless.",
  },
  VISUAL_MATCH_HIGH: {
    headline: "Visually matches a registered image (high confidence)",
    body: "This image's fingerprint is {d} bits away from a registered fingerprint (threshold 6){; confirmed by a second 256-bit fingerprint at distance {pdq_d} of 256 (threshold 31)}. The matching record was registered by {account} on {registered_at}{ and anchored on {block_time}}. Important: this is a visual-similarity match, not cryptographic proof — it indicates this image looks the same as the registered one, not that it is bit-identical or that either party made it. [Compare details]",
  },
  VISUAL_MATCH_PROBABLE: {
    headline: "Probably matches a registered image",
    body: "This image is visually similar to a registered image (fingerprint distance {d} of 64; confirming fingerprint distance {pdq_d} of 256). Similarity at this level is usually — not always — the same picture after edits or recompression. Registered by {account} on {registered_at}. Treat as a lead, not a conclusion.",
  },
  NEAR_MISS: {
    headline: "Similar registered images",
    body: "{n} registered image(s) with weak similarity (distance 11–12). These are frequently unrelated pictures that share coarse structure. Shown for completeness only.",
  },
  THIRD_PARTY_CREDENTIALS: {
    headline: "Carries Content Credentials from another provider",
    body: "This file has an embedded C2PA signature from {issuer}, which is not operated by OzDNA. We can report that the signature is cryptographically {valid/invalid} but cannot vouch for the issuer. Inspect the full credentials at the official C2PA Verify tool. No OzDNA registry record was found for this file.",
  },
  SIGNATURE_BROKEN: {
    headline: "Provenance signature does not match this file",
    body: "This file contains a provenance signature, but the file's current content no longer matches what was signed — it has been modified after signing (or the signature was copied from another file). This does not identify what changed{; a registry search found: see below}.",
  },
  SIGNATURE_REVOKED: {
    headline: "Signature made with a revoked key",
    body: "This file's signature was made with an OzDNA key that was later revoked (incident of {incident_date} — details). Because this record was not blockchain-anchored before the compromise window, OzDNA cannot vouch for it. Records anchored before the incident remain fully provable.",
  },
  NO_RECORD: {
    headline: "No OzDNA record found",
    body: "No registration matches this image. This does not mean the image is fake or AI-generated — the vast majority of images were never registered anywhere. It means only that OzDNA has no provenance information for it. {If d≤12 nothing found and query looks cropped: 'Note: heavy crops and rotations can defeat fingerprint matching — a registered original may still exist.'}",
  },
};

/** Hamming/PDQ thresholds, locked in plan/03 §1.5. */
export const THRESHOLDS = {
  strongMax: 6, // d ≤ 6 → VISUAL_MATCH_HIGH
  probableMax: 10, // 7 ≤ d ≤ 10 → VISUAL_MATCH_PROBABLE
  nearMax: 12, // 11 ≤ d ≤ 12 → NEAR_MISS (never a match)
  pdqConfirm: 31, // PDQ d ≤ 31 confirms (of 256)
} as const;

/** Exact SHA-256 match → verdict, split by anchor state (§6.2). */
export function exactVerdict(anchored: boolean): Verdict {
  return anchored ? "EXACT_ANCHORED" : "EXACT_PENDING";
}

export interface PerceptualResult {
  readonly verdict: Verdict;
  /** null when no PDQ hash was available to confirm; else whether pdqD ≤ 31. */
  readonly pdqConfirmed: boolean | null;
  /**
   * Whether this may be shown to the user AS A MATCH. Per §1.5: HIGH shows as a match
   * (PDQ confirms when present); PROBABLE shows as a match ONLY if PDQ ≤ 31 is present,
   * else it is "similar, unconfirmed"; NEAR_MISS/NO_RECORD are never matches.
   */
  readonly showAsMatch: boolean;
}

/** Map a perceptual pHash Hamming distance (+ optional PDQ distance) to a verdict (§1.5). */
export function classifyPerceptual(hammingD: number, pdqD?: number | null): PerceptualResult {
  const pdqConfirmed = pdqD == null ? null : pdqD <= THRESHOLDS.pdqConfirm;
  if (hammingD <= THRESHOLDS.strongMax) {
    // Strong: PDQ (when present) must confirm; a present-but-failing PDQ demotes to a lead.
    const showAsMatch = pdqConfirmed !== false;
    return { verdict: "VISUAL_MATCH_HIGH", pdqConfirmed, showAsMatch };
  }
  if (hammingD <= THRESHOLDS.probableMax) {
    // Probable: shows as a match ONLY with a present, passing PDQ (§1.5).
    return { verdict: "VISUAL_MATCH_PROBABLE", pdqConfirmed, showAsMatch: pdqConfirmed === true };
  }
  if (hammingD <= THRESHOLDS.nearMax) {
    return { verdict: "NEAR_MISS", pdqConfirmed, showAsMatch: false };
  }
  return { verdict: "NO_RECORD", pdqConfirmed, showAsMatch: false };
}

export type MatchType = "exact" | "manifest" | "perceptual" | "none";
export type Confidence = "exact" | "high" | "medium" | null;

/** Documented convenience projection of a verdict (04-MVP-SPEC §4.4). */
export function toMatchProjection(verdict: Verdict): { matchType: MatchType; confidence: Confidence } {
  switch (verdict) {
    case "EXACT_ANCHORED":
    case "EXACT_PENDING":
      return { matchType: "exact", confidence: "exact" };
    case "SIGNED_BY_OZDNA":
    case "THIRD_PARTY_CREDENTIALS":
    case "SIGNATURE_BROKEN":
    case "SIGNATURE_REVOKED":
      return { matchType: "manifest", confidence: null };
    case "VISUAL_MATCH_HIGH":
      return { matchType: "perceptual", confidence: "high" };
    case "VISUAL_MATCH_PROBABLE":
      return { matchType: "perceptual", confidence: "medium" };
    case "NEAR_MISS": // surfaced only in the expandable near-matches list, never a match
    case "NO_RECORD":
      return { matchType: "none", confidence: null };
  }
}
