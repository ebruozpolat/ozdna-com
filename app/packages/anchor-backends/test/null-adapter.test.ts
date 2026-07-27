import { describe, expect, it } from "vitest";
import { NullAdapter } from "../src/null-adapter.js";

describe("NullAdapter", () => {
  const adapter = new NullAdapter();
  const root = new Uint8Array(32).fill(0xab);

  it("anchors a 32-byte root with a fake receipt", async () => {
    const receipt = await adapter.anchor(root, "bat_01TEST");
    expect(receipt.chainId).toBe("null");
    expect(receipt.txid.startsWith("null_bat_01TEST_")).toBe(true);
    expect(receipt.raw?.fake).toBe(true);
    expect(await adapter.verify(receipt, root)).toBe("confirmed");
  });

  it("rejects non-32-byte roots", async () => {
    await expect(adapter.anchor(new Uint8Array(16), "bat_x")).rejects.toThrow(/32 bytes/);
  });

  it("explorerUrl is a null:// debug link", async () => {
    const receipt = await adapter.anchor(root, "bat_01");
    expect(adapter.explorerUrl(receipt)).toMatch(/^null:\/\/anchor\//);
  });
});
