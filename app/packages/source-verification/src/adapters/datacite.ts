// DataCite adapter (ADR-004 §1). No confirmed retraction/correction signal exists in DataCite
// metadata, so records carry integrity_signal = false and can never reach VERIFIED.

import { z } from "zod";
import { fetchJson, ProviderHttpError } from "../http.js";
import { normalizeDoi } from "../identifiers.js";
import { sanitizeText } from "../text.js";
import type { LookupOutcome } from "../types.js";
import { type AdapterContext, doiPath, userAgent } from "./context.js";

const str = z.string().max(100_000);

const doiDoc = z.object({
  data: z.object({
    type: z.literal("dois"),
    attributes: z.object({
      doi: z.string().max(600),
      state: z.string().max(32).optional(),
      titles: z
        .array(z.object({ title: str }))
        .max(20)
        .optional(),
      creators: z
        .array(z.object({ name: str.optional(), familyName: str.optional() }))
        .max(5000)
        .optional(),
      publicationYear: z.union([z.number().int(), z.string().max(8)]).optional(),
      container: z.object({ title: str.optional() }).optional(),
      publisher: z.union([str, z.object({ name: str.optional() })]).optional(),
    }),
  }),
});

export async function fetchDataCiteDoi(doi: string, ctx: AdapterContext): Promise<LookupOutcome> {
  let res: Awaited<ReturnType<typeof fetchJson>>;
  try {
    res = await fetchJson(
      `https://api.datacite.org/dois/${doiPath(doi)}?mailto=${encodeURIComponent(ctx.contactEmail)}`,
      {
        fetch: ctx.fetch,
        userAgent: userAgent(ctx),
        accept: ["application/vnd.api+json", "application/json"],
        passStatuses: [404],
        ...(ctx.timeoutMs !== undefined ? { timeoutMs: ctx.timeoutMs } : {}),
        ...(ctx.maxBytes !== undefined ? { maxBytes: ctx.maxBytes } : {}),
      },
    );
  } catch (e) {
    const reason = e instanceof ProviderHttpError ? `DATACITE_${e.code}` : "DATACITE_ERROR";
    return { kind: "unavailable", provider: "datacite", reason, response_sha256: null };
  }
  if (res.status === 404) {
    return {
      kind: "unavailable",
      provider: "datacite",
      reason: "DATACITE_404",
      response_sha256: res.sha256,
    };
  }
  const parsed = doiDoc.safeParse(res.json);
  if (!parsed.success) {
    return {
      kind: "unavailable",
      provider: "datacite",
      reason: "DATACITE_MALFORMED",
      response_sha256: res.sha256,
    };
  }
  const a = parsed.data.data.attributes;
  // Only public ("findable") DOIs count; draft/registered states are not citable records.
  if (a.state !== undefined && a.state !== "findable") {
    return {
      kind: "unavailable",
      provider: "datacite",
      reason: "DATACITE_NOT_FINDABLE",
      response_sha256: res.sha256,
    };
  }
  const returned = normalizeDoi(a.doi);
  const year =
    typeof a.publicationYear === "string" ? Number(a.publicationYear) : a.publicationYear;
  return {
    kind: "found",
    record: {
      provider: "datacite",
      doi: returned.status === "ok" ? returned.value : "",
      title: sanitizeText(a.titles?.[0]?.title),
      family_names: (a.creators ?? [])
        .slice(0, 500)
        .map((c) => sanitizeText(c.familyName ?? c.name?.split(",")[0], 200))
        .filter((n): n is string => n !== null),
      year: Number.isInteger(year) && year! >= 1000 && year! <= 2999 ? year! : null,
      container: sanitizeText(a.container?.title),
      updates: [],
      integrity_signal: false,
      response_sha256: res.sha256,
    },
  };
}
