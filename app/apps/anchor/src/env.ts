// Anchor Worker bindings. TRUST ISOLATION (plan/01 §6): this Worker binds the gas wallet and
// ONLY the gas wallet — never the signing key (that lives on apps/api). The private key is used
// solely by the viem BaseAdapter (not yet built); until then CHAIN=null runs the NullAdapter.

export interface Env {
  readonly DB: D1Database;
  /** Target chain id: 'null' (dev, NullAdapter), later 'base-mainnet' / 'base-sepolia'. */
  readonly CHAIN: string;
  /** Anchor contract address recorded on batches + proofs (01-ARCHITECTURE). */
  readonly ANCHOR_CONTRACT: string;
  /** Gas-wallet private key. SECRET. Consumed ONLY by the (deferred) viem BaseAdapter. */
  readonly ANCHOR_PRIVATE_KEY?: string;
}
