// Event-type registry v1. Every (type, type_version) an event may carry is listed here
// with a strict payload schema. Unknown types are rejected; there is no passthrough.
// Normative: app/docs/schemas/provenance-event-v1.md §5.
//
// Content rules baked into the schemas (IMPLEMENTATION_PLAN.md "data rules"):
//   - no manuscript text, claim text or raw prompts: claims and prompts appear only as
//     hashes/keyed commitments; free-text fields are short labels;
//   - declared AI use (ai.use_declared) and observed AI use (ai.use_observed) are
//     distinct types so they can never be conflated;
//   - verification states and confidence (integer basis points) are a closed set.

import { z } from "zod";
import { basisPoints, prefixedId, safeText, sha256Hex } from "./primitives.js";

export type ArtifactRule = "required" | "optional" | "forbidden";

export interface EventTypeDef {
  readonly type: string;
  readonly version: number;
  readonly payload: z.ZodType<Record<string, unknown>>;
  readonly artifact: ArtifactRule;
  /** Phase 3 signer may sign events of this type (and only these, plus checkpoints). */
  readonly signatureRequired: boolean;
  /** Canonical UTF-8 byte cap for the payload object. */
  readonly maxPayloadBytes: number;
  /**
   * Registry metadata (not part of any event or hash). `observed: true` marks facts ozDNA
   * itself observed, as opposed to facts a calling platform asserts. `minEvidenceLevel` is the
   * least evidence an event of this type carries: 1 = machine-observed, backed by hashes of
   * what was observed (spec §5.4). Unset on types released before Phase 4c.
   */
  readonly observed?: boolean;
  readonly minEvidenceLevel?: number;
}

export const VERIFICATION_STATES = [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "CONFLICTING_METADATA",
  "IDENTIFIER_NOT_FOUND",
  "RETRACTED",
  "CORRECTED",
  "EXPRESSION_OF_CONCERN",
  "UNVERIFIED",
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const IDENTIFIER_SCHEMES = [
  "doi",
  "isbn",
  "issn",
  "pmid",
  "pmcid",
  "arxiv",
  "url",
  "other",
] as const;

const identifier = z.object({ scheme: z.enum(IDENTIFIER_SCHEMES), value: safeText(512) }).strict();

const mediaType = z
  .string()
  .max(127)
  .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/, "expected type/subtype");

const byteLength = z
  .number()
  .int()
  .min(0)
  .max(2 ** 40);

const ARTIFACT_KINDS = [
  "manuscript",
  "dataset",
  "figure",
  "code",
  "supplement",
  "review",
  "other",
] as const;

const AI_PURPOSES = [
  "drafting",
  "editing",
  "translation",
  "literature_search",
  "data_analysis",
  "code",
  "other",
] as const;

const AI_OPERATIONS = [
  "generation",
  "rewrite",
  "suggestion_accepted",
  "suggestion_rejected",
  "citation_suggested",
] as const;

/** Why a source verification produced no provider answer (source.verification_failed). */
export const SOURCE_FAILURE_REASONS = [
  "no_provider_reached",
  "timeout",
  "rate_limited",
  "malformed_response",
  "provider_error",
  "provider_not_configured",
  "unsupported_registration_agency",
] as const;

/** Why a reference was not accepted as a source (source.rejected). */
export const SOURCE_REJECTION_REASONS = [
  "identifier_invalid",
  "identifier_ambiguous",
  "no_identifier",
] as const;

export const SOURCE_PROVIDERS_ATTEMPTED = ["doi_ra", "crossref", "datacite"] as const;

const DEFAULT_MAX_PAYLOAD = 8 * 1024;

