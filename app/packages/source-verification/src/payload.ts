// Map a VerificationResult onto the registry payload `source.verification_recorded@1`.
// Validated against the registry so engine and wire format cannot drift apart.

import { REGISTRY_V1 } from "@ozdna/provenance-schema";
import type { VerificationResult } from "./types.js";

/**
 * Returns the event payload, or null when the result cannot be recorded with registry v1
 * (no provider: unsupported RA, RA lookup failed, non-DOI identifier). ADR-004 §6 proposes
 * a @2 that can carry these.
 */
export function toVerificationPayload(
  result: VerificationResult,
  citationId: string,
): Record<string, unknown> | null {
  if (result.provider === null) return null;
  const payload = {
    citation_id: citationId,
    state: result.state,
    confidence_bp: result.confidence_bp,
    components: { ...result.components },
    provider: result.provider,
    provider_response_sha256: result.provider_response_sha256,
    candidates: result.candidates.map((c) => ({ scheme: c.scheme, value: c.value })),
  };
  const def = REGISTRY_V1.get("source.verification_recorded", 1)!;
  const check = def.payload.safeParse(payload);
  if (!check.success)
    throw new Error(`verification payload does not match registry: ${check.error.message}`);
  return payload;
}
