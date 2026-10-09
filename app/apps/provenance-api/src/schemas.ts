// Request/response schemas. These are the single source for validation AND the generated
// OpenAPI document (openapi.ts). Event payloads are validated again, authoritatively, by the
// provenance-schema registry inside appendEvent.

import { ACTOR_KINDS, IDENTIFIER_SCHEMES, storedEventSchema } from "@ozdna/provenance-schema";
import { z } from "zod";
import { SCOPES } from "./auth.js";

/** Named schemas that become OpenAPI components (see openapi.ts). */
export const schemaRegistry = z.registry<{ id: string }>();

/** Max request body, bytes. Events themselves are capped at 64 KiB by the core. */
export const MAX_BODY_BYTES = 128 * 1024;

export const errorSchema = z.object({
  error: z.string(),
  code: z.string(),
  message: z.string(),
  issues: z.array(z.object({ code: z.string(), path: z.string(), message: z.string() })).optional(),
});

/** Who did it, as asserted by the calling platform. asserted_by is added by the server. */
export const actorInputSchema = z
  .object({ kind: z.enum(ACTOR_KINDS), id: z.string().min(1).max(128) })
  .strict();

const occurredAt = z.string().max(32).describe("ISO-8601 UTC with ms, asserted by the platform");

export const createTenantSchema = z
  .object({
    name: z.string().min(1).max(128),
    scopes: z.array(z.enum(SCOPES)).min(1).max(SCOPES.length).optional(),
  })
  .strict();

export const createProjectSchema = z
  .object({
    external_ref: z.string().min(1).max(128),
    occurred_at: occurredAt,
    actor: actorInputSchema,
  })
  .strict();

export const createArtifactSchema = z
  .object({
    kind: z.string().max(32),
    content_sha256: z.string().max(64),
    byte_length: z.number().int(),
    media_type: z.string().max(127),
    label: z.string().max(200).nullable(),
    occurred_at: occurredAt,
    actor: actorInputSchema,
  })
  .strict();

export const appendEventSchema = z
  .object({
    type: z.string().max(130),
    type_version: z.number().int(),
    artifact_id: z.string().max(80).nullable(),
    payload: z.record(z.string(), z.unknown()),
    occurred_at: occurredAt,
    actor: actorInputSchema,
  })
  .strict();

// ---- Phase 4c: sources

export const identifierInputSchema = z
  .object({ scheme: z.enum(IDENTIFIER_SCHEMES), value: z.string().min(1).max(512) })
  .strict();

export const verifySourceSchema = z
  .object({
    project_id: z.string().max(80),
    citation_id: z
      .string()
      .regex(/^cit_[0-9A-Za-z]{8,64}$/)
      .describe("The project's citation id (as used in source.cited)"),
    reference: z.union([
      z.object({ identifier: identifierInputSchema }).strict(),
      z
        .object({ csl: z.record(z.string(), z.unknown()) })
        .strict()
        .describe(
          "One CSL-JSON item; DOI > PMID > PMCID > ISBN > ISSN > URL is used as the identifier",
        ),
    ]),
    occurred_at: occurredAt,
    actor: actorInputSchema,
  })
  .strict();

export const verificationOutcomeSchema = z.object({
  result_id: z.string().nullable(),
  state: z.string(),
  confidence_bp: z.number().int(),
  components: z.record(z.string(), z.number().int()),
  provider: z.string().nullable(),
  reason: z.string().nullable(),
  failure_reason: z.string().nullable(),
  candidates: z.array(identifierInputSchema),
  snapshot_sha256: z.string().nullable(),
  verifier_version: z.string(),
});

export const sourceSchema = z.object({
  id: z.string(),
  scheme: z.string(),
  value: z.string(),
  refresh_after_seconds: z.number().int(),
  created_at: z.string(),
});

export const verifySourceResultSchema = z.object({
  source: sourceSchema.nullable(),
  verification: verificationOutcomeSchema,
  events: z.array(storedEventSchema),
});

export const projectSchema = z.object({
  id: z.string(),
  external_ref: z.string(),
  created_at: z.string(),
});

export const eventSchema = storedEventSchema;

export const appendResultSchema = z.object({ event: eventSchema, idempotent_replay: z.boolean() });

export const verifyResultSchema = z.object({
  project_id: z.string(),
  valid: z.boolean(),
  event_count: z.number().int(),
  verified_count: z.number().int(),
  head_seq: z.number().int().nullable(),
  head_hash: z.string().nullable(),
  first_bad_seq: z.number().int().nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
  signature_checked: z.literal(false).describe("Signed checkpoints arrive in Phase 3"),
});

schemaRegistry.add(errorSchema, { id: "Error" });
schemaRegistry.add(actorInputSchema, { id: "ActorInput" });
schemaRegistry.add(createTenantSchema, { id: "CreateTenant" });
schemaRegistry.add(createProjectSchema, { id: "CreateProject" });
schemaRegistry.add(createArtifactSchema, { id: "CreateArtifact" });
schemaRegistry.add(appendEventSchema, { id: "AppendEvent" });
schemaRegistry.add(projectSchema, { id: "Project" });
schemaRegistry.add(eventSchema, { id: "StoredEvent" });
schemaRegistry.add(appendResultSchema, { id: "AppendResult" });
schemaRegistry.add(verifyResultSchema, { id: "VerifyResult" });
schemaRegistry.add(verifySourceSchema, { id: "VerifySource" });
schemaRegistry.add(verificationOutcomeSchema, { id: "VerificationOutcome" });
schemaRegistry.add(sourceSchema, { id: "Source" });
schemaRegistry.add(verifySourceResultSchema, { id: "VerifySourceResult" });
