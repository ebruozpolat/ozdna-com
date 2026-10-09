// Frozen test vectors (test/fixtures/chain-v1.json) + an independent re-implementation.
// If a vector changes, the hash format changed: that needs a schema version bump and an
// ADR, never a fixture refresh. Regenerate only with scripts/gen-vectors.mts
// when deliberately introducing a new version.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifyChain } from "../src/chain.js";
import { verifyAgainstCheckpoint } from "../src/checkpoint.js";
import { computeCheckpointDigest, computeEventHash } from "../src/hash.js";
import { buildChain, fixedDrafts } from "./helpers.js";

const vectors = JSON.parse(
  readFileSync(new URL("./fixtures/chain-v1.json", import.meta.url), "utf8"),
) as {
  events: Array<Record<string, unknown> & { event_hash: string }>;
  checkpoint: { body: Record<string, unknown>; digest: string };
  genesis_preimage: string;
};

/**
 * A deliberately separate, minimal implementation — node:crypto + JSON.stringify with
 * sorted keys. Valid for the vectors (ASCII/NFC strings, safe integers), which is what a
 * third-party verifier in another language would write first.
 */
function independentCjson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(independentCjson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${independentCjson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

function independentEventHash(ev: Record<string, unknown>): string {
  const { event_hash: _h, ...rest } = ev;
  return createHash("sha256")
    .update(`ozdna.provenance.event/v1\n${independentCjson(rest)}`, "utf8")
    .digest("hex");
}

describe("frozen vectors chain-v1.json", () => {
  it("the fixture chain and checkpoint verify", async () => {
    expect((await verifyChain(vectors.events)).valid).toBe(true);
    expect((await verifyAgainstCheckpoint(vectors.events, vectors.checkpoint)).valid).toBe(true);
  });

  it("today's code reproduces every frozen hash from the same drafts", async () => {
    const chain = await buildChain(fixedDrafts());
    expect(chain.map((e) => e.event_hash)).toEqual(vectors.events.map((e) => e.event_hash));
    expect(chain).toEqual(vectors.events);
  });

  it("genesis preimage is byte-exact", () => {
    const { event_hash: _h, ...rest } = vectors.events[0]!;
    expect(`ozdna.provenance.event/v1\n${independentCjson(rest)}`).toBe(vectors.genesis_preimage);
  });

  it("an independent implementation computes the same event hashes", async () => {
    for (const ev of vectors.events) {
      expect(independentEventHash(ev)).toBe(ev.event_hash);
      expect(await computeEventHash(ev as never)).toBe(ev.event_hash);
    }
  });

  it("an independent implementation computes the same checkpoint digest", async () => {
    const digest = createHash("sha256")
      .update(
        `ozdna.provenance.checkpoint/v1\n${independentCjson(vectors.checkpoint.body)}`,
        "utf8",
      )
      .digest("hex");
    expect(digest).toBe(vectors.checkpoint.digest);
    expect(await computeCheckpointDigest(vectors.checkpoint.body as never)).toBe(
      vectors.checkpoint.digest,
    );
  });
});
