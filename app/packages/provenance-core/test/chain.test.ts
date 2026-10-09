import { GENESIS_PREV_HASH, type StoredEvent } from "@ozdna/provenance-schema";
import { describe, expect, it } from "vitest";
import { appendEvent, ProvenanceAppendError, verifyChain } from "../src/chain.js";
import { computeEventHash } from "../src/hash.js";
import { buildChain, clone, draft, fixedDrafts, H } from "./helpers.js";

async function rehash(ev: Record<string, unknown>): Promise<StoredEvent> {
  const e = ev as unknown as StoredEvent;
  return { ...e, event_hash: await computeEventHash(e) };
}

describe("appendEvent", () => {
  it("builds a linked chain from seq 0", async () => {
    const chain = await buildChain(fixedDrafts());
    expect(chain.map((e) => e.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(chain[0]!.prev_hash).toBe(GENESIS_PREV_HASH);
    for (let i = 1; i < chain.length; i++)
      expect(chain[i]!.prev_hash).toBe(chain[i - 1]!.event_hash);
    expect(chain[0]!.schema).toBe("ozdna.provenance.event/v1");
  });

  it("is deterministic: same drafts → same hashes", async () => {
    const a = await buildChain(fixedDrafts());
    const b = await buildChain(fixedDrafts());
    expect(a.map((e) => e.event_hash)).toEqual(b.map((e) => e.event_hash));
  });

  it("NFC-normalises draft strings so composed and decomposed input hash the same", async () => {
    const [genesis] = await buildChain(fixedDrafts().slice(0, 1));
    const mk = (label: string) =>
      draft(
        "artifact.registered",
        { kind: "figure", content_sha256: H("a"), byte_length: 1, media_type: "image/png", label },
        {
          event_id: "evt_nfc0000001",
          occurred_at: "2026-10-07T11:00:00.000Z",
          recorded_at: "2026-10-07T11:00:00.000Z",
        },
      );
    const composed = await appendEvent(genesis!, mk("caf\u00e9"));
    const decomposed = await appendEvent(genesis!, mk("cafe\u0301"));
    expect(decomposed.payload.label).toBe("caf\u00e9");
    expect(decomposed.event_hash).toBe(composed.event_hash);
  });

  it("clamps recorded_at so it never goes backwards", async () => {
    const [genesis] = await buildChain(fixedDrafts().slice(0, 1));
    const ev = await appendEvent(
      genesis!,
      draft(
        "ai.use_declared",
        { tool: "T", purpose: "other" },
        { recorded_at: "2000-01-01T00:00:00.000Z" },
      ),
    );
    expect(ev.recorded_at).toBe(genesis!.recorded_at);
  });

  it("does not let the clamp turn a malformed recorded_at into a valid one", async () => {
    // "0" sorts before every ISO timestamp, so a naive string clamp would replace it with
    // prev.recorded_at and accept the event. It must be rejected instead.
    const [genesis] = await buildChain(fixedDrafts().slice(0, 1));
    for (const recorded_at of ["0", "", "2000-01-01"]) {
      const d = draft("ai.use_declared", { tool: "T", purpose: "other" }, { recorded_at });
      await expect(appendEvent(genesis!, d)).rejects.toMatchObject({ code: "DRAFT_INVALID" });
    }
  });

  it("ignores caller-supplied seq/prev_hash/schema in the draft", async () => {
    const [genesis] = await buildChain(fixedDrafts().slice(0, 1));
    const d = {
      ...draft("ai.use_declared", { tool: "T", purpose: "other" }),
      seq: 99,
      prev_hash: H("f"),
    };
    const ev = await appendEvent(genesis!, d);
    expect(ev.seq).toBe(1);
    expect(ev.prev_hash).toBe(genesis!.event_hash);
  });

  it("rejects a draft that carries event_hash or unknown keys", async () => {
    const [genesis] = await buildChain(fixedDrafts().slice(0, 1));
    for (const extra of [{ event_hash: H("1") }, { note: "x" }]) {
      const d = { ...draft("ai.use_declared", { tool: "T", purpose: "other" }), ...extra };
      await expect(appendEvent(genesis!, d)).rejects.toMatchObject({ code: "DRAFT_INVALID" });
    }
  });

  it("requires project.created first, and only first", async () => {
    await expect(
      appendEvent(null, draft("ai.use_declared", { tool: "T", purpose: "other" })),
    ).rejects.toMatchObject({
      code: "GENESIS_TYPE",
    });
    const [genesis] = await buildChain(fixedDrafts().slice(0, 1));
    await expect(
      appendEvent(genesis!, draft("project.created", { external_ref: "again" })),
    ).rejects.toMatchObject({ code: "GENESIS_REPEATED" });
  });

  it("refuses to extend from another project's head", async () => {
    const [genesis] = await buildChain(fixedDrafts().slice(0, 1));
    const d = draft(
      "ai.use_declared",
      { tool: "T", purpose: "other" },
      { project_id: "prj_0000000002" },
    );
    await expect(appendEvent(genesis!, d)).rejects.toMatchObject({ code: "PROJECT_MISMATCH" });
  });

  it("refuses to extend a corrupted head", async () => {
    const [genesis] = await buildChain(fixedDrafts().slice(0, 1));
    const corrupted = { ...genesis!, payload: { external_ref: "tampered" } };
    const err = await appendEvent(
      corrupted,
      draft("ai.use_declared", { tool: "T", purpose: "other" }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProvenanceAppendError);
    expect((err as ProvenanceAppendError).code).toBe("HASH_MISMATCH");
  });

  it("surfaces registry issues for an invalid payload", async () => {
    const [genesis] = await buildChain(fixedDrafts().slice(0, 1));
    const err = (await appendEvent(
      genesis!,
      draft("ai.use_declared", { tool: "T", purpose: "vibes" }),
    ).catch((e: unknown) => e)) as ProvenanceAppendError;
    expect(err.code).toBe("DRAFT_INVALID");
    expect(err.issues[0]!.code).toBe("PAYLOAD_INVALID");
  });
});

describe("verifyChain — valid input", () => {
  it("accepts a well-formed chain and reports the head", async () => {
    const chain = await buildChain(fixedDrafts());
    const r = await verifyChain(chain);
    expect(r).toMatchObject({
      valid: true,
      verified_count: 5,
      head_seq: 4,
      first_bad_seq: null,
      error: null,
    });
    expect(r.head_hash).toBe(chain[4]!.event_hash);
  });

  it("accepts an empty chain with no head", async () => {
    expect(await verifyChain([])).toMatchObject({
      valid: true,
      verified_count: 0,
      head_seq: null,
      head_hash: null,
    });
  });

  it("is insensitive to key order in the stored objects (canonical hashing)", async () => {
    const chain = await buildChain(fixedDrafts());
    const reordered = chain.map((e) => Object.fromEntries(Object.entries(clone(e)).reverse()));
    expect((await verifyChain(reordered)).valid).toBe(true);
  });

  it("verifies a mid-chain slice given a trusted prev hash", async () => {
    const chain = await buildChain(fixedDrafts());
    const r = await verifyChain(chain.slice(2), {
      start: { seq: 2, prevHash: chain[1]!.event_hash },
    });
    expect(r).toMatchObject({ valid: true, head_seq: 4 });
    const wrong = await verifyChain(chain.slice(2), { start: { seq: 2, prevHash: H("1") } });
    expect(wrong).toMatchObject({
      valid: false,
      first_bad_seq: 2,
      error: { code: "PREV_HASH_MISMATCH" },
    });
  });
});

describe("verifyChain — tampering is detected at the right seq", () => {
  const cases: Array<[string, (e: Record<string, any>) => void]> = [
    ["payload value", (e) => (e.payload.label = "Draft v2")],
    ["occurred_at", (e) => (e.occurred_at = "2026-10-07T09:00:00.000Z")],
    ["actor id", (e) => (e.actor.id = "someone-else")],
    ["artifact_id", (e) => (e.artifact_id = "art_0000000009")],
    ["event_id", (e) => (e.event_id = "evt_ffffffffff")],
  ];

  it.each(cases)("edit of %s without rehash → HASH_MISMATCH at that seq", async (_name, mutate) => {
    const chain = clone(await buildChain(fixedDrafts()));
    mutate(chain[1] as Record<string, any>);
    const r = await verifyChain(chain);
    expect(r).toMatchObject({
      valid: false,
      first_bad_seq: 1,
      verified_count: 1,
      error: { code: "HASH_MISMATCH" },
    });
  });

  it("edit + rehash of one event → PREV_HASH_MISMATCH at the next seq", async () => {
    const chain = clone(await buildChain(fixedDrafts()));
    const e = chain[2] as Record<string, any>;
    e.payload.identifier.value = "10.9999/forged";
    chain[2] = await rehash(e);
    const r = await verifyChain(chain);
    expect(r).toMatchObject({
      valid: false,
      first_bad_seq: 3,
      error: { code: "PREV_HASH_MISMATCH" },
    });
  });

  it("deleting an event → SEQ_MISMATCH where the gap is", async () => {
    const chain = await buildChain(fixedDrafts());
    const r = await verifyChain([...chain.slice(0, 2), ...chain.slice(3)]);
    expect(r).toMatchObject({ valid: false, first_bad_seq: 2, error: { code: "SEQ_MISMATCH" } });
  });

  it("swapping two events → detected at the first swapped position", async () => {
    const chain = await buildChain(fixedDrafts());
    const r = await verifyChain([chain[0], chain[2], chain[1], chain[3], chain[4]]);
    expect(r).toMatchObject({ valid: false, first_bad_seq: 1 });
  });

  it("replaying an event → SEQ_MISMATCH", async () => {
    const chain = await buildChain(fixedDrafts());
    const r = await verifyChain([...chain, chain[4]]);
    expect(r).toMatchObject({ valid: false, first_bad_seq: 5, error: { code: "SEQ_MISMATCH" } });
  });

  it("forging an inserted event (renumbering + rehashing the whole suffix) passes verifyChain — only a checkpoint catches it", async () => {
    // Documents the limit of verifyChain: integrity, not authenticity. See checkpoint.test.ts.
    const chain = await buildChain(fixedDrafts());
    const forged: StoredEvent[] = [chain[0]!];
    const drafts = fixedDrafts();
    const extra = draft(
      "ai.use_declared",
      { tool: "Forged", purpose: "other" },
      {
        recorded_at: drafts[0]!.recorded_at,
      },
    );
    for (const d of [extra, ...drafts.slice(1)]) forged.push(await appendEvent(forged.at(-1)!, d));
    expect((await verifyChain(forged)).valid).toBe(true);
    expect(forged.at(-1)!.event_hash).not.toBe(chain.at(-1)!.event_hash);
  });

  it("splicing an event from another project → PROJECT_MISMATCH", async () => {
    const a = await buildChain(fixedDrafts());
    const b = await buildChain(fixedDrafts("prj_0000000002"));
    const r = await verifyChain([a[0], a[1], b[2]]);
    expect(r).toMatchObject({
      valid: false,
      first_bad_seq: 2,
      error: { code: "PROJECT_MISMATCH" },
    });
    expect(await verifyChain(a, { projectId: "prj_0000000002" })).toMatchObject({
      valid: false,
      first_bad_seq: 0,
      error: { code: "PROJECT_MISMATCH" },
    });
  });

  it("an extra field on a stored event → EVENT_INVALID (not silently ignored)", async () => {
    const chain = clone(await buildChain(fixedDrafts()));
    (chain[3] as Record<string, unknown>).note = "harmless?";
    expect(await verifyChain(chain)).toMatchObject({
      valid: false,
      first_bad_seq: 3,
      error: { code: "EVENT_INVALID" },
    });
  });

  it("a re-hashed event of an unregistered type → EVENT_INVALID", async () => {
    const chain = clone(await buildChain(fixedDrafts()));
    const e = chain[4] as Record<string, any>;
    e.type = "ai.use_hidden";
    chain[4] = await rehash(e);
    expect(await verifyChain(chain)).toMatchObject({
      valid: false,
      first_bad_seq: 4,
      error: { code: "EVENT_INVALID" },
    });
  });

  it("a non-NFC string in a stored event → EVENT_INVALID (verifiers never normalise)", async () => {
    const chain = clone(await buildChain(fixedDrafts()));
    (chain[1] as Record<string, any>).payload.label = "cafe\u0301";
    expect(await verifyChain(chain)).toMatchObject({
      valid: false,
      first_bad_seq: 1,
      error: { code: "EVENT_INVALID" },
    });
  });

  it("duplicate event_id (with a valid hash chain) → DUPLICATE_EVENT_ID", async () => {
    const chain = await buildChain(fixedDrafts());
    const dup = await appendEvent(
      chain.at(-1)!,
      draft(
        "ai.use_declared",
        { tool: "T", purpose: "other" },
        {
          event_id: chain[1]!.event_id,
        },
      ),
    );
    expect(await verifyChain([...chain, dup])).toMatchObject({
      valid: false,
      first_bad_seq: 5,
      error: { code: "DUPLICATE_EVENT_ID" },
    });
  });

  it("recorded_at going backwards (hand-built) → RECORDED_AT_REGRESSION", async () => {
    const chain = await buildChain(fixedDrafts());
    const back = clone(chain[1]!) as Record<string, any>;
    back.recorded_at = "2026-10-07T09:59:59.000Z";
    const forged = await rehash(back);
    expect(await verifyChain([chain[0], forged])).toMatchObject({
      valid: false,
      first_bad_seq: 1,
      error: { code: "RECORDED_AT_REGRESSION" },
    });
  });

  it("a second project.created (hand-built) → GENESIS_REPEATED", async () => {
    const chain = await buildChain(fixedDrafts());
    const g = clone(chain[0]!) as Record<string, any>;
    Object.assign(g, { seq: 1, prev_hash: chain[0]!.event_hash, event_id: "evt_genesis002" });
    expect(await verifyChain([chain[0], await rehash(g)])).toMatchObject({
      valid: false,
      error: { code: "GENESIS_REPEATED" },
    });
  });

  it("a chain whose seq 0 is not project.created → GENESIS_TYPE", async () => {
    const chain = await buildChain(fixedDrafts());
    const e = clone(chain[4]!) as Record<string, any>;
    Object.assign(e, { seq: 0, prev_hash: GENESIS_PREV_HASH });
    expect(await verifyChain([await rehash(e)])).toMatchObject({
      valid: false,
      first_bad_seq: 0,
      error: { code: "GENESIS_TYPE" },
    });
  });
});

describe("verifyChain — input limits", () => {
  it("rejects non-arrays", async () => {
    expect(await verifyChain({ length: 0 } as unknown as unknown[])).toMatchObject({
      valid: false,
      error: { code: "NOT_AN_ARRAY" },
    });
  });

  it("caps the number of events", async () => {
    const chain = await buildChain(fixedDrafts());
    expect(await verifyChain(chain, { maxEvents: 3 })).toMatchObject({
      valid: false,
      error: { code: "TOO_MANY_EVENTS" },
    });
  });

  it("garbage elements fail validation instead of throwing", async () => {
    const chain = await buildChain(fixedDrafts());
    for (const junk of [null, 42, "evt", [], { event_hash: H("0") }]) {
      expect(await verifyChain([chain[0], junk])).toMatchObject({
        valid: false,
        first_bad_seq: 1,
        error: { code: "EVENT_INVALID" },
      });
    }
  });
});
