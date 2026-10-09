// Identifier normalisation. Never guesses: input that could mean more than one identifier
// returns `ambiguous` with candidates, and the verifier reports UNVERIFIED (ADR-004 §5.1).

import type { IDENTIFIER_SCHEMES } from "@ozdna/provenance-schema";

export type IdentifierScheme = (typeof IDENTIFIER_SCHEMES)[number];

export type NormalizedIdentifier =
  | { readonly status: "ok"; readonly scheme: IdentifierScheme; readonly value: string }
  | {
      readonly status: "ambiguous";
      readonly scheme: IdentifierScheme;
      readonly candidates: readonly string[];
    }
  | { readonly status: "invalid"; readonly scheme: IdentifierScheme; readonly reason: string };

const MAX_RAW = 2048;
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/;
const DOI_SHAPE = /^10\.\d{4,9}\/[^\s"<>]{1,500}$/;
const DOI_IN_TEXT = /10\.\d{4,9}\/[^\s"<>]+/g;
const DOI_PREFIX = /^(?:doi:\s*|https?:\/\/(?:dx\.)?(?:www\.)?doi\.org\/)/i;
const TRAILING = /[.,;:]$/;

const ok = (scheme: IdentifierScheme, value: string): NormalizedIdentifier => ({
  status: "ok",
  scheme,
  value,
});
const invalid = (scheme: IdentifierScheme, reason: string): NormalizedIdentifier => ({
  status: "invalid",
  scheme,
  reason,
});

function balanced(s: string, open: string, close: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === open) depth++;
    else if (ch === close && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Normalise a DOI as cited (bare, `doi:`, or a doi.org URL). DOIs are case-insensitive ASCII,
 * so the result is lowercase. Trailing punctuation and unbalanced closing brackets are
 * ambiguous (the citation's punctuation or part of the DOI?) and yield both candidates.
 */
export function normalizeDoi(raw: string): NormalizedIdentifier {
  if (typeof raw !== "string" || raw.length === 0) return invalid("doi", "empty");
  if (raw.length > MAX_RAW) return invalid("doi", "too long");
  let s = raw.trim();
  if (CONTROL.test(s)) return invalid("doi", "control characters");

  const found = [...new Set((s.match(DOI_IN_TEXT) ?? []).map((d) => d.toLowerCase()))];
  if (found.length > 1) {
    return { status: "ambiguous", scheme: "doi", candidates: found.slice(0, 10) };
  }

  s = s.replace(DOI_PREFIX, "");
  if (/%[0-9a-f]{2}/i.test(s)) {
    try {
      s = decodeURIComponent(s);
    } catch {
      return invalid("doi", "bad percent-encoding");
    }
    if (CONTROL.test(s)) return invalid("doi", "control characters");
  }
  s = s.toLowerCase();
  if (!DOI_SHAPE.test(s)) return invalid("doi", "not a DOI");
  // "." / ".." path segments would be resolved by URL parsers (even percent-encoded) and
  // could redirect an adapter request to another path on an allowed host.
  if (s.split("/").some((seg) => seg === "." || seg === "..")) return invalid("doi", "dot segment");

  const candidates: string[] = [];
  if (TRAILING.test(s)) candidates.push(s, s.slice(0, -1));
  else if (s.endsWith(")") && !balanced(s, "(", ")")) candidates.push(s, s.slice(0, -1));
  else if (s.endsWith("]") && !balanced(s, "[", "]")) candidates.push(s, s.slice(0, -1));
  if (candidates.length > 0) {
    const valid = candidates.filter((c) => DOI_SHAPE.test(c));
    return valid.length === 1
      ? ok("doi", valid[0]!)
      : { status: "ambiguous", scheme: "doi", candidates: valid };
  }
  return ok("doi", s);
}

function isbnValid(d: string): boolean {
  if (/^\d{9}[\dX]$/.test(d)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (d[i] === "X" ? 10 : Number(d[i])) * (10 - i);
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(d)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
    return sum % 10 === 0;
  }
  return false;
}

function issnValid(d: string): boolean {
  if (!/^\d{7}[\dX]$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(d[i]) * (8 - i);
  const check = (11 - (sum % 11)) % 11;
  return (check === 10 ? "X" : String(check)) === d[7];
}

/** Normalise any supported identifier. Only DOIs have adapters (ADR-004); others verify as UNVERIFIED. */
export function normalizeIdentifier(scheme: IdentifierScheme, raw: string): NormalizedIdentifier {
  if (typeof raw !== "string" || raw.length > MAX_RAW) return invalid(scheme, "too long");
  const s = raw.trim();
  if (CONTROL.test(s)) return invalid(scheme, "control characters");
  switch (scheme) {
    case "doi":
      return normalizeDoi(s);
    case "pmid":
      return /^\d{1,8}$/.test(s) ? ok(scheme, String(Number(s))) : invalid(scheme, "not a PMID");
    case "pmcid": {
      const m = /^(?:pmc)?(\d{1,10})$/i.exec(s);
      return m ? ok(scheme, `PMC${m[1]}`) : invalid(scheme, "not a PMCID");
    }
    case "arxiv": {
      const t = s.replace(/^arxiv:/i, "");
      if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(t)) return ok(scheme, t);
      if (/^[a-z-]+(\.[A-Z]{2})?\/\d{7}(v\d+)?$/i.test(t)) return ok(scheme, t.toLowerCase());
      return invalid(scheme, "not an arXiv id");
    }
    case "isbn": {
      const d = s.replace(/[\s-]/g, "").toUpperCase();
      return isbnValid(d) ? ok(scheme, d) : invalid(scheme, "bad ISBN checksum");
    }
    case "issn": {
      const d = s.replace(/[\s-]/g, "").toUpperCase();
      return issnValid(d)
        ? ok(scheme, `${d.slice(0, 4)}-${d.slice(4)}`)
        : invalid(scheme, "bad ISSN checksum");
    }
    case "url": {
      let u: URL;
      try {
        u = new URL(s);
      } catch {
        return invalid(scheme, "not a URL");
      }
      if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password) {
        return invalid(scheme, "unsupported URL");
      }
      return ok(scheme, u.toString());
    }
    default:
      return invalid(scheme, "unsupported scheme");
  }
}
