// Anchor cron Worker — batches pending records, Merkle-roots, submits via adapter.
// Spec: plan/04-MVP-SPEC.md §6, plan/03 §3.
// Uses BaseAdapter when ANCHOR_BACKEND=base and Secrets are present; else NullAdapter.

import { type AnchorBackend, BaseAdapter, NullAdapter } from "@ozdna/anchor-backends";
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

function resolveAdapter(env: Env): { adapter: AnchorBackend | null; chainId: string; skipped?: string } {
  if (env.ANCHOR_BACKEND === "base") {
    const rpcUrl = env.BASE_RPC_URL;
    const privateKey = env.ANCHOR_PRIVATE_KEY;
    const contractAddress = env.ANCHOR_CONTRACT_ADDRESS;
    const chainId =
      rpcUrl?.includes("sepolia") || env.ENVIRONMENT !== "production"
        ? "base-sepolia"
        : "base-mainnet";
    if (!rpcUrl || !privateKey?.startsWith("0x") || !contractAddress?.startsWith("0x")) {
      return {
        adapter: null,
        chainId,
        skipped: "base_backend_missing_secrets",
      };
    }
    return {
      adapter: new BaseAdapter({
        chainId,
        rpcUrl,
        contractAddress: contractAddress as `0x${string}`,
        operatorPrivateKey: privateKey as `0x${string}`,
      }),
      chainId,
    };
  }
  if (env.ENVIRONMENT === "production") {
    return {
      adapter: null,
      chainId: "null",
      skipped: "production_anchor_backend_disabled",
    };
  }
  return { adapter: new NullAdapter(), chainId: "null" };
}

export async function runAnchorBatch(env: Env): Promise<{
  ok: boolean;
  picked: number;
  batchId: string | null;
  root: string | null;
  txid: string | null;
  skipped?: string;
}> {
  const rows = await env.DB.prepare(
    `SELECT id, user_id, sha256, phash64, pdq256, created_at
     FROM records
     WHERE status = 'registered' AND is_test = 0
     ORDER BY created_at ASC
     LIMIT 256`,
  ).all<{
    id: string;
    user_id: string | null;
    sha256: string;
    phash64: number;
    pdq256: ArrayBuffer | null;
    created_at: string;
  }>();

  const records = rows.results ?? [];
  if (records.length === 0) {
    return { ok: true, picked: 0, batchId: null, root: null, txid: null, skipped: "empty" };
  }

  const { adapter, chainId, skipped } = resolveAdapter(env);
  if (!adapter) {
    return {
      ok: false,
      picked: records.length,
      batchId: null,
      root: null,
      txid: null,
      skipped,
    };
  }

  const leafHashes = await Promise.all(
    records.map(async (r) => {
      const phashHex = hashToHex(toUnsignedU64(BigInt(r.phash64)));
      const pdqHex =
        r.pdq256 && new Uint8Array(r.pdq256).byteLength === 32
          ? toHex(new Uint8Array(r.pdq256))
          : null;
      return hashLeaf(
        leafPreimage({
          id: r.id,
          sha256Hex: r.sha256,
          phash64Hex: phashHex,
          pdq256Hex: pdqHex,
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
     VALUES (?, ?, ?, ?, 'pending')`,
  )
    .bind(batchId, chainId, rootHex, records.length)
    .run();

  const receipt = await adapter.anchor(tree.root, batchId, records.length);

  await env.DB.prepare(`UPDATE anchor_batches SET status = ?, tx_hash = ? WHERE id = ?`)
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
