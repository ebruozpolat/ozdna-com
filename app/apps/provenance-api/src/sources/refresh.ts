// Refresh job: a cron finds stale sources and enqueues them; the queue consumer re-verifies
// each one, per-provider rate limited and idempotent (a message for a source that is no longer
// stale is acknowledged without contacting any provider). Status changes are fanned out to
// every citing project. Failed refreshes are recorded as results but never change a status.

import { parseCanonical } from "@ozdna/provenance-schema";
import type { CitedReference } from "@ozdna/source-verification";
import type { Env, RefreshMessage } from "../env.js";
import { d1Stores } from "../repo/d1.js";
import { d1SourceStore } from "../repo/sources.js";
import { type Deps, fanOutStatusChange, intEnv, runVerification } from "./service.js";

export const REFRESH_SCAN_LIMIT = 500;
const PROVIDERS = ["doi_ra", "crossref", "datacite"] as const;

/** Cron: enqueue every stale source. Returns how many were enqueued. */
export async function enqueueStale(env: Env, nowIso: string): Promise<number> {
  const queue = env.REFRESH_QUEUE;
  if (!queue) return 0;
  const stale = await d1SourceStore(env.PROV_DB).stale(nowIso, REFRESH_SCAN_LIMIT);
  for (let i = 0; i < stale.length; i += 100) {
    await queue.sendBatch(
      stale.slice(i, i + 100).map((s) => ({
        body: { tenant_id: s.tenant_id, source_id: s.source_id } satisfies RefreshMessage,
      })),
    );
  }
  return stale.length;
}

export type RefreshOutcome = "refreshed" | "not_stale" | "missing" | "rate_limited";

/** Process one message. Exported for tests; the queue handler calls it per message. */
export async function refreshOne(
  env: Env,
  msg: RefreshMessage,
  now: () => string,
): Promise<RefreshOutcome> {
  const stores = d1Stores(env.PROV_DB);
  const sources = d1SourceStore(env.PROV_DB);
  const limit = intEnv(env.PROVIDER_RATE_PER_MINUTE, 30, 1, 10_000);
  const sinceMs = Date.parse(now()) - 60_000;
  for (const p of PROVIDERS) {
    if ((await sources.providerCallsSince(p, sinceMs)) >= limit) return "rate_limited";
  }
  const source = await sources.get(msg.tenant_id, msg.source_id);
  if (!source) return "missing";
  // Idempotency: staleness is re-checked here, so duplicate or late messages are no-ops.
  // Failed attempts do not count as fresh, so a source that keeps failing stays due.
  const last = await sources.lastAnsweredAt(msg.tenant_id, source.id);
  if (last && Date.parse(last) + source.refresh_after_seconds * 1000 > Date.parse(now())) {
    return "not_stale";
  }
  const ref = parseCanonical(source.reference_canonical) as unknown as CitedReference;
  const deps: Deps = { env, stores, sources, now };
  const run = await runVerification(deps, msg.tenant_id, source, ref, "refresh");
  await fanOutStatusChange(deps, msg.tenant_id, source.id, run, "refresh");
  return "refreshed";
}

export async function handleRefreshBatch(
  batch: MessageBatch<RefreshMessage>,
  env: Env,
  now: () => string = () => new Date().toISOString(),
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const outcome = await refreshOne(env, msg.body, now);
      if (outcome === "rate_limited") msg.retry({ delaySeconds: 60 });
      else msg.ack();
    } catch {
      msg.retry({ delaySeconds: 300 });
    }
  }
}
