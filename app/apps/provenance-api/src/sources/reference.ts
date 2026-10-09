// Turn a verify request's reference (an identifier, or a CSL-JSON item) into a CitedReference.
// CSL fields are read, bounded and type-checked; anything unexpected is dropped, never coerced.
// Nothing here guesses: a CSL item with no usable identifier is rejected (no_identifier).

import type { CitedReference, IdentifierScheme } from "@ozdna/source-verification";

export type ReferenceInput =
  | { readonly identifier: { readonly scheme: IdentifierScheme; readonly value: string } }
  | { readonly csl: Readonly<Record<string, unknown>> };

/** CSL variable → identifier scheme, in precedence order. */
const CSL_IDENTIFIERS: ReadonlyArray<readonly [string, IdentifierScheme]> = [
  ["DOI", "doi"],
  ["PMID", "pmid"],
  ["PMCID", "pmcid"],
  ["ISBN", "isbn"],
  ["ISSN", "issn"],
  ["URL", "url"],
];

const MAX_TEXT = 1000;
const MAX_AUTHORS = 100;

function text(v: unknown, max = MAX_TEXT): string | null {
  if (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

function cslYear(issued: unknown): number | null {
  if (typeof issued !== "object" || issued === null) return null;
  const parts = (issued as { "date-parts"?: unknown })["date-parts"];
  if (!Array.isArray(parts) || !Array.isArray(parts[0])) return null;
  const y = parts[0][0];
  const n = typeof y === "string" && /^\d{4}$/.test(y) ? Number(y) : y;
  return typeof n === "number" && Number.isInteger(n) && n >= 1000 && n <= 9999 ? n : null;
}

function cslAuthors(author: unknown): string[] {
  if (!Array.isArray(author)) return [];
  const out: string[] = [];
  for (const a of author.slice(0, MAX_AUTHORS)) {
    if (typeof a !== "object" || a === null) continue;
    const name =
      text((a as { family?: unknown }).family, 200) ??
      text((a as { literal?: unknown }).literal, 200);
    if (name) out.push(name);
  }
  return out;
}

export function toCitedReference(input: ReferenceInput): {
  readonly reference: CitedReference | null;
  readonly kind: "identifier" | "csl_json";
} {
  if ("identifier" in input) {
    return { reference: { identifier: { ...input.identifier } }, kind: "identifier" };
  }
  const csl = input.csl;
  let identifier: CitedReference["identifier"] | null = null;
  for (const [key, scheme] of CSL_IDENTIFIERS) {
    const value = text(csl[key], 512);
    if (value) {
      identifier = { scheme, value };
      break;
    }
  }
  if (!identifier) return { reference: null, kind: "csl_json" };
  const authors = cslAuthors(csl.author);
  return {
    reference: {
      identifier,
      title: text(csl.title),
      authors: authors.length > 0 ? authors : null,
      year: cslYear(csl.issued),
      container: text(csl["container-title"]),
    },
    kind: "csl_json",
  };
}
