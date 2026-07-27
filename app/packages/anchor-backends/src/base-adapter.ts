// BaseAdapter — Base mainnet / Sepolia via viem (plan/01 §6, plan/02).
// INVARIANT: nothing outside apps/anchor may import this package's viem usage
// for chain IO — api/web consume only AnchorReceipt JSON (01 §6 rule 1).

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { ozDnaAnchorAbi } from "./ozdna-anchor-abi.js";
import type { AnchorBackend, AnchorReceipt, AnchorStatus } from "./types.js";

export type BaseAdapterConfig = {
  readonly chainId: "base-mainnet" | "base-sepolia";
  readonly rpcUrl: string;
  readonly contractAddress: `0x${string}`;
  /** Hot operator key — NEVER user funds (hard rule 2). */
  readonly operatorPrivateKey: `0x${string}`;
};

function toBytes32Hex(root: Uint8Array): Hex {
  if (root.byteLength !== 32) {
    throw new RangeError(`BaseAdapter.anchor: root must be 32 bytes, got ${root.byteLength}`);
  }
  return `0x${[...root].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function resolveChain(chainId: BaseAdapterConfig["chainId"]) {
  return chainId === "base-sepolia" ? baseSepolia : base;
}

/**
 * Live Base L2 adapter: calls OzDnaAnchor.anchor(merkleRoot, leafCount) from the
 * operator gas wallet. Requires RPC + private key + deployed contract address.
 */
export class BaseAdapter implements AnchorBackend {
  readonly chainId: "base-mainnet" | "base-sepolia";
  private readonly config: BaseAdapterConfig;
  private readonly account: PrivateKeyAccount;

  constructor(config: BaseAdapterConfig) {
    if (!config.operatorPrivateKey || !config.operatorPrivateKey.startsWith("0x")) {
      throw new Error(
        "BaseAdapter: operatorPrivateKey must be a 0x-prefixed hex private key (Secrets).",
      );
    }
    if (!config.contractAddress || !config.contractAddress.startsWith("0x")) {
      throw new Error("BaseAdapter: contractAddress must be a 0x-prefixed address.");
    }
    if (!config.rpcUrl) {
      throw new Error("BaseAdapter: rpcUrl is required.");
    }

    this.config = config;
    this.chainId = config.chainId;
    this.account = privateKeyToAccount(config.operatorPrivateKey);
  }

  /** Exposed for unit tests / diagnostics — does not touch the network. */
  getConfig(): Readonly<BaseAdapterConfig> {
    return this.config;
  }

  /** ABI-encode OzDnaAnchor.anchor(bytes32,uint64) for tests / dry-run. */
  encodeAnchorCalldata(root: Uint8Array, leafCount = 0): Hex {
    return encodeFunctionData({
      abi: ozDnaAnchorAbi,
      functionName: "anchor",
      args: [toBytes32Hex(root), BigInt(leafCount)],
    });
  }

  private publicClient() {
    return createPublicClient({
      chain: resolveChain(this.chainId),
      transport: http(this.config.rpcUrl),
    });
  }

  private walletClient() {
    return createWalletClient({
      account: this.account,
      chain: resolveChain(this.chainId),
      transport: http(this.config.rpcUrl),
    });
  }

  async anchor(root: Uint8Array, batchId: string, leafCount = 0): Promise<AnchorReceipt> {
    const merkleRoot = toBytes32Hex(root);
    const count = BigInt(Math.max(0, Math.floor(leafCount)));

    const hash = await this.walletClient().writeContract({
      address: this.config.contractAddress,
      abi: ozDnaAnchorAbi,
      functionName: "anchor",
      args: [merkleRoot, count],
      account: this.account,
      chain: resolveChain(this.chainId),
    });

    return {
      chainId: this.chainId,
      txid: hash,
      raw: {
        batchId,
        merkleRoot,
        leafCount: Number(count),
        contract: this.config.contractAddress,
      },
    };
  }

  async verify(receipt: AnchorReceipt, root: Uint8Array): Promise<AnchorStatus> {
    if (receipt.chainId !== this.chainId) return "not_found";
    if (!receipt.txid || !receipt.txid.startsWith("0x")) return "not_found";
    if (root.byteLength !== 32) return "not_found";

    const client = this.publicClient();

    try {
      const tx = await client.getTransaction({
        hash: receipt.txid as Hex,
      });
      if (!tx) return "not_found";

      // Pending: mined blockNumber is null until inclusion.
      if (tx.blockNumber == null) return "pending";

      const receiptOnChain = await client.getTransactionReceipt({
        hash: receipt.txid as Hex,
      });
      if (!receiptOnChain) return "pending";
      if (receiptOnChain.status === "reverted") return "not_found";

      // Inclusion + success = confirmed for v1 (event decode optional).
      return "confirmed";
    } catch {
      // getTransaction throws when the hash is unknown on some RPCs.
      try {
        await client.getTransactionReceipt({ hash: receipt.txid as Hex });
        return "pending";
      } catch {
        return "not_found";
      }
    }
  }

  explorerUrl(receipt: AnchorReceipt): string {
    const baseUrl =
      this.chainId === "base-sepolia"
        ? "https://sepolia.basescan.org/tx/"
        : "https://basescan.org/tx/";
    return `${baseUrl}${receipt.txid}`;
  }
}
