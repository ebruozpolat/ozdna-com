// Chain-agnostic anchoring boundary — plan/01-ARCHITECTURE.md §6.
// This package holds ONLY the interface + NullAdapter (pure, no chain SDK). BaseAdapter
// (viem) deliberately does NOT live here: §6 rule 1 requires that nothing outside
// apps/anchor imports viem or any chain SDK, and other packages import from here.

import { concatBytes, sha256, toHex, utf8 } from "@ozdna/dna-core";

/** Interfaces verbatim from plan/01 §6. */
export interface AnchorBackend {
  readonly chainId: string; // 'base-mainnet', 'base-sepolia', 'null', later 'filecoin-fvm', …
  /** Commit a 32-byte Merkle root. MUST be idempotent per (root, batchId). */
  anchor(root: Uint8Array, batchId: string): Promise<AnchorReceipt>;
  /** Independently confirm a receipt against the public chain. */
  verify(receipt: AnchorReceipt, root: Uint8Array): Promise<AnchorStatus>;
  /** Deep link a human can click to see the proof on a public explorer. */
  explorerUrl(receipt: AnchorReceipt): string;
}

export interface AnchorReceipt {
  chainId: string;
  txid: string;
  blockTime?: number; // unix seconds, set once confirmed
  raw?: Record<string, unknown>;
}

export type AnchorStatus = "pending" | "confirmed" | "reorged" | "not_found";

/**
 * Dev/test adapter: no chain, no SDK. Deterministic fake receipts — the `txid` is
 * SHA-256(root ‖ "|" ‖ batchId), so `anchor` is idempotent per (root, batchId) and two
 * different roots never collide. Lets the whole anchor flow (build Merkle root → anchor →
 * verify) run offline (plan/09 §7 item 4). `now` is injectable for deterministic tests.
 */
export class NullAdapter implements AnchorBackend {
  readonly chainId = "null";
  private readonly store = new Map<string, AnchorReceipt>();
  private readonly now: () => number;

  constructor(opts?: { now?: () => number }) {
    this.now = opts?.now ?? (() => Math.floor(Date.now() / 1000));
  }

  private async txidFor(root: Uint8Array, batchId: string): Promise<string> {
    return `0x${toHex(await sha256(concatBytes(root, utf8(`|${batchId}`))))}`;
  }

  async anchor(root: Uint8Array, batchId: string): Promise<AnchorReceipt> {
    if (root.length !== 32) throw new Error("root must be a 32-byte Merkle root");
    const txid = await this.txidFor(root, batchId);
    const existing = this.store.get(txid);
    if (existing) return existing; // idempotent per (root, batchId)
    const receipt: AnchorReceipt = {
      chainId: this.chainId,
      txid,
      blockTime: this.now(),
      raw: { adapter: "null", batchId, rootHex: toHex(root) },
    };
    this.store.set(txid, receipt);
    return receipt;
  }

  async verify(receipt: AnchorReceipt, root: Uint8Array): Promise<AnchorStatus> {
    const stored = this.store.get(receipt.txid);
    if (!stored) return "not_found";
    return stored.raw?.rootHex === toHex(root) ? "confirmed" : "reorged";
  }

  explorerUrl(receipt: AnchorReceipt): string {
    return `null://local/tx/${receipt.txid}`;
  }
}
