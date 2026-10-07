// Orchestration: identifier → (DOI) registration agency → provider adapter → pure engine.
// Every failure path ends in UNVERIFIED; IDENTIFIER_NOT_FOUND only comes from doi.org.

import { type AdapterContext, validContactEmail } from "./adapters/context.js";
import { fetchCrossrefWork } from "./adapters/crossref.js";
import { fetchDataCiteDoi } from "./adapters/datacite.js";
import { lookupRegistrationAgency } from "./adapters/doi-ra.js";
import { evaluate } from "./engine.js";
import { normalizeIdentifier } from "./identifiers.js";
import type { CitedReference, LookupOutcome, VerificationResult } from "./types.js";

export async function lookupDoi(doi: string, ctx: AdapterContext): Promise<LookupOutcome> {
  const ra = await lookupRegistrationAgency(doi, ctx);
  if (ra.kind === "not_found")
    return { kind: "not_found", provider: null, response_sha256: ra.sha256 };
  if (ra.kind === "unavailable") {
    return { kind: "unavailable", provider: null, reason: ra.reason, response_sha256: ra.sha256 };
  }
  switch (ra.ra) {
    case "Crossref":
      return fetchCrossrefWork(doi, ctx);
    case "DataCite":
      return fetchDataCiteDoi(doi, ctx);
    default:
      return {
        kind: "unavailable",
        provider: null,
        reason: "RA_UNSUPPORTED",
        response_sha256: ra.sha256,
      };
  }
}

/** Verify one cited reference. Never throws for provider problems; it reports them. */
export async function verifyReference(
  ref: CitedReference,
  ctx: AdapterContext,
): Promise<VerificationResult> {
  const normalized = normalizeIdentifier(ref.identifier.scheme, ref.identifier.value);
  if (normalized.status !== "ok") return evaluate(ref, normalized, null);
  if (normalized.scheme !== "doi") return evaluate(ref, normalized, null);
  if (!validContactEmail(ctx.contactEmail)) {
    // Fail closed without touching the network: providers require identification.
    return evaluate(ref, normalized, {
      kind: "unavailable",
      provider: null,
      reason: "PROVIDER_NOT_CONFIGURED",
      response_sha256: null,
    });
  }
  return evaluate(ref, normalized, await lookupDoi(normalized.value, ctx));
}
