import { buildTree, hashLeaf, leafPreimage, utf8 } from "@ozdna/dna-core";
import { describe, expect, it } from "vitest";
import { type AnchorBackend, NullAdapter } from "../src/index.js";

async function sampleRoot(): Promise<Uint8Array> {
  const records = [
    { id: "rec_A", sha256Hex: "a".repeat(64), phash64Hex: "0123456789abcdef", accountId: "usr_A", registeredAt: "2026-10-01T00:00:00.000Z" },
    { id: "rec_B", sha256Hex: "b".repeat(64), phash64Hex: "fedcba9876543210", accountId: "usr_B", registeredAt: "2026-10-01T00:00:01.000Z" },
  ];
  const tree = await buildTree(await Promise.all(records.map((r) => hashLeaf(leafPreimage(r)))));
  return tree.root;
}

describe("NullAdapter (plan/01 §6)", () => {
  it("satisfies the AnchorBackend interface shape", () => {
    const a: AnchorBackend = new NullAdapter();
    expect(a.chainId).toBe("null");
    expect(typeof a.anchor).toBe("function");
    expect(typeof a.verify).toBe("function");
    expect(typeof a.explorerUrl).toBe("function");
  });

  it("anchors a real dna-core Merkle root and verifies as confirmed", async () => {
    const adapter = new NullAdapter({ now: () => 1_800_000_000 });
    const root = await sampleRoot();
    const receipt = await adapter.anchor(root, "bat_01");
    expect(receipt.chainId).toBe("null");
    expect(receipt.txid).toMatch(/^0x[0-9a-f]{64}$/);
    expect(receipt.blockTime).toBe(1_800_000_000);
    expect(await adapter.verify(receipt, root)).toBe("confirmed");
    expect(adapter.explorerUrl(receipt)).toContain(receipt.txid);
  });

  it("is idempotent per (root, batchId) — same receipt on repeat", async () => {
    const adapter = new NullAdapter({ now: () => 42 });
    const root = await sampleRoot();
    const r1 = await adapter.anchor(root, "bat_01");
    const r2 = await adapter.anchor(root, "bat_01");
    expect(r2).toEqual(r1);
    // different batchId → different txid
    const r3 = await adapter.anchor(root, "bat_02");
    expect(r3.txid).not.toBe(r1.txid);
  });

  it("reports not_found for an unknown receipt and reorged for a root mismatch", async () => {
    const adapter = new NullAdapter();
    const root = await sampleRoot();
    const receipt = await adapter.anchor(root, "bat_01");
    const other = new Uint8Array(32).fill(9);
    expect(await adapter.verify(receipt, other)).toBe("reorged");
    expect(await adapter.verify({ chainId: "null", txid: "0xdead" }, root)).toBe("not_found");
  });

  it("rejects a non-32-byte root", async () => {
    const adapter = new NullAdapter();
    await expect(adapter.anchor(utf8("short"), "bat_01")).rejects.toThrow();
  });
});
