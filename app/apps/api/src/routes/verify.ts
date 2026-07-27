import { Hono } from "hono";
import type { Env } from "../env.js";

const HEX64 = /^[0-9a-fA-F]{64}$/;

export const verifyRoutes = new Hono<{ Bindings: Env }>();

/**
 * Lookup a content hash in the registry (sha256 of marked/registered bytes).
 * Returns NO_RECORD when absent — never invents provenance.
 */
verifyRoutes.get("/verify", async (c) => {
  const hash = (c.req.query("hash") ?? "").trim().toLowerCase();
  if (!HEX64.test(hash)) {
    return c.json(
      { error: "invalid_hash", message: "hash must be 64 hex chars (sha-256)." },
      400,
    );
  }

  const row = await c.env.DB.prepare(
    `SELECT r.id, r.sha256, r.phash64, r.status, r.created_at, r.anchored_at,
            u.display_name AS creator_display
     FROM records r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.sha256 = ? AND r.is_test = 0
     LIMIT 1`,
  )
    .bind(hash)
    .first<{
      id: string;
      sha256: string;
      phash64: number;
      status: string;
      created_at: string;
      anchored_at: string | null;
      creator_display: string | null;
    }>();

  if (!row) {
    return c.json({
      verdict: "NO_RECORD",
      hash,
      record: null,
    });
  }

  const verdict =
    row.status === "anchored"
      ? "EXACT_ANCHORED"
      : row.status === "registered" || row.status === "anchoring"
        ? "EXACT_PENDING"
        : "NO_RECORD";

  return c.json({
    verdict,
    hash,
    record: {
      id: row.id,
      sha256: row.sha256,
      phash64: row.phash64,
      status: row.status,
      createdAt: row.created_at,
      anchoredAt: row.anchored_at,
      creatorDisplay: row.creator_display,
    },
  });
});
