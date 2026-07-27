// Anchor cron Worker entry. No fetch handler — only scheduled(). Wires the D1 repo + the
// selected AnchorBackend into the pure cycle. Cadence is set by the cron trigger in wrangler.toml
// (plan/03 §3.4: records anchored within 24h, paid within 1h).

import { type AnchorBackend, NullAdapter } from "@ozdna/anchor-backends";
import { type CycleDeps, runAnchorCycle } from "./cycle.js";
import type { Env } from "./env.js";
import { D1AnchorRepo } from "./repo-d1.js";

const MAX_BATCH = 4096;

/** Sortable, schema-valid batch id: `bat_<base36 time><random hex>` (matches prefixedId). */
function newBatchId(): string {
  const t = Date.now().toString(36);
  const rand = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `bat_${t}${rand}`;
}

function selectBackend(env: Env): AnchorBackend {
  if (!env.CHAIN || env.CHAIN === "null") return new NullAdapter();
  // Refuse to silently fake real anchoring: the viem BaseAdapter is not built yet (plan/01 §6
  // keeps the chain SDK confined to this app). Set CHAIN=null for dev until it lands.
  throw new Error(`no AnchorBackend for CHAIN='${env.CHAIN}' — viem BaseAdapter not implemented yet`);
}

export default {
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const repo = new D1AnchorRepo(env.DB);
    const backend = selectBackend(env);
    const deps: CycleDeps = {
      newBatchId,
      nowIso: () => new Date().toISOString(),
      contract: env.ANCHOR_CONTRACT,
      maxBatch: MAX_BATCH,
    };
    const result = await runAnchorCycle(repo, backend, deps);
    console.log(`[anchor] ${JSON.stringify(result)}`);
  },
} satisfies ExportedHandler<Env>;
