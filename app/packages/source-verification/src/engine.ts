// The verification engine — pure: no I/O, no clock, no randomness, no model output. It turns a
// cited reference plus a provider lookup outcome into one of the eight states, an integer
// confidence in basis points, and the component scores behind it. Rules: ADR-004 §5.

import type { NormalizedIdentifier } from "./identifiers.js";
import { nameKey, titleSimilarityBp } from "./text.js";
import type {
  CitedReference,
  LookupOutcome,
  ProviderRecord,
  VerificationResult,
  VerificationState,
} from "./types.js";

/** Crossmark update types by effect (ADR-004 §5.2). Anything else → UNVERIFIED. */
export const RETRACTION_TYPES = new Set([
  "retraction",
  "partial_retraction",
  "withdrawal",
  "removal",
]);
export const CONCERN_TYPES = new Set(["expression_of_concern"]);
export const CORRECTION_TYPES = new Set(["correction", "corrigendum", "erratum"]);
export const NEUTRAL_TYPES = new Set(["addendum", "clarification", "new_version", "new_edition"]);

/** Field weights for confidence (basis points; only fields both sides have are compared). */
export const WEIGHTS = { title: 5000, authors: 2500, year: 1500, container: 1000 } as const;

export const THRESHOLDS = {
  /** VERIFIED needs at least this title similarity and confidence. */
  verifiedTitle: 8000,
  verifiedConfidence: 8500,
  /** Below this title similarity the provider record is probably a different work. */
  conflictTitle: 4000,
  /** Confidence when only the identifier could be compared. */
  identityOnly: 5000,
} as const;

function result(
  state: VerificationState,
  confidence: number,
  components: Record<string, number>,
  extra: Partial<VerificationResult> = {},
): VerificationResult {
  return {
    state,
    confidence_bp: confidence,
    components,
    provider: null,
    provider_response_sha256: null,
    candidates: [],
    reason: null,
    ...extra,
  };
}

function yearBp(cited: number, found: number): number {
  const d = Math.abs(cited - found);
  return d === 0 ? 10_000 : d === 1 ? 5000 : 0; // ±1: online-first vs issue year
}

function authorOverlapBp(cited: readonly string[], found: readonly string[]): number {
  const have = new Set(found.map(nameKey).filter(Boolean));
  const want = [...new Set(cited.map(nameKey).filter(Boolean))];
  if (want.length === 0 || have.size === 0) return -1;
  const hit = want.filter((n) => have.has(n)).length;
  return Math.floor((hit * 10_000) / want.length);
}

interface Match {
  readonly components: Record<string, number>;
  readonly confidence: number;
  readonly compared: { title: boolean; authors: boolean; year: boolean; container: boolean };
}

function compare(ref: CitedReference, rec: ProviderRecord): Match {
  const components: Record<string, number> = { identifier_match: 10_000 };
  const compared = { title: false, authors: false, year: false, container: false };
  let weighted = 0;
  let weight = 0;
  const add = (key: keyof typeof WEIGHTS, component: string, score: number) => {
    components[component] = score;
    compared[key] = true;
    weighted += WEIGHTS[key] * score;
    weight += WEIGHTS[key];
  };

  if (ref.title && rec.title)
    add("title", "title_similarity", titleSimilarityBp(ref.title, rec.title));
  if (ref.authors && ref.authors.length > 0) {
    const s = authorOverlapBp(ref.authors, rec.family_names);
    if (s >= 0) add("authors", "author_overlap", s);
  }
  if (Number.isInteger(ref.year) && rec.year !== null)
    add("year", "year_match", yearBp(ref.year!, rec.year));
  if (ref.container && rec.container) {
    add("container", "container_similarity", titleSimilarityBp(ref.container, rec.container));
  }
  const fields = Object.values(compared).filter(Boolean).length;
  components.fields_compared = fields;
  const confidence = weight === 0 ? THRESHOLDS.identityOnly : Math.floor(weighted / weight);
  return { components, confidence, compared };
}

/**
 * Decide the state. Order (ADR-004 §5):
 *  1. identifier problems / lookup failures → UNVERIFIED or IDENTIFIER_NOT_FOUND;
 *  2. metadata that contradicts the citation → CONFLICTING_METADATA (identity in doubt, so
 *     integrity notices are not attributed to the cited work, but are still recorded);
 *  3. integrity notices (Crossref only) → RETRACTED > EXPRESSION_OF_CONCERN > CORRECTED;
 *     an unknown update type → UNVERIFIED;
 *  4. otherwise VERIFIED (strong match + integrity signal) or PARTIALLY_VERIFIED.
 */
