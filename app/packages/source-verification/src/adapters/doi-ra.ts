// doi.org "Which RA?" lookup (ADR-004 §4). The only source of IDENTIFIER_NOT_FOUND.
//   https://doi.org/doiRA/<doi> → [{ "DOI": "...", "RA": "Crossref" }]
//   documented error states: "Invalid DOI", "DOI does not exist", "Unknown"
//   (the JSON key for an error state is unconfirmed; we accept it only under "status").

import { z } from "zod";
import { fetchJson, ProviderHttpError } from "../http.js";
import { type AdapterContext, doiPath, userAgent } from "./context.js";

export type RaLookup =
  | { readonly kind: "ra"; readonly ra: string; readonly sha256: string }
  | { readonly kind: "not_found"; readonly sha256: string }
  | { readonly kind: "unavailable"; readonly reason: string; readonly sha256: string | null };

const entry = z.object({
  DOI: z.string().max(600).optional(),
  RA: z.string().max(64).optional(),
  status: z.string().max(64).optional(),
});
const body = z.array(entry).min(1).max(10);

export async function lookupRegistrationAgency(
  doi: string,
  ctx: AdapterContext,
): Promise<RaLookup> {
  let res: Awaited<ReturnType<typeof fetchJson>>;
  try {
    res = await fetchJson(`https://doi.org/doiRA/${doiPath(doi)}`, {
      fetch: ctx.fetch,
      userAgent: userAgent(ctx),
      accept: ["application/json"],
      ...(ctx.timeoutMs !== undefined ? { timeoutMs: ctx.timeoutMs } : {}),
      maxBytes: Math.min(ctx.maxBytes ?? 64 * 1024, 64 * 1024),
    });
  } catch (e) {
    return {
      kind: "unavailable",
      reason: e instanceof ProviderHttpError ? `RA_${e.code}` : "RA_ERROR",
      sha256: null,
    };
  }
  const parsed = body.safeParse(res.json);
  if (!parsed.success) return { kind: "unavailable", reason: "RA_MALFORMED", sha256: res.sha256 };
  const first = parsed.data[0]!;
  if (typeof first.RA === "string" && first.RA.length > 0)
    return { kind: "ra", ra: first.RA, sha256: res.sha256 };
  if (first.status === "DOI does not exist") return { kind: "not_found", sha256: res.sha256 };
  return { kind: "unavailable", reason: "RA_UNKNOWN_STATE", sha256: res.sha256 };
}
