import { hashLeaf, inclusionProofSchema, leafPreimage, toHex, verifyProof } from "@ozdna/dna-core";
import { describe, expect, it } from "vitest";
import { buildBatch, orderRecords } from "../src/batch.js";
import { buildProofDocument, type ChainFacts } from "../src/proof.js";
import { makePending } from "./fakes.js";

const facts = (over: Partial<ChainFacts>): ChainFacts => ({
  batchId: "bat_01JZX9A2AAAAAAAAAAAAAAAAAA",
  chain: "null",
  contract: "0x0000000000000000000000000000000000000000",
  txHash: "0xdeadbeef",
  blockNumber: 0,
  blockTime: "2026-07-27T12:00:00.000Z",
  rootHex: "00",
  leafCount: 1,
  ...over,
});

describe("orderRecords", () => {
  it("sorts by registered_at then id", () => {
    const rs = [
      makePending("rec_c", "2026-07-01T00:00:02.000Z"),
      makePending("rec_a", "2026-07-01T00:00:01.000Z"),
      makePending("rec_b", "2026-07-01T00:00:01.000Z"),
    ];
    expect(orderRecords(rs).map((r) => r.id)).toEqual(["rec_a", "rec_b", "rec_c"]);
  });
});

describe("buildBatch", () => {
  it("assigns leaf indices in canonical order and every proof folds to the root", async () => {
    const rs = [
      makePending("rec_3", "2026-07-01T00:00:03.000Z"),
      makePending("rec_1", "2026-07-01T00:00:01.000Z"),
      makePending("rec_2", "2026-07-01T00:00:02.000Z"),
      makePending("rec_4", "2026-07-01T00:00:04.000Z"),
      makePending("rec_5", "2026-07-01T00:00:05.000Z"), // odd count exercises promotion
    ];
    const built = await buildBatch(rs, "bat_01JZX9A2AAAAAAAAAAAAAAAAAA");

    expect(built.leafCount).toBe(5);
    expect(built.entries.map((e) => e.record.id)).toEqual(["rec_1", "rec_2", "rec_3", "rec_4", "rec_5"]);
    expect(built.entries.map((e) => e.leafIndex)).toEqual([0, 1, 2, 3, 4]);

    for (const e of built.entries) {
      const leafHash = await hashLeaf(leafPreimage(e.record));
      expect(toHex(leafHash)).toBe(e.leafHex); // leaf matches an independent recompute
      expect(await verifyProof(leafHash, e.proof, built.rootHex)).toBe(true); // proof reaches root
    }
  });

  it("single-record batch: root is the lone leaf and the proof is empty", async () => {
    const built = await buildBatch([makePending("rec_solo", "2026-07-01T00:00:00.000Z")], "bat_solo00000000000000000000");
    expect(built.leafCount).toBe(1);
    expect(built.entries[0]!.proof).toEqual([]);
    expect(built.entries[0]!.leafHex).toBe(built.rootHex);
  });

  it("rejects an empty batch", async () => {
    await expect(buildBatch([], "bat_x")).rejects.toThrow(/0 records/);
  });
});

describe("buildProofDocument", () => {
  it("produces a schema-valid ozdna-proof-v1 whose proof still folds to the root", async () => {
    const built = await buildBatch(
      [makePending("rec_1", "2026-07-01T00:00:01.000Z"), makePending("rec_2", "2026-07-01T00:00:02.000Z")],
      "bat_01JZX9A2AAAAAAAAAAAAAAAAAA",
    );
    const entry = built.entries[0]!;
    const doc = buildProofDocument(entry, facts({ rootHex: built.rootHex, leafCount: built.leafCount, blockNumber: 34210991 }));

    // validates against the shared runtime contract
    expect(() => inclusionProofSchema.parse(doc)).not.toThrow();
    expect(doc.version).toBe("ozdna-proof-v1");
    expect(doc.record.id).toBe("rec_1");
    expect(doc.leaf).toBe(entry.leafHex);

    // a skeptic can fold the doc's proof back to its stated root
    const leafHash = await hashLeaf(leafPreimage(entry.record));
    expect(await verifyProof(leafHash, doc.proof, doc.merkle_root)).toBe(true);
  });
});
