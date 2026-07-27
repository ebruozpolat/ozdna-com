/** Cloudflare Worker bindings — names per plan/09 §5 recommendation. */
export type Env = {
  DB: D1Database;
  /** Optional until Turnstile is wired (04 §7). */
  TURNSTILE_SECRET?: string;
  ENVIRONMENT?: "development" | "staging" | "production";
  /** EC P-256 JWK JSON string for POST /v1/sign-digest (npm run certs:dev). */
  SIGNING_KEY_JWK?: string;
  SIGNING_KEY_ID?: string;
};
