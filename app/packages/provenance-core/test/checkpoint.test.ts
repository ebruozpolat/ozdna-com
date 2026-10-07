import { CHECKPOINT_SCHEMA, type StoredEvent } from "@ozdna/provenance-schema";
import { describe, expect, it } from "vitest";
import { appendEvent } from "../src/chain.js";
import { buildCheckpoint, verifyAgainstCheckpoint } from "../src/checkpoint.js";
import { checkpointPreimage, computeCheckpointDigest, eventPreimage } from "../src/hash.js";
import { buildChain, clone, draft, fixedDrafts, H } from "./helpers.js";

const ISSUED = "2026-10-07T12:00:00.000Z";

describe("buildCheckpoint", () => {
  it("commits to the head of a valid chain", async () => {
    const chain = await buildChain(fixedDrafts());
    const cp = await buildCheckpoint(chain, ISSUED);
    expect(cp.body).toEqual({
      schema: CHECKPOINT_SCHEMA,
      project_id: chain[0]!.project_id,
      head_seq: 4,
      head_hash: chain[4]!.event_hash,
      event_count: 5,
      issued_at: ISSUED,
    });
    expect(cp.digest).toBe(await computeCheckpointDigest(cp.body));
  });

  it("refuses empty or invalid chains", async () => {
    await expect(buildCheckpoint([], ISSUED)).rejects.toThrow(/empty/);
    const chain = clone(await buildChain(fixedDrafts()));
    (chain[2] as Record<string, any>).payload.locator = "p. 1";
    await expect(buildCheckpoint(chain, ISSUED)).rejects.toThrow(/invalid chain/);
  });

  it("refuses a bad issued_at (no clock fallback)", async () => {
    const chain = await buildChain(fixedDrafts());
    await expect(buildCheckpoint(chain, "now")).rejects.toThrow(/checkpoint body/);
  });

  it("event and checkpoint preimages are domain-separated", async () => {
    const chain = await buildChain(fixedDrafts());
    const cp = await buildCheckpoint(chain, ISSUED);
    const ev = new TextDecoder().decode(eventPreimage(chain[0]!));
    const ck = new TextDecoder().decode(checkpointPreimage(cp.body));
    expect(ev.startsWith("ozdna.provenance.event/v1\n{")).toBe(true);
    expect(ck.startsWith("ozdna.provenance.checkpoint/v1\n{")).toBe(true);
  });
});

describe("verifyAgainstCheckpoint", () => {
  it("accepts the chain it was built from", async () => {
    const chain = await buildChain(fixedDrafts());
    const r = await verifyAgainstCheckpoint(chain, await buildCheckpoint(chain, ISSUED));
    expect(r).toMatchObject({ valid: true, covered_count: 5, unattested_count: 0, code: null });
  });

  it("accepts later valid appends and counts them as unattested", async () => {
    const chain = await buildChain(fixedDrafts());
    const cp = await buildCheckpoint(chain, ISSUED);
    const more = [
      ...chain,
      await appendEvent(chain.at(-1)!, draft("ai.use_declared", { tool: "T", purpose: "code" })),
    ];
    expect(await verifyAgainstCheckpoint(more, cp)).toMatchObject({
      valid: true,
      covered_count: 5,
      unattested_count: 1,
    });
  });

  it("catches a fully re-hashed forged history (which verifyChain alone accepts)", async () => {
    const chain = await buildChain(fixedDrafts());
    const cp = await buildCheckpoint(chain, ISSUED);
    const drafts = fixedDrafts();
    (drafts[3]!.payload as Record<string, unknown>).state = "RETRACTED";
    const forged = await buildChain(drafts);
    const r = await verifyAgainstCheckpoint(forged, cp);
    expect(r).toMatchObject({ valid: false, code: "CHECKPOINT_HEAD_MISMATCH", first_bad_seq: 4 });
    expect(r.chain?.valid).toBe(true);
  });

  it("catches truncation / rollback below the checkpoint", async () => {
    const chain = await buildChain(fixedDrafts());
    const cp = await buildCheckpoint(chain, ISSUED);
    expect(await verifyAgainstCheckpoint(chain.slice(0, 3), cp)).toMatchObject({
      valid: false,
      code: "CHECKPOINT_BEYOND_CHAIN",
      first_bad_seq: 3,
    });
    expect(await verifyAgainstCheckpoint([], cp)).toMatchObject({
      valid: false,
      code: "CHECKPOINT_BEYOND_CHAIN",
      first_bad_seq: 0,
    });
  });

  it("reports in-place tampering with the first bad seq", async () => {
    const chain = clone(await buildChain(fixedDrafts()));
    const cp = await buildCheckpoint(chain, ISSUED);
    (chain[3] as Record<string, any>).payload.confidence_bp = 10000;
    expect(await verifyAgainstCheckpoint(chain, cp)).toMatchObject({
      valid: false,
      code: "CHAIN_INVALID",
      first_bad_seq: 3,
    });
  });

  it("rejects a checkpoint body edited without recomputing the digest", async () => {
    const chain = await buildChain(fixedDrafts());
    const cp = clone(await buildCheckpoint(chain, ISSUED));
    cp.body.issued_at = "2027-01-01T00:00:00.000Z";
    expect(await verifyAgainstCheckpoint(chain, cp)).toMatchObject({
      valid: false,
      code: "CHECKPOINT_DIGEST_MISMATCH",
    });
  });

  it("a recomputed digest over an edited body still fails if it does not match the chain", async () => {
    const chain = await buildChain(fixedDrafts());
    const cp = clone(await buildCheckpoint(chain, ISSUED));
    cp.body.head_hash = H("e");
    cp.digest = await computeCheckpointDigest(cp.body);
    expect(await verifyAgainstCheckpoint(chain, cp)).toMatchObject({
      valid: false,
      code: "CHECKPOINT_HEAD_MISMATCH",
    });
  });

  it("rejects another project's checkpoint", async () => {
    const a = await buildChain(fixedDrafts());
    const b = await buildChain(fixedDrafts("prj_0000000002"));
    const cpB = await buildCheckpoint(b, ISSUED);
    expect(await verifyAgainstCheckpoint(a, cpB)).toMatchObject({
      valid: false,
      code: "CHAIN_INVALID",
      first_bad_seq: 0,
    });
  });

  it("rejects malformed checkpoints", async () => {
    const chain = await buildChain(fixedDrafts());
    const cp = clone(await buildCheckpoint(chain, ISSUED));
    for (const bad of [
      null,
      { ...cp, extra: 1 },
      { ...cp, body: { ...cp.body, event_count: 4 } },
      { ...cp, body: { ...cp.body, schema: "ozdna.provenance.checkpoint/v2" } },
      { ...cp, digest: cp.digest.toUpperCase() },
    ]) {
      expect(await verifyAgainstCheckpoint(chain, bad)).toMatchObject({
        valid: false,
        code: "CHECKPOINT_INVALID",
      });
    }
  });

  it("does not trust event_hash fields when checking the head", async () => {
    // The head check reads events[head_seq].event_hash only after verifyChain has proven
    // every event_hash equals its recomputed content hash.
    const chain = clone(await buildChain(fixedDrafts())) as StoredEvent[];
    const cp = await buildCheckpoint(chain, ISSUED);
    chain[4] = { ...chain[4]!, payload: { tool: "Other", purpose: "editing" } };
    expect(await verifyAgainstCheckpoint(chain, cp)).toMatchObject({
      valid: false,
      code: "CHAIN_INVALID",
      first_bad_seq: 4,
    });
  });
});
