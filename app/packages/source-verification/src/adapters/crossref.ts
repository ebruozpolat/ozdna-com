// Crossref adapter (ADR-004 §1). Reads only the fields it needs; every value is type-checked
// and sanitised. A shape surprise is MALFORMED → UNVERIFIED, never a guess.

import { z } from "zod";
import { fetchJson, ProviderHttpError } from "../http.js";
import { normalizeDoi } from "../identifiers.js";
import { sanitizeText } from "../text.js";
import type { LookupOutcome, UpdateNotice } from "../types.js";
import { type AdapterContext, doiPath, userAgent } from "./context.js";

const str = z.string().max(100_000);
const dateParts = z.object({
  "date-parts": z.array(z.array(z.number().int().nullable()).max(3)).max(4),
});

const updateEntry = z.object({
  type: z.string().max(64),
  source: z.string().max(64).optional(),
  DOI: z.string().max(600).optional(),
});

const work = z.object({
  status: z.literal("ok"),
  "message-type": z.literal("work"),
  message: z.object({
    DOI: z.string().max(600),
    title: z.array(str).max(20).optional(),
    author: z
      .array(z.object({ family: str.optional(), name: str.optional() }))
      .max(5000)
      .optional(),
    issued: dateParts.optional(),
    "container-title": z.array(str).max(20).optional(),
    "updated-by": z.array(updateEntry).max(200).optional(),
  }),
});

function source(s: string | undefined): UpdateNotice["source"] {
  return s === "publisher" || s === "retraction-watch" ? s : "unknown";
}

export async function fetchCrossrefWork(doi: string, ctx: AdapterContext): Promise<LookupOutcome> {
  let res: Awaited<ReturnType<typeof fetchJson>>;
  try {
    res = await fetchJson(
      `https://api.crossref.org/works/${doiPath(doi)}?mailto=${encodeURIComponent(ctx.contactEmail)}`,
      {
        fetch: ctx.fetch,
        userAgent: userAgent(ctx),
        accept: ["application/json"],
        passStatuses: [404],
        ...(ctx.timeoutMs !== undefined ? { timeoutMs: ctx.timeoutMs } : {}),
        ...(ctx.maxBytes !== undefined ? { maxBytes: ctx.maxBytes } : {}),
      },
    );
  } catch (e) {
    const reason = e instanceof ProviderHttpError ? `CROSSREF_${e.code}` : "CROSSREF_ERROR";
    return { kind: "unavailable", provider: "crossref", reason, response_sha256: null };
  }
  // 404 after the RA confirmed the DOI: alias / indexing lag — not "not found" (ADR-004 §4).
  if (res.status === 404) {
    return {
      kind: "unavailable",
      provider: "crossref",
      reason: "CROSSREF_404",
      response_sha256: res.sha256,
    };
  }
  const parsed = work.safeParse(res.json);
  if (!parsed.success) {
    return {
      kind: "unavailable",
      provider: "crossref",
      reason: "CROSSREF_MALFORMED",
      response_sha256: res.sha256,
    };
  }
  const m = parsed.data.message;
  const returned = normalizeDoi(m.DOI);
  const year = m.issued?.["date-parts"]?.[0]?.[0];
  return {
    kind: "found",
    record: {
      provider: "crossref",
      doi: returned.status === "ok" ? returned.value : "",
      title: sanitizeText(m.title?.[0]),
      family_names: (m.author ?? [])
        .slice(0, 500)
        .map((a) => sanitizeText(a.family ?? a.name, 200))
        .filter((n): n is string => n !== null),
      year: Number.isInteger(year) && year! >= 1000 && year! <= 2999 ? year! : null,
      container: sanitizeText(m["container-title"]?.[0]),
      updates: (m["updated-by"] ?? []).map((u) => ({
        type: (sanitizeText(u.type, 64) ?? "").toLowerCase(),
        source: source(u.source),
        notice_doi: u.DOI
          ? normalizeDoi(u.DOI).status === "ok"
            ? u.DOI.toLowerCase()
            : null
          : null,
      })),
      integrity_signal: true,
      response_sha256: res.sha256,
    },
  };
}
