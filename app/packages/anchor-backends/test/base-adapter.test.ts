import { encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { BaseAdapter } from "../src/base-adapter.js";
import { ozDnaAnchorAbi } from "../src/ozdna-anchor-abi.js";

const FAKE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const FAKE_CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

describe("BaseAdapter", () => {
  it("stores config and builds explorer URLs", () => {
    const adapter = new BaseAdapter({
      chainId: "base-sepolia",
      rpcUrl: "https://sepolia.base.org",
      contractAddress: FAKE_CONTRACT,
      operatorPrivateKey: FAKE_KEY,
    });
    expect(adapter.chainId).toBe("base-sepolia");
    expect(adapter.getConfig().rpcUrl).toBe("https://sepolia.base.org");
    expect(adapter.explorerUrl({ chainId: "base-sepolia", txid: "0xabc" })).toBe(
      "https://sepolia.basescan.org/tx/0xabc",
    );
    expect(
      new BaseAdapter({
        chainId: "base-mainnet",
        rpcUrl: "https://mainnet.base.org",
        contractAddress: FAKE_CONTRACT,
        operatorPrivateKey: FAKE_KEY,
      }).explorerUrl({ chainId: "base-mainnet", txid: "0xdef" }),
    ).toBe("https://basescan.org/tx/0xdef");
  });

  it("rejects missing private key shape", () => {
    expect(
      () =>
        new BaseAdapter({
          chainId: "base-sepolia",
          rpcUrl: "https://sepolia.base.org",
          contractAddress: FAKE_CONTRACT,
          operatorPrivateKey: "" as `0x${string}`,
        }),
    ).toThrow(/operatorPrivateKey/);
  });

  it("rejects non-32-byte roots on encode / anchor prep", () => {
    const adapter = new BaseAdapter({
      chainId: "base-sepolia",
      rpcUrl: "https://sepolia.base.org",
      contractAddress: FAKE_CONTRACT,
      operatorPrivateKey: FAKE_KEY,
    });
    expect(() => adapter.encodeAnchorCalldata(new Uint8Array(16), 3)).toThrow(/32 bytes/);
  });

  it("ABI-encodes OzDnaAnchor.anchor(bytes32,uint64) correctly", () => {
    const root = new Uint8Array(32).fill(0xab);
    const adapter = new BaseAdapter({
      chainId: "base-sepolia",
      rpcUrl: "https://sepolia.base.org",
      contractAddress: FAKE_CONTRACT,
      operatorPrivateKey: FAKE_KEY,
    });
    const encoded = adapter.encodeAnchorCalldata(root, 42);
    const expected = encodeFunctionData({
      abi: ozDnaAnchorAbi,
      functionName: "anchor",
      args: [`0x${[...root].map((b) => b.toString(16).padStart(2, "0")).join("")}`, 42n],
    });
    expect(encoded).toBe(expected);
    // 4-byte selector + two 32-byte ABI words
    expect(encoded.startsWith("0x")).toBe(true);
    expect((encoded.length - 2) / 2).toBe(4 + 32 + 32);
  });
});
