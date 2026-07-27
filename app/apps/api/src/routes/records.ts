import { hashToHex, toHex, toUnsignedU64 } from "@ozdna/dna-core";
import { Hono } from "hono";
import type { Env } from "../env.js";

export const recordRoutes = new Hono<{ Bindings: Env }>();

recordRoutes.get("/records/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT r.id, r.kind, r.sha256, r.phash64, r.pdq256, r.status, r.created_at, r.anchored_at,
            r.title, r.file_mime, r.anchor_batch_id, u.display_name AS creator_display
     FROM records r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.id = ? AND r.is_test = 0
     LIMIT 1`,
  )
    .bind(id)
    .first<{
      id: string;
      kind: string;
      sha256: string;
      phash64: number;
      pdq256: ArrayBuffer | null;
      status: string;
      created_at: string;
      anchored_at: string | null;
      title: string | null;
      file_mime: string;
      anchor_batch_id: string | null;
      creator_display: string | null;
    }>();

  if (!row) return c.json({ error: "not_found" }, 404);

  const pdq =
    row.pdq256 && new Uint8Array(row.pdq256).byteLength === 32
      ? toHex(new Uint8Array(row.pdq256))
      : null;

  return c.json({
    id: row.id,
    kind: row.kind,
    sha256: row.sha256,
    phash64: row.phash64,
    phash: hashToHex(toUnsignedU64(BigInt(row.phash64))),
    pdq256: pdq,
    status: row.status,
    created_at: row.created_at,
    anchored_at: row.anchored_at,
    title: row.title,
    file_mime: row.file_mime,
    anchor_batch_id: row.anchor_batch_id,
    creator_display: row.creator_display,
  });
});

recordRoutes.get("/anchors/:batchId/proof/:recordId", async (c) => {
  const batchId = c.req.param("batchId");
  const recordId = c.req.param("recordId");
  const rec = await c.env.DB.prepare(
    `SELECT id, leaf_index, anchor_batch_id, sha256 FROM records WHERE id = ? LIMIT 1`,
  )
    .bind(recordId)
    .first<{
      id: string;
      leaf_index: number | null;
      anchor_batch_id: string | null;
      sha256: string;
    }>();

  const batch = await c.env.DB.prepare(
    `SELECT id, merkle_root, status, tx_hash, chain FROM anchor_batches WHERE id = ? LIMIT 1`,
  )
    .bind(batchId)
    .first<{
      id: string;
      merkle_root: string | null;
      status: string;
      tx_hash: string | null;
      chain: string;
    }>();

  if (!rec || !batch || rec.anchor_batch_id !== batchId) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json({
    record_id: rec.id,
    batch_id: batch.id,
    leaf_index: rec.leaf_index,
    merkle_root: batch.merkle_root,
    chain: batch.chain,
    tx_hash: batch.tx_hash,
    status: batch.status,
    // Full sibling proof array lands when batch builder persists proofs (apps/anchor).
    proof: [],
    note: "leaf_index + merkle_root available; sibling proof array filled when anchor job persists proofs",
  });
});
