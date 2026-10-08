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

/** Version of the verification logic; recorded with every stored result (Phase 4c). */
export const VERIFIER_VERSION = "0.4.0";

export interface DetailedVerification {
  readonly result: VerificationResult;
  /** The provider outcome behind the result; null when no lookup was attempted. */
  readonly lookup: LookupOutcome | null;
}

/** Like verifyReference, but also returns the provider outcome (record, failure reason). */
export async function verifyReferenceDetailed(
  ref: CitedReference,
  ctx: AdapterContext,
): Promise<DetailedVerification> {
  const normalized = normalizeIdentifier(ref.identifier.scheme, ref.identifier.value);
  if (normalized.status !== "ok" || normalized.scheme !== "doi") {
    return { result: evaluate(ref, normalized, null), lookup: null };
  }
  const lookup: LookupOutcome = validContactEmail(ctx.contactEmail)
    ? await lookupDoi(normalized.value, ctx)
    : // Fail closed without touching the network: providers require identification.
      {
        kind: "unavailable",
        provider: null,
        reason: "PROVIDER_NOT_CONFIGURED",
        response_sha256: null,
      };
  return { result: evaluate(ref, normalized, lookup), lookup };
}

/** Verify one cited reference. Never throws for provider problems; it reports them. */
export async function verifyReference(
  ref: CitedReference,
  ctx: AdapterContext,
): Promise<VerificationResult> {
  return (await verifyReferenceDetailed(ref, ctx)).result;
}
