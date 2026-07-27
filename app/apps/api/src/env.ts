/** Cloudflare Worker bindings — names per plan/09 §5 recommendation. */
export type Env = {
  DB: D1Database;
  /** Optional until Turnstile is wired (04 §7). */
  TURNSTILE_SECRET?: string;
  ENVIRONMENT?: "development" | "staging" | "production";
};
