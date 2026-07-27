import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env.js";

const Body = z.object({
  email: z.string().email().max(320),
  segment: z.enum(["ai_company", "seller_creator", "fact_checker", "other"]),
  locale: z.enum(["en", "tr"]).optional(),
  source: z.string().max(500).optional(),
  /** Explicit marketing consent (KVKK/GDPR). Must be true. */
  consent: z.literal(true),
});

export const waitlistRoutes = new Hono<{ Bindings: Env }>();

waitlistRoutes.post("/waitlist", async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
  }
  const { email, segment, locale, source } = parsed.data;
  const consentAt = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      `INSERT INTO waitlist (email, segment, source, locale, consent_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(email.toLowerCase(), segment, source ?? null, locale ?? null, consentAt)
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE|unique/i.test(msg)) {
      return c.json({ ok: true, status: "already_registered" }, 200);
    }
    console.error("waitlist insert failed", msg);
    return c.json({ error: "db_error" }, 500);
  }

  return c.json({ ok: true, status: "registered" }, 201);
});
