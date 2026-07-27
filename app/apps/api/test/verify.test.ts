import { describe, expect, it } from "vitest";
import { handleVerifyByHash, handleVerifyByPhash, type VerifyUrls } from "../src/routes/verify.js";
import { FakeRepo, makeRecord } from "./fakes.js";

const urls: VerifyUrls = { siteBase: "https://ozdna.com", apiBase: "https://api.ozdna.com" };
const SHA = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

// deep-index into the response body without fighting the `unknown` type in tests
const b = (r: { body: unknown }) => r.body as any;

describe("GET /v1/verify?hash=", () => {
  it("rejects a malformed hash", async () => {
    await expect(handleVerifyByHash("xyz", new FakeRepo(), urls)).rejects.toMatchObject({
      status: 400,
      code: "invalid_hash_format",
    });
  });

  it("NO_RECORD when nothing matches", async () => {
    const res = await handleVerifyByHash(SHA, new FakeRepo(), urls);
    expect(b(res).match.verdict).toBe("NO_RECORD");
    expect(b(res).match.match_type).toBe("none");
    expect(b(res).match.records).toEqual([]);
    expect(b(res).anchor).toBeUndefined();
  });

  it("EXACT_PENDING for a registered-but-unanchored record", async () => {
    const repo = new FakeRepo();
    repo.records.push(makeRecord({ id: "rec_1", sha256: SHA, phash64: 0n }));
    const res = await handleVerifyByHash(SHA, repo, urls);
    expect(b(res).match.verdict).toBe("EXACT_PENDING");
    expect(b(res).match.hamming_distance).toBe(0);
    expect(b(res).match.records[0].record_url).toBe("https://ozdna.com/r/rec_1");
    expect(b(res).anchor).toBeUndefined();
  });

  it("EXACT_ANCHORED + anchor block when the batch is confirmed", async () => {
    const repo = new FakeRepo();
    repo.records.push(makeRecord({ id: "rec_2", sha256: SHA, phash64: 0n, anchorBatchId: "bat_1" }));
    repo.anchors.set("bat_1", {
      batchId: "bat_1",
      status: "confirmed",
      chain: "base-mainnet",
      txHash: "0x8c1f",
      blockNumber: 31502884,
      confirmedAt: "2026-10-21T18:00:41Z",
    });
    const res = await handleVerifyByHash(SHA, repo, urls);
    expect(b(res).match.verdict).toBe("EXACT_ANCHORED");
    expect(b(res).anchor.status).toBe("confirmed");
    expect(b(res).anchor.proof_url).toBe("https://api.ozdna.com/v1/anchors/bat_1/proof/rec_2");
  });
});

describe("GET /v1/verify?phash=", () => {
  it("rejects a malformed phash", async () => {
    await expect(handleVerifyByPhash("nothex", undefined, new FakeRepo(), urls)).rejects.toMatchObject({
      status: 400,
      code: "invalid_hash_format",
    });
  });

  it("VISUAL_MATCH_HIGH at distance 0 (shows as a match even without PDQ)", async () => {
    const repo = new FakeRepo();
    repo.records.push(makeRecord({ id: "rec_h", sha256: SHA, phash64: 0n }));
    const res = await handleVerifyByPhash("0000000000000000", undefined, repo, urls);
    expect(b(res).match.verdict).toBe("VISUAL_MATCH_HIGH");
    expect(b(res).match.hamming_distance).toBe(0);
    expect(b(res).match.show_as_match).toBe(true);
    expect(b(res).match.pdq_confirmed).toBeNull();
  });

  it("VISUAL_MATCH_PROBABLE at distance 7 is 'similar, unconfirmed' without a PDQ", async () => {
    const repo = new FakeRepo();
    repo.records.push(makeRecord({ id: "rec_p", sha256: SHA, phash64: 0xfen })); // 0xFE = 7 set bits
    const res = await handleVerifyByPhash("0000000000000000", undefined, repo, urls);
    expect(b(res).match.hamming_distance).toBe(7);
    expect(b(res).match.verdict).toBe("VISUAL_MATCH_PROBABLE");
    expect(b(res).match.show_as_match).toBe(false); // §1.5: PROBABLE needs a passing PDQ
  });

  it("NO_RECORD when the closest candidate is beyond max_distance", async () => {
    const repo = new FakeRepo();
    repo.records.push(makeRecord({ id: "rec_far", sha256: SHA, phash64: 0x7ffn })); // 11 set bits > 7
    const res = await handleVerifyByPhash("0000000000000000", undefined, repo, urls);
    expect(b(res).match.verdict).toBe("NO_RECORD");
    expect(b(res).match.records).toEqual([]);
  });

  it("clamps max_distance to the outer ceiling of 10", async () => {
    const repo = new FakeRepo();
    repo.records.push(makeRecord({ id: "rec_far", sha256: SHA, phash64: 0x7ffn })); // 11 bits
    const res = await handleVerifyByPhash("0000000000000000", 99, repo, urls);
    // 11 > 10 ceiling → still no match, and the echoed query caps at 10
    expect(b(res).query.max_distance).toBe(10);
    expect(b(res).match.verdict).toBe("NO_RECORD");
  });

  it("ranks multiple candidates by ascending distance (best first, ≤5)", async () => {
    const repo = new FakeRepo();
    repo.records.push(makeRecord({ id: "rec_d6", sha256: SHA, phash64: 0x3fn })); // 6 bits
    repo.records.push(makeRecord({ id: "rec_d1", sha256: SHA, phash64: 0x1n })); // 1 bit
    const res = await handleVerifyByPhash("0000000000000000", undefined, repo, urls);
    expect(b(res).match.hamming_distance).toBe(1);
    expect(b(res).match.records[0].id).toBe("rec_d1");
    expect(b(res).match.records[1].id).toBe("rec_d6");
    expect(b(res).match.verdict).toBe("VISUAL_MATCH_HIGH");
  });
});
