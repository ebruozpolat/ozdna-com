import { type AnchorBackend, NullAdapter } from "@ozdna/anchor-backends";
import { describe, expect, it } from "vitest";
import { runAnchorCycle, type CycleDeps } from "../src/cycle.js";
import { FakeAnchorRepo, makePending } from "./fakes.js";

const deps: CycleDeps = {
  newBatchId: () => "bat_01JZX9A2AAAAAAAAAAAAAAAAAA",
  nowIso: () => "2026-07-27T12:00:00.000Z",
  contract: "0x0000000000000000000000000000000000000000",
  maxBatch: 4096,
};

describe("runAnchorCycle", () => {
  it("is idle when there is nothing pending", async () => {
    const repo = new FakeAnchorRepo();
    const res = await runAnchorCycle(repo, new NullAdapter({ now: () => 1_800_000_000 }), deps);
    expect(res).toEqual({ batched: 0, status: "idle" });
    expect(repo.calls).toEqual(["getPendingRecords"]);
  });

  it("batches, submits, verifies and finalizes pending records (NullAdapter confirms synchronously)", async () => {
    const repo = new FakeAnchorRepo();
    repo.pending = [
      makePending("rec_2", "2026-07-01T00:00:02.000Z"),
      makePending("rec_1", "2026-07-01T00:00:01.000Z"),
    ];
    const res = await runAnchorCycle(repo, new NullAdapter({ now: () => 1_800_000_000 }), deps);

    expect(res.status).toBe("confirmed");
    expect(res.batched).toBe(2);
    expect(res.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(repo.calls).toEqual([
      "getPendingRecords",
      "createBatch",
      "assignRecordsToBatch",
      "markBatchSubmitted",
      "finalizeBatchConfirmed",
    ]);
    // leaf indices assigned in canonical (registered_at) order
    expect(repo.assignments).toEqual([
      { recordId: "rec_1", leafIndex: 0 },
      { recordId: "rec_2", leafIndex: 1 },
    ]);
    expect(repo.batch?.status).toBe("confirmed");
    expect(repo.batch?.confirmedAt).toBe("2026-07-27T12:00:00.000Z");
  });

  it("marks the batch failed if the backend anchor throws", async () => {
    const repo = new FakeAnchorRepo();
    repo.pending = [makePending("rec_1", "2026-07-01T00:00:01.000Z")];
    const throwing: AnchorBackend = {
      chainId: "null",
      anchor: async () => {
        throw new Error("rpc down");
      },
      verify: async () => "not_found",
      explorerUrl: () => "null://x",
    };
    const res = await runAnchorCycle(repo, throwing, deps);
    expect(res.status).toBe("failed");
    expect(repo.calls).toContain("markBatchFailed");
    expect(repo.calls).not.toContain("markBatchSubmitted");
  });
});