export function evaluate(
  ref: CitedReference,
  normalized: NormalizedIdentifier,
  lookup: LookupOutcome | null,
): VerificationResult {
  if (normalized.status === "ambiguous") {
    return result(
      "UNVERIFIED",
      0,
      { identifier_match: 0 },
      {
        reason: "AMBIGUOUS_IDENTIFIER",
        candidates: normalized.candidates
          .slice(0, 10)
          .map((value) => ({ scheme: normalized.scheme, value })),
      },
    );
  }
  if (normalized.status === "invalid") {
    return result("UNVERIFIED", 0, { identifier_match: 0 }, { reason: "IDENTIFIER_INVALID" });
  }
  if (lookup === null) return result("UNVERIFIED", 0, {}, { reason: "NO_ADAPTER" });
  if (lookup.kind === "not_found") {
    return result(
      "IDENTIFIER_NOT_FOUND",
      0,
      { identifier_match: 0 },
      {
        provider: lookup.provider,
        provider_response_sha256: lookup.response_sha256,
        reason: "DOI_DOES_NOT_EXIST",
      },
    );
  }
  if (lookup.kind === "unavailable") {
    return result(
      "UNVERIFIED",
      0,
      {},
      {
        provider: lookup.provider,
        provider_response_sha256: lookup.response_sha256,
        reason: lookup.reason,
      },
    );
  }

  const rec = lookup.record;
  const base = { provider: rec.provider, provider_response_sha256: rec.response_sha256 };
  if (rec.doi !== normalized.value) {
    // The provider answered for a different DOI (alias, redirect): never treat as a match.
    return result(
      "UNVERIFIED",
      0,
      { identifier_match: 0 },
      { ...base, reason: "PROVIDER_DOI_MISMATCH" },
    );
  }

  const { components, confidence, compared } = compare(ref, rec);
  components.integrity_signal = rec.integrity_signal ? 10_000 : 0;

  const types = rec.updates.map((u) => u.type);
  const sources = new Set(rec.updates.map((u) => u.source));
  if (rec.updates.length > 0) {
    components.source_publisher = sources.has("publisher") ? 10_000 : 0;
    components.source_retraction_watch = sources.has("retraction-watch") ? 10_000 : 0;
  }
  const retracted = types.some((t) => RETRACTION_TYPES.has(t));
  const concern = types.some((t) => CONCERN_TYPES.has(t));
  const corrected = types.some((t) => CORRECTION_TYPES.has(t));
  if (retracted) components.update_retraction = 10_000;
  if (concern) components.update_concern = 10_000;
  if (corrected) components.update_correction = 10_000;
  const unknownUpdate = types.some(
    (t) =>
      !RETRACTION_TYPES.has(t) &&
      !CONCERN_TYPES.has(t) &&
      !CORRECTION_TYPES.has(t) &&
      !NEUTRAL_TYPES.has(t),
  );

  const conflicting =
    (compared.title && components.title_similarity! < THRESHOLDS.conflictTitle) ||
    (compared.year && components.year_match === 0) ||
    (compared.authors && components.author_overlap === 0);
  if (conflicting) return result("CONFLICTING_METADATA", confidence, components, base);

  if (rec.integrity_signal) {
    if (unknownUpdate) {
      return result("UNVERIFIED", confidence, components, {
        ...base,
        reason: "UNKNOWN_UPDATE_TYPE",
      });
    }
    if (retracted) return result("RETRACTED", confidence, components, base);
    if (concern) return result("EXPRESSION_OF_CONCERN", confidence, components, base);
    if (corrected) return result("CORRECTED", confidence, components, base);
  }

  const strong =
    compared.title &&
    components.title_similarity! >= THRESHOLDS.verifiedTitle &&
    confidence >= THRESHOLDS.verifiedConfidence &&
    (!compared.year || components.year_match! >= 5000) &&
    (!compared.authors || components.author_overlap! >= 5000);
  if (strong && rec.integrity_signal) return result("VERIFIED", confidence, components, base);
  return result("PARTIALLY_VERIFIED", confidence, components, base);
}
