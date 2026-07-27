import { bandsFromHex, fromHex, toSignedI64 } from "@ozdna/dna-core";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env.js";

const HEX64 = /^[0-9a-fA-F]{64}$/;
const HEX16 = /^[0-9a-fA-F]{16}$/;

function ulidish(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export const registrationRoutes = new Hono<{ Bindings: Env }>();

const Body = z.object({
  sha256: z.string().regex(HEX64),
  phash: z.string().regex(HEX16),
  kind: z.enum(["ai_generated", "claimed_capture", "unspecified"]),
  file_mime: z.enum(["image/jpeg", "image/png"]),
  file_bytes: z.number().int().positive().optional(),
  title: z.string().max(120).optional(),
  pdq256: z.string().regex(HEX64).optional(),
  is_test: z.boolean().optional(),
});

registrationRoutes.post("/registrations", async (c) => {
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
  const { sha256, phash, kind, file_mime, file_bytes, title, pdq256, is_test } = parsed.data;
  const sha = sha256.toLowerCase();
  const ph = phash.toLowerCase();
  const bands = bandsFromHex(ph);
  const phashSigned = Number(toSignedI64(BigInt(`0x${ph}`)));

  const existing = await c.env.DB.prepare(
    `SELECT id, sha256, status, created_at FROM records WHERE sha256 = ? AND is_test = 0 LIMIT 1`,
  )
    .bind(sha)
    .first<{ id: string; sha256: string; status: string; created_at: string }>();

  if (existing && !is_test) {
    return c.json({
      record: {
        id: existing.id,
        sha256: existing.sha256,
        status: existing.status,
        created_at: existing.created_at,
      },
      deduplicated: true,
    });
  }

  const id = ulidish("rec");
  const pdqBlob = pdq256 ? fromHex(pdq256.toLowerCase()) : null;

  await c.env.DB.prepare(
    `INSERT INTO records (
       id, kind, source, sha256, phash64, pdq256,
       band0, band1, band2, band3, title, file_mime, file_bytes, status, is_test
     ) VALUES (?, ?, 'web_sign', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered', ?)`,
  )
    .bind(
      id,
      kind,
      sha,
      phashSigned,
      pdqBlob && pdqBlob.byteLength === 32 ? pdqBlob : null,
      bands.band0,
      bands.band1,
      bands.band2,
      bands.band3,
      title ?? null,
      file_mime,
      file_bytes ?? null,
      is_test ? 1 : 0,
    )
    .run();

  return c.json(
    {
      record: {
        id,
        kind,
        status: "registered",
        sha256: sha,
        phash: ph,
        created_at: new Date().toISOString(),
      },
      deduplicated: false,
    },
    201,
  );
});
