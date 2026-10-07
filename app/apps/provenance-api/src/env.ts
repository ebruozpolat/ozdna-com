import type { Checkpoint, DetachedSignature } from "@ozdna/provenance-schema";

/** The signer Worker's RPC surface (apps/signer, entrypoint "Signer"). */
export interface SignerRpc {
  publicKey(): Promise<{ key_id: string; algorithm: "Ed25519"; public_key: string }>;
  signCheckpoint(body: unknown): Promise<{ checkpoint: Checkpoint; signature: DetachedSignature }>;
}

/** Bindings for the research-provenance API Worker. */
export type Env = {
  /** Own D1 database (ozdna-provenance) — never the image DB. */
  PROV_DB: D1Database;
  /** Service binding to ozdna-provenance-signer. Unset = checkpoints unavailable (503). */
  SIGNER?: SignerRpc;
  /** Enables the /admin endpoints (header X-Admin-Token). Unset = disabled. */
  ADMIN_TOKEN?: string;
  ENVIRONMENT?: "development" | "staging" | "production";
};
