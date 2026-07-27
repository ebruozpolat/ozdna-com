export type Env = {
  DB: D1Database;
  ENVIRONMENT?: "development" | "staging" | "production";
  /** "null" (default) or "base" when RPC + private key bindings exist. */
  ANCHOR_BACKEND?: "null" | "base";
  BASE_RPC_URL?: string;
  ANCHOR_PRIVATE_KEY?: string;
  ANCHOR_CONTRACT_ADDRESS?: string;
};
