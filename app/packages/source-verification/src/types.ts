import type { VERIFICATION_STATES } from "@ozdna/provenance-schema";
import type { IdentifierScheme } from "./identifiers.js";

export type VerificationState = (typeof VERIFICATION_STATES)[number];
export type Provider = "crossref" | "datacite";

/** A reference as the author cited it. Everything except the identifier is optional. */
export interface CitedReference {
  readonly identifier: { readonly scheme: IdentifierScheme; readonly value: string };
  readonly title?: string | null;
  /** Family names. */
  readonly authors?: readonly string[] | null;
  readonly year?: number | null;
  readonly container?: string | null;
}

export type UpdateSource = "publisher" | "retraction-watch" | "unknown";

/** One update notice attached to a work (Crossref `updated-by`). Untrusted, sanitised. */
export interface UpdateNotice {
  readonly type: string;
  readonly source: UpdateSource;
  readonly notice_doi: string | null;
}

/** What an adapter extracted from a provider record (all text sanitised). */
export interface ProviderRecord {
  readonly provider: Provider;
  readonly doi: string;
  readonly title: string | null;
  readonly family_names: readonly string[];
  readonly year: number | null;
  readonly container: string | null;
  readonly updates: readonly UpdateNotice[];
  /** False when the provider has no confirmed retraction/correction signal (DataCite, ADR-004). */
  readonly integrity_signal: boolean;
  readonly response_sha256: string;
}

export type LookupOutcome =
  | { readonly kind: "found"; readonly record: ProviderRecord }
  /** Only the doi.org RA lookup can say this (ADR-004 §4). */
  | {
      readonly kind: "not_found";
      readonly provider: Provider | null;
      readonly response_sha256: string | null;
    }
  | {
      readonly kind: "unavailable";
      readonly provider: Provider | null;
      readonly reason: string;
      readonly response_sha256: string | null;
    };

export interface VerificationResult {
  readonly state: VerificationState;
  readonly confidence_bp: number;
  /** Structured signals behind the state and confidence (persisted, never recomputed). */
  readonly components: Readonly<Record<string, number>>;
  readonly provider: Provider | null;
  readonly provider_response_sha256: string | null;
  /** Alternatives when the reference was ambiguous; never auto-picked. */
  readonly candidates: ReadonlyArray<{ readonly scheme: IdentifierScheme; readonly value: string }>;
  /** Machine reason for UNVERIFIED / not-found outcomes, e.g. "AMBIGUOUS_IDENTIFIER". */
  readonly reason: string | null;
}
