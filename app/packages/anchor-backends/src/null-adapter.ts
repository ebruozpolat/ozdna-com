// NullAdapter — dev/test: no chain, fake receipts. plan/01 §6 rule 3.

import type { AnchorBackend, AnchorReceipt, AnchorStatus } from "./types.js";

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class NullAdapter implements AnchorBackend {
  readonly chainId = "null";

  async anchor(root: Uint8Array, batchId: string): Promise<AnchorReceipt> {
    if (root.byteLength !== 32) {
      throw new RangeError(`NullAdapter.anchor: root must be 32 bytes, got ${root.byteLength}`);
    }
    const rootHex = toHex(root);
    const txid = `null_${batchId}_${rootHex.slice(0, 16)}`;
    return {
      chainId: this.chainId,
      txid,
      blockTime: Math.floor(Date.now() / 1000),
      raw: { fake: true, batchId, merkleRoot: `0x${rootHex}` },
    };
  }

  async verify(receipt: AnchorReceipt, root: Uint8Array): Promise<AnchorStatus> {
    if (receipt.chainId !== this.chainId) return "not_found";
    if (root.byteLength !== 32) return "not_found";
    const expected = `0x${toHex(root)}`;
    const got = receipt.raw?.merkleRoot;
    if (got === expected && typeof receipt.txid === "string" && receipt.txid.startsWith("null_")) {
      return "confirmed";
    }
    return "not_found";
  }

  explorerUrl(receipt: AnchorReceipt): string {
    // No public explorer for the null chain — local debug surface only.
    return `null://anchor/${receipt.txid}`;
  }
}
