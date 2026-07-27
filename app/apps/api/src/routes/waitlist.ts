// POST /v1/waitlist (plan/04-MVP-SPEC.md §4.2 + §10, Story 5). Public, Turnstile-guarded at
// the edge (index.ts verifies the token BEFORE calling this pure handler). Idempotent on
// email — a repeat signup is a 200 with deduplicated:true, never a duplicate row or an error.

import { z } from "zod";
import { badRequest } from "../errors.js";
import type { RouteDeps, RouteResult } from "../http.js";
import type { Repo } from "../repo/types.js";

// Segment vocabulary is the D1 CHECK constraint (04 §5 waitlist.segment) — keep in lockstep.
export const WAITLIST_SEGMENTS = ["ai_company", "seller_creator", "fact_checker", "other"] as const;

const waitlistSchema = z.object({
  email: z.email().max(254),
  segment: z.enum(WAITLIST_SEGMENTS),
  source: z.string().max(200).optional(),
  locale: z.string().max(16).optional(),
  // KVKK/GDPR: explicit affirmative consent is required to store the email (05 L1/T5).
  consent: z.literal(true),
});

function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  if (!i) return "invalid request body";
  const path = i.path.join(".");
  return path ? `${path}: ${i.message}` : i.message;
}

export async function handleWaitlist(rawBody: unknown, repo: Repo, deps: RouteDeps): Promise<RouteResult> {
  const parsed = waitlistSchema.safeParse(rawBody);
  if (!parsed.success) throw badRequest("missing_field", firstIssue(parsed.error));
  const d = parsed.data;

  const { created } = await repo.insertWaitlist({
    email: d.email.toLowerCase(), // case-insensitive identity (D1 email is COLLATE NOCASE)
    segment: d.segment,
    source: d.source ?? null,
    locale: d.locale ?? null,
    consentAt: deps.now(),
    confirmToken: deps.newToken(),
  });

  return {
    status: created ? 201 : 200,
    body: { status: "ok", segment: d.segment, deduplicated: !created },
  };
}
