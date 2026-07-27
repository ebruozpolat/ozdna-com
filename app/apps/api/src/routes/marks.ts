import { bandsFromHex, sha256, toHex, toSignedI64 } from "@ozdna/dna-core";
import { Hono } from "hono";
import { z } from "zod";
import { requireApiKey, ulidish } from "../auth.js";
import type { Env } from "../env.js";

/**
 * Registry-only marks (plan/04 Sept spike fallback).
 * Does NOT embed C2PA yet — registers sha256+phash as AI-generated api_mark.
 * Full embed/sign needs Workers Paid + September spike.
 */
export const markRoutes = new Hono<{ Bindings: Env }>();

markRoutes.use("*", requireApiKey);

const JsonBody = z.object({
  sha256: z.string().regex(/^[0-9a-fA-F]{64}$/),
  phash: z.string().regex(/^[0-9a-fA-F]{16}$/),
  file_mime: z.enum(["image/jpeg", "image/png"]),
  file_bytes: z.number().int().positive().optional(),
  title: z.string().max(120).optional(),
  /** Reserved for future C2PA softwareAgent — ignored in registry-only mode. */
  generator: z.string().max(100).optional(),
  is_test: z.boolean().optional(),
});

async function insertMark(
  db: D1Database,
  opts: {
    userId: string;
    apiKeyId: string;
    sha: string;
    ph: string;
    fileMime: string;
    fileBytes: number | null;
    title: string | null;
    isTest: boolean;
  },
): Promise<{ id: string; deduplicated: boolean; created_at: string }> {
  if (!opts.isTest) {
    const existing = await db
      .prepare(`SELECT id, created_at FROM records WHERE sha256 = ? AND is_test = 0 LIMIT 1`)
      .bind(opts.sha)
      .first<{ id: string; created_at: string }>();
    if (existing) {
      return { id: existing.id, deduplicated: true, created_at: existing.created_at };
    }
  }

  const id = ulidish("rec");
  const bands = bandsFromHex(opts.ph);
  const phashSigned = Number(toSignedI64(BigInt(`0x${opts.ph}`)));
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO records (
         id, user_id, kind, source, sha256, phash64, pdq256,
         band0, band1, band2, band3, title, file_mime, file_bytes, status, is_test
       ) VALUES (?, ?, 'ai_generated', 'api_mark', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'registered', ?)`,
    )
    .bind(
      id,
      opts.userId,
      opts.sha,
      phashSigned,
      bands.band0,
      bands.band1,
      bands.band2,
      bands.band3,
      opts.title,
      opts.fileMime,
      opts.fileBytes,
      opts.isTest ? 1 : 0,
    )
    .run();

  const month = createdAt.slice(0, 7);
  await db
    .prepare(
      `INSERT INTO usage_events (user_id, api_key_id, event_type, record_id, billable, month)
       VALUES (?, ?, 'mark', ?, ?, ?)`,
    )
    .bind(opts.userId, opts.apiKeyId, id, opts.isTest ? 0 : 1, month)
    .run();

  return { id, deduplicated: false, created_at: createdAt };
}

markRoutes.post("/marks", async (c) => {
  const auth = c.get("auth");
  const ct = c.req.header("Content-Type") ?? "";

  // Multipart: file + phash (caller-supplied until server decode lands)
  if (ct.includes("multipart/form-data")) {
    const form = await c.req.parseBody({ all: true });
    const file = form.file;
    const phashRaw = typeof form.phash === "string" ? form.phash : "";
    const title = typeof form.title === "string" ? form.title.slice(0, 120) : null;
    const isTest = form.is_test === "1" || form.is_test === "true" || auth.mode === "test";

    if (!(file instanceof File)) {
      return c.json({ error: "validation_error", message: "multipart field `file` required" }, 400);
    }
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      return c.json({ error: "unsupported_media_type", message: "JPG/PNG only" }, 415);
    }
    if (file.size > 20 * 1024 * 1024) {
      return c.json({ error: "file_too_large", message: "Max 20MB" }, 413);
    }
    if (!/^[0-9a-fA-F]{16}$/.test(phashRaw)) {
      return c.json(
        {
          error: "validation_error",
          message:
            "Form field `phash` (16 hex) required for registry-only marks until server-side decode ships.",
        },
        400,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha = toHex(await sha256(bytes));
    const result = await insertMark(c.env.DB, {
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      sha,
      ph: phashRaw.toLowerCase(),
      fileMime: file.type,
      fileBytes: file.size,
      title,
      isTest,
    });

    return c.json(
      {
        mode: "registry_only",
        embed: false,
        note: "No C2PA bytes embedded yet — record + fingerprint only (Sept spike).",
        record: {
          id: result.id,
          kind: "ai_generated",
          status: "registered",
          sha256: sha,
          phash: phashRaw.toLowerCase(),
          created_at: result.created_at,
          url: `https://ozdna.com/r/${result.id}`,
        },
        deduplicated: result.deduplicated,
      },
      result.deduplicated ? 200 : 201,
    );
  }

  // JSON path (hashes precomputed by client)
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = JsonBody.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
  }

  const sha = parsed.data.sha256.toLowerCase();
  const ph = parsed.data.phash.toLowerCase();
  const isTest = parsed.data.is_test === true || auth.mode === "test";
  const result = await insertMark(c.env.DB, {
    userId: auth.userId,
    apiKeyId: auth.apiKeyId,
    sha,
    ph,
    fileMime: parsed.data.file_mime,
    fileBytes: parsed.data.file_bytes ?? null,
    title: parsed.data.title ?? null,
    isTest,
  });

  return c.json(
    {
      mode: "registry_only",
      embed: false,
      note: "No C2PA bytes embedded yet — record + fingerprint only (Sept spike).",
      record: {
        id: result.id,
        kind: "ai_generated",
        status: "registered",
        sha256: sha,
        phash: ph,
        created_at: result.created_at,
        url: `https://ozdna.com/r/${result.id}`,
      },
      deduplicated: result.deduplicated,
    },
    result.deduplicated ? 200 : 201,
  );
});
