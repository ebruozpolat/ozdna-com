// Worker bindings. Secrets are NEVER hard-coded — they arrive as bindings (wrangler secrets
// / vars). The signing key lives ONLY on apps/api; the gas wallet lives ONLY on apps/anchor
// (trust isolation, plan/01 §1/§6). apps/web binds none of these.

export interface Env {
  /** D1 database (schema: migrations/0001_init.sql, typed accessor @ozdna/db). */
  readonly DB: D1Database;
  /** R2 bucket for stored C2PA manifests (plan/04 §4.4: manifest_b64 ≤1MB → R2). */
  readonly MANIFESTS: R2Bucket;
  /** Public base URL for building record/proof URLs, e.g. https://api.ozdna.com. */
  readonly PUBLIC_API_BASE: string;
  /** Public site base, e.g. https://ozdna.com — used in record_url + error doc_url. */
  readonly PUBLIC_SITE_BASE: string;
  /** Cloudflare Turnstile secret (server-side verification of the public forms). SECRET. */
  readonly TURNSTILE_SECRET?: string;
}
