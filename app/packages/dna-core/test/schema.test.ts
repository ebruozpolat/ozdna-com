import { describe, expect, it } from "vitest";
import { inclusionProofSchema, leafRecordSchema, verdictSchema } from "../src/schema.js";

const goodRecord = {
  id: "rec_01JZX3E8LKWY2P4QD9T7RM5HBF",
  sha256Hex: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  phash64Hex: "c4a2b1d8e0f39a57",
  accountId: "usr_01JZX0",
  registeredAt: "2026-10-14T09:31:02.417Z",
};

describe("leafRecordSchema", () => {
  it("accepts a valid record (pdq/manifest optional)", () => {
    expect(leafRecordSchema.safeParse(goodRecord).success).toBe(true);
    expect(leafRecordSchema.safeParse({ ...goodRecord, pdq256Hex: null }).success).toBe(true);
  });
  it("rejects a bad sha256 (wrong length) and non-ms timestamp", () => {
    expect(leafRecordSchema.safeParse({ ...goodRecord, sha256Hex: "abc" }).success).toBe(false);
    expect(leafRecordSchema.safeParse({ ...goodRecord, registeredAt: "2026-10-14T09:31:02Z" }).success).toBe(false);
  });
  it("rejects an unprefixed id and 15-hex phash", () => {
    expect(leafRecordSchema.safeParse({ ...goodRecord, id: "01JZX3" }).success).toBe(false);
    expect(leafRecordSchema.safeParse({ ...goodRecord, phash64Hex: "c4a2b1d8e0f39a5" }).success).toBe(false);
  });
});

describe("inclusionProofSchema", () => {
  const proof = {
    version: "ozdna-proof-v1",
    record: {
      id: "rec_01JZX3",
      sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      phash64: "c4a2b1d8e0f39a57",
      account_id: "usr_01JZX0",
      registered_at: "2026-10-21T14:03:22.113Z",
    },
    batch_id: "bat_01JZX9",
    chain: "base-mainnet",
    contract: "0xabc",
    tx_hash: "0x8c1f",
    block_number: 34210991,
    block_time: "2026-10-21T18:00:41Z",
    merkle_root: "0x5d2e",
    leaf: "3e77000000000000000000000000000000000000000000000000000000008b12",
    leaf_index: 1042,
    leaf_count: 4096,
    proof: [{ pos: "right", hash: "9b3c000000000000000000000000000000000000000000000000000000000000" }],
    hash_algorithm: "sha256",
    leaf_construction: "per plan/03-ALGORITHMS.md §3.2",
    verify_instructions_url: "https://ozdna.com/docs/verify-an-anchor",
  };
  it("accepts a well-formed ozdna-proof-v1", () => {
    expect(inclusionProofSchema.safeParse(proof).success).toBe(true);
  });
  it("rejects a wrong version literal and a bad proof step pos", () => {
    expect(inclusionProofSchema.safeParse({ ...proof, version: "v2" }).success).toBe(false);
    expect(
      inclusionProofSchema.safeParse({ ...proof, proof: [{ pos: "up", hash: proof.leaf }] }).success,
    ).toBe(false);
  });
});

describe("verdictSchema", () => {
  it("accepts a locked verdict and rejects an invented one", () => {
    expect(verdictSchema.safeParse("VISUAL_MATCH_HIGH").success).toBe(true);
    expect(verdictSchema.safeParse("TOTALLY_LEGIT").success).toBe(false);
  });
});
