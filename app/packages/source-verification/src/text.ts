// Untrusted-text handling and token similarity. Provider text is data: it is capped,
// stripped of control/bidi characters and markup, and only ever compared as tokens — never
// interpreted. All scores are integer basis points (0..10000).

/** Longest provider string we keep (anything longer is cut, not trusted). */
export const MAX_TEXT = 1000;

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/g;
const TAGS = /<[^<>]{0,200}>/g;

/** Make provider text safe to store and display: no controls, no markup, bounded, NFC. */
export function sanitizeText(input: unknown, max = MAX_TEXT): string | null {
  if (typeof input !== "string") return null;
  const s = input
    .slice(0, max * 4)
    .replace(TAGS, " ")
    .replace(UNSAFE, " ")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC")
    .slice(0, max);
  return s.length > 0 ? s : null;
}

const STOP = new Set(["a", "an", "and", "the", "of", "in", "on", "for", "to", "with", "by", "at"]);

/** Comparison tokens: decomposed, accents removed, lowercase, alphanumeric words, no stop words. */
export function tokens(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .slice(0, MAX_TEXT)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((t) => t.length > 0 && !STOP.has(t));
}

/** Normalised family name for author matching. */
export function nameKey(s: string | null | undefined): string {
  return tokens(s).join(" ");
}

/**
 * Title similarity in basis points: Jaccard of token sets, or — so a citation that omits a
 * subtitle still scores — containment of the cited tokens in the provider's, capped at 9000
 * and only for citations of at least 3 tokens.
 */
export function titleSimilarityBp(
  cited: string | null | undefined,
  provider: string | null | undefined,
): number {
  const a = new Set(tokens(cited));
  const b = new Set(tokens(provider));
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  const jaccard = Math.floor((inter * 10_000) / union);
  const containment = a.size >= 3 ? Math.min(9000, Math.floor((inter * 10_000) / a.size)) : 0;
  return Math.max(jaccard, containment);
}
