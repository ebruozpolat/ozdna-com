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

  // ---- Phase 4c source verification (all optional; unset = feature degrades, never guesses)
  /** Monitored contact address sent to Crossref/DataCite (mailto + User-Agent). Unset = no
   * provider is contacted and results are UNVERIFIED (provider_not_configured). */
  PROVIDER_CONTACT_EMAIL?: string;
  /** Per-request provider timeout in ms (default 8000). */
  PROVIDER_TIMEOUT_MS?: string;
  /** Max calls per provider per minute for the refresh job (default 30). */
  PROVIDER_RATE_PER_MINUTE?: string;
  /** Default staleness window for new sources, seconds (default 604800 = 7 days, min 3600). */
  SOURCE_REFRESH_SECONDS?: string;
  /** Raw provider payloads. Unset = size-capped D1 blobs (ADR-004 §7). Not provisioned. */
  RAW_PAYLOADS?: R2Bucket;
  /** Refresh queue (producer). Unset = the cron does nothing. Not provisioned. */
  REFRESH_QUEUE?: Queue<RefreshMessage>;
  /** Test-only: route provider HTTP through this binding instead of the global fetch. */
  PROVIDER_FETCHER?: Fetcher;
};

/** One refresh job: re-verify a source if it is still stale when the message is handled. */
export interface RefreshMessage {
  readonly tenant_id: string;
  readonly source_id: string;
}
