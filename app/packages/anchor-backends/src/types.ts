// Chain-agnostic anchoring boundary — plan/01-ARCHITECTURE.md §6 (verbatim shapes).
// leafCount is optional (defaults to 0) so NullAdapter call sites stay simple;
// BaseAdapter passes it through to OzDnaAnchor.anchor(bytes32, uint64).

export interface AnchorBackend {
  readonly chainId: string; // 'base-mainnet' | 'base-sepolia' | 'null' | …
  /** Commit a 32-byte Merkle root. MUST be idempotent per (root, batchId). */
  anchor(root: Uint8Array, batchId: string, leafCount?: number): Promise<AnchorReceipt>;
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