const defs: EventTypeDef[] = [
  {
    type: "project.created",
    version: 1,
    artifact: "forbidden",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        /** Opaque id of the project in the calling platform. */
        external_ref: safeText(128),
      })
      .strict(),
  },
  {
    type: "artifact.registered",
    version: 1,
    artifact: "required",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        kind: z.enum(ARTIFACT_KINDS),
        content_sha256: sha256Hex,
        byte_length: byteLength,
        media_type: mediaType,
        label: safeText(200).nullable(),
      })
      .strict(),
  },
  {
    type: "artifact.version_added",
    version: 1,
    artifact: "required",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        content_sha256: sha256Hex,
        byte_length: byteLength,
        media_type: mediaType,
        supersedes_sha256: sha256Hex,
      })
      .strict(),
  },
  {
    type: "source.cited",
    version: 1,
    artifact: "required",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        citation_id: prefixedId("cit"),
        identifier,
        /** e.g. "p. 12" — a locator, not quoted text. */
        locator: safeText(64).nullable(),
      })
      .strict(),
  },
  {
    type: "source.verification_recorded",
    version: 1,
    artifact: "optional",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        citation_id: prefixedId("cit"),
        state: z.enum(VERIFICATION_STATES),
        confidence_bp: basisPoints,
        /** Structured signal scores that produced confidence_bp (persisted, not recomputed). */
        components: z
          .record(z.string().regex(/^[a-z][a-z0-9_]{0,31}$/), basisPoints)
          .refine((r) => Object.keys(r).length <= 16, "at most 16 components"),
        provider: z.enum(["crossref", "datacite", "manual"]),
        /** SHA-256 of the raw provider response kept as an artifact; null for manual. */
        provider_response_sha256: sha256Hex.nullable(),
        /** Ambiguous references are never auto-corrected: alternatives are listed. */
        candidates: z.array(identifier).max(10),
      })
      .strict(),
  },
  // ---- Phase 4c source lifecycle. source.verification_recorded@1 above is unchanged and
  // remains the "source verified" event; these types are additive.
  {
    type: "source.imported",
    version: 1,
    artifact: "forbidden",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        source_id: prefixedId("src"),
        citation_id: prefixedId("cit"),
        identifier,
        input_kind: z.enum(["identifier", "csl_json"]),
        /** SHA-256 of the canonical reference as submitted (the reference itself is not stored here). */
        input_sha256: sha256Hex,
      })
      .strict(),
  },
  {
    type: "source.status_changed",
    version: 1,
    artifact: "forbidden",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    observed: true,
    minEvidenceLevel: 1,
    payload: z
      .object({
        source_id: prefixedId("src"),
        previous_state: z.enum(VERIFICATION_STATES).nullable(),
        state: z.enum(VERIFICATION_STATES),
        result_id: prefixedId("svr"),
        /** Hash of the normalised provider snapshot behind the new state; null if none. */
        snapshot_sha256: sha256Hex.nullable(),
        trigger: z.enum(["request", "refresh"]),
      })
      .strict(),
  },
  {
    type: "source.rejected",
    version: 1,
    artifact: "forbidden",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    observed: true,
    minEvidenceLevel: 1,
    payload: z
      .object({
        citation_id: prefixedId("cit"),
        reason: z.enum(SOURCE_REJECTION_REASONS),
        input_sha256: sha256Hex,
        /** Ambiguous references are never auto-corrected: alternatives are listed. */
        candidates: z.array(identifier).max(10),
      })
      .strict(),
  },
  {
    type: "source.verification_failed",
    version: 1,
    artifact: "forbidden",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    observed: true,
    minEvidenceLevel: 1,
    payload: z
      .object({
        source_id: prefixedId("src"),
        reason: z.enum(SOURCE_FAILURE_REASONS),
        verifier_version: z.string().regex(/^[a-z0-9][a-z0-9.+-]{0,31}$/),
        attempted_providers: z
          .array(z.enum(SOURCE_PROVIDERS_ATTEMPTED))
          .max(3)
          .refine((a) => new Set(a).size === a.length, "providers must be unique"),
      })
      .strict(),
  },
  {
    type: "claim.recorded",
    version: 1,
    artifact: "required",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        claim_id: prefixedId("clm"),
        /** Keyed commitment computed by the platform; claim text never reaches ozDNA. */
        claim_commitment: sha256Hex,
        commitment_scheme: z.literal("hmac-sha256/v1"),
      })
      .strict(),
  },
  {
    type: "claim.source_linked",
    version: 1,
    artifact: "required",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        claim_id: prefixedId("clm"),
        citation_id: prefixedId("cit"),
        relation: z.enum(["supports", "contradicts", "mentions"]),
      })
      .strict(),
  },
  {
    type: "ai.use_declared",
    version: 1,
    artifact: "optional",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        tool: safeText(128),
        purpose: z.enum(AI_PURPOSES),
      })
      .strict(),
  },
  {
    type: "ai.use_observed",
    version: 1,
    artifact: "optional",
    signatureRequired: false,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        tool: safeText(128),
        operation: z.enum(AI_OPERATIONS),
        /** Hash commitments only — raw prompts/outputs are never in an event. */
        prompt_sha256: sha256Hex.nullable(),
        output_sha256: sha256Hex.nullable(),
        citation_id: prefixedId("cit").nullable(),
      })
      .strict(),
  },
  {
    type: "evidence_pack.generated",
    version: 1,
    artifact: "optional",
    signatureRequired: true,
    maxPayloadBytes: DEFAULT_MAX_PAYLOAD,
    payload: z
      .object({
        pack_schema: z.literal("ozdna.provenance.pack/v1"),
        pack_sha256: sha256Hex,
        checkpoint_seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        checkpoint_digest: sha256Hex,
      })
      .strict(),
  },
];

/** Immutable registry. A Map, so lookups like "constructor" or "__proto__" find nothing. */
export class EventRegistry {
  private readonly byKey: ReadonlyMap<string, EventTypeDef>;

  constructor(entries: readonly EventTypeDef[]) {
    const m = new Map<string, EventTypeDef>();
    for (const d of entries) {
      const key = `${d.type}@${d.version}`;
      if (m.has(key)) throw new Error(`duplicate registry entry ${key}`);
      m.set(key, Object.freeze({ ...d }));
    }
    this.byKey = m;
  }

  get(type: string, version: number): EventTypeDef | undefined {
    return this.byKey.get(`${type}@${version}`);
  }

  list(): EventTypeDef[] {
    return [...this.byKey.values()];
  }
}

export const REGISTRY_V1 = new EventRegistry(defs);
