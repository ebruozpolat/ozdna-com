// Anchor cron Worker — batches pending records, Merkle-roots, submits via adapter.
// Spec: plan/04-MVP-SPEC.md §6, plan/03 §3. Uses NullAdapter until Base keys are set.

import { NullAdapter } from "@ozdna/anchor-backends";
import {
  buildTree,
  hashLeaf,
  hashToHex,
  leafPreimage,
  toHex,
  toUnsignedU64,
} from "@ozdna/dna-core";
import type { Env } from "./env.js";

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await runAnchorBatch(env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "ozdna-anchor",
        backend: env.ANCHOR_BACKEND ?? "null",
      });
    }
    if (url.pathname === "/run" && request.method === "POST") {
      if (env.ENVIRONMENT === "production") {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      const result = await runAnchorBatch(env);
      return Response.json(result);
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  },
};

async function runAnchorBatch(env: Env): Promise<{
  ok: boolean;
  picked: number;
  batchId: string | null;
  root: string | null;
  txid: string | null;
  skipped?: string;
}> {
  const rows = await env.DB.prepare(
    `SELECT id, user_id, sha256, phash64, created_at
     FROM records
     WHERE status = 'registered' AND is_test = 0
     ORDER BY created_at ASC
     LIMIT 256`,
  ).all<{
    id: string;
    user_id: string | null;
    sha256: string;
    phash64: number;
    created_at: string;
  }>();

  const records = rows.results ?? [];
  if (records.length === 0) {
    return { ok: true, picked: 0, batchId: null, root: null, txid: null, skipped: "empty" };
  }

  const leafHashes = await Promise.all(
    records.map(async (r) => {
      const phashHex = hashToHex(toUnsignedU64(BigInt(r.phash64)));
      return hashLeaf(
        leafPreimage({
          id: r.id,
          sha256Hex: r.sha256,
          phash64Hex: phashHex,
          accountId: r.user_id ?? "",
          registeredAt: r.created_at,
        }),
      );
    }),
  );

  const tree = await buildTree(leafHashes);
  const rootHex = `0x${toHex(tree.root)}`;
  const batchId = `bat_local_${Date.now().toString(36)}`;

  await env.DB.prepare(
    `INSERT INTO anchor_batches (id, chain, merkle_root, record_count, status)
     VALUES (?, 'base-mainnet', ?, ?, 'pending')`,
  )
    .bind(batchId, rootHex, records.length)
    .run();

  if (env.ANCHOR_BACKEND === "base") {
    return {
      ok: false,
      picked: records.length,
      batchId,
      root: rootHex,
      txid: null,
      skipped: "base_backend_not_configured",
    };
  }

  const adapter = new NullAdapter();
  const receipt = await adapter.anchor(tree.root, batchId);

  await env.DB.prepare(
    `UPDATE anchor_batches SET status = ?, tx_hash = ? WHERE id = ?`,
  )
    .bind("submitted", receipt.txid, batchId)
    .run();

  for (let i = 0; i < records.length; i++) {
    await env.DB.prepare(
      `UPDATE records SET status = 'anchoring', anchor_batch_id = ?, leaf_index = ? WHERE id = ?`,
    )
      .bind(batchId, i, records[i]!.id)
      .run();
  }

  return {
    ok: true,
    picked: records.length,
    batchId,
    root: rootHex,
    txid: receipt.txid,
  };
}
