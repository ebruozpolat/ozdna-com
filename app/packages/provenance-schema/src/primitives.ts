// Shared zod primitives for the provenance envelope and payloads.

import { z } from "zod";

export const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "expected 64 lowercase hex");

/** Prefixed opaque id, e.g. prj_01J…, evt_…, art_…. Prefix is checked per field. */
export function prefixedId(prefix: string) {
  return z
    .string()
    .regex(
      new RegExp(`^${prefix}_[0-9A-Za-z]{8,64}$`),
      `expected ${prefix}_ followed by 8–64 alphanumerics`,
    );
}

const ISO_UTC_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * ISO-8601 UTC with exactly 3 fractional digits, years 0001–9999, and a real calendar instant
 * (rejects 2026-02-30T…). Pure: Date.parse never reads the clock.
 */
export const isoUtcMs = z.string().refine((s) => {
  // Year 0000 is valid ISO 8601 but not representable in common date libraries.
  if (!ISO_UTC_MS.test(s) || s.startsWith("0000")) return false;
  const t = Date.parse(s);
  return Number.isFinite(t) && new Date(t).toISOString() === s;
}, "expected ISO-8601 UTC with milliseconds, e.g. 2026-10-07T12:00:00.000Z");

/**
 * Characters that can hide or reorder text when a value is displayed (C0/C1 controls,
 * line/paragraph separators, bidi overrides/isolates — "Trojan Source"), plus BOM.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/;

/** Short human-readable text: 1..max UTF-16 units, no control or bidi-override characters. */
export function safeText(max: number) {
  return z
    .string()
    .min(1)
    .max(max)
    .refine((s) => !UNSAFE_TEXT.test(s), "control or bidi-override characters are not allowed");
}

/** Integer basis points 0..10000 (confidence and component scores). */
export const basisPoints = z.number().int().min(0).max(10_000);
