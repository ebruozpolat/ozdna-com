// BaseAdapter — Base mainnet / Sepolia via viem (plan/01 §6, plan/02).
// Scaffold only: full viem wiring lands with apps/anchor (gas wallet + contract address).
// Nothing outside apps/anchor may import viem (01 §6 rule 1).

import type { AnchorBackend, AnchorReceipt, AnchorStatus } from "./types.js";

export type BaseAdapterConfig = {
  readonly chainId: "base-mainnet" | "base-sepolia";
  readonly rpcUrl: string;
  readonly contractAddress: `0x${string}`;
  /** Hot operator key — NEVER user funds (hard rule 2). */
  readonly operatorPrivateKey: `0x${string}`;
};

/**
 * Placeholder until apps/anchor provisions Secrets + deploys OzDnaAnchor.
 * Constructing without config throws; methods throw until viem is wired.
 */
export class BaseAdapter implements AnchorBackend {
  readonly chainId: "base-mainnet" | "base-sepolia";
  private readonly config: BaseAdapterConfig;

  constructor(config: BaseAdapterConfig) {
    this.config = config;
    this.chainId = config.chainId;
  }

  async anchor(_root: Uint8Array, _batchId: string): Promise<AnchorReceipt> {
    void this.config;
    throw new Error(
      "BaseAdapter.anchor: viem + OzDnaAnchor.anchor() wiring lands with apps/anchor — use NullAdapter in local/dev.",
    );
  }

  async verify(_receipt: AnchorReceipt, _root: Uint8Array): Promise<AnchorStatus> {
    void this.config;
    throw new Error(
      "BaseAdapter.verify: viem receipt confirmation lands with apps/anchor — use NullAdapter in local/dev.",
    );
  }

  explorerUrl(receipt: AnchorReceipt): string {
    const base =
      this.chainId === "base-sepolia"
        ? "https://sepolia.basescan.org/tx/"
        : "https://basescan.org/tx/";
    return `${base}${receipt.txid}`;
  }
}
