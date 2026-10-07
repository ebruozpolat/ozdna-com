// Event validation: canonical-JSON profile → strict envelope → registry → payload.
// Order matters: the canonical pass runs first, so zod never sees getters, prototypes,
// cycles or oversized input.

import type { z } from "zod";
import { CanonicalJsonError, canonicalize, utf8Length } from "./canonical-json.js";
import {
  MAX_EVENT_BYTES,
  MAX_EVENT_DEPTH,
  type StoredEvent,
  storedEventSchema,
  type UnhashedEvent,
  unhashedEventSchema,
} from "./envelope.js";
import { type EventRegistry, type EventTypeDef, REGISTRY_V1 } from "./registry.js";

export type ValidationCode =
  | "NOT_CANONICAL_JSON"
  | "ENVELOPE_INVALID"
  | "UNKNOWN_EVENT_TYPE"
  | "PAYLOAD_INVALID"
  | "PAYLOAD_TOO_LARGE"
  | "FORBIDDEN_KEY"
  | "ARTIFACT_REQUIRED"
  | "ARTIFACT_FORBIDDEN";

export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly path: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly event: T; readonly def: EventTypeDef }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export interface ValidateOptions {
  readonly registry?: EventRegistry;
}

/** Keys that are never legitimate inside a payload (prototype-pollution vectors). */
const FORBIDDEN_PAYLOAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function findForbiddenKey(v: unknown, path: string): string | null {
  if (v === null || typeof v !== "object") return null;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const hit = findForbiddenKey(v[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  for (const k of Object.getOwnPropertyNames(v)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(k)) return `${path}.${k}`;
    const hit = findForbiddenKey((v as Record<string, unknown>)[k], `${path}.${k}`);
    if (hit) return hit;
  }
  return null;
}

function zodIssues(code: ValidationCode, prefix: string, err: z.ZodError): ValidationIssue[] {
  return err.issues.slice(0, 20).map((i) => ({
    code,
    path: [prefix, ...i.path.map(String)].filter(Boolean).join("."),
    message: i.message,
  }));
}

function fail<T>(issues: ValidationIssue[]): ValidationResult<T> {
  return { ok: false, issues };
}

function validateWith<T extends UnhashedEvent>(
  input: unknown,
  schema: z.ZodType<T>,
  opts: ValidateOptions,
): ValidationResult<T> {
  try {
    canonicalize(input, { maxBytes: MAX_EVENT_BYTES, maxDepth: MAX_EVENT_DEPTH });
  } catch (e) {
    if (e instanceof CanonicalJsonError) {
      const code = e.code === "FORBIDDEN_KEY" ? "FORBIDDEN_KEY" : "NOT_CANONICAL_JSON";
      return fail([{ code, path: e.path, message: e.message }]);
    }
    throw e;
  }

  const env = schema.safeParse(input);
  if (!env.success) return fail(zodIssues("ENVELOPE_INVALID", "", env.error));
  const event = env.data;

  const registry = opts.registry ?? REGISTRY_V1;
  const def = registry.get(event.type, event.type_version);
  if (!def) {
    return fail([
      {
        code: "UNKNOWN_EVENT_TYPE",
        path: "type",
        message: `unregistered event type ${event.type}@${event.type_version}`,
      },
    ]);
  }

  const forbidden = findForbiddenKey(event.payload, "payload");
  if (forbidden) {
    return fail([{ code: "FORBIDDEN_KEY", path: forbidden, message: "forbidden key in payload" }]);
  }

  const payloadBytes = utf8Length(canonicalize(event.payload));
  if (payloadBytes > def.maxPayloadBytes) {
    return fail([
      {
        code: "PAYLOAD_TOO_LARGE",
        path: "payload",
        message: `payload is ${payloadBytes} bytes; limit for ${def.type} is ${def.maxPayloadBytes}`,
      },
    ]);
  }

  const payload = def.payload.safeParse(event.payload);
  if (!payload.success) return fail(zodIssues("PAYLOAD_INVALID", "payload", payload.error));

  if (def.artifact === "required" && event.artifact_id === null) {
    return fail([
      { code: "ARTIFACT_REQUIRED", path: "artifact_id", message: `${def.type} needs an artifact` },
    ]);
  }
  if (def.artifact === "forbidden" && event.artifact_id !== null) {
    return fail([
      { code: "ARTIFACT_FORBIDDEN", path: "artifact_id", message: `${def.type} takes no artifact` },
    ]);
  }

  // Return the caller's object, not zod's copy: the hash must be over exactly what was
  // validated, and strict schemas with no transforms guarantee they are equal.
  return { ok: true, event: input as T, def };
}

/** Validate a stored event (with event_hash). Does not check the hash — see provenance-core. */
export function validateStoredEvent(
  input: unknown,
  opts: ValidateOptions = {},
): ValidationResult<StoredEvent> {
  return validateWith(input, storedEventSchema as z.ZodType<StoredEvent>, opts);
}

/** Validate an event before hashing (no event_hash field allowed). */
export function validateUnhashedEvent(
  input: unknown,
  opts: ValidateOptions = {},
): ValidationResult<UnhashedEvent> {
  return validateWith(input, unhashedEventSchema as z.ZodType<UnhashedEvent>, opts);
}
