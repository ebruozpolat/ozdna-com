/** Bindings for the research-provenance API Worker. */
export type Env = {
  /** Own D1 database (ozdna-provenance) — never the image DB. */
  PROV_DB: D1Database;
  /** Enables POST /v1/provenance/admin/tenants (header X-Admin-Token). Unset = disabled. */
  ADMIN_TOKEN?: string;
  ENVIRONMENT?: "development" | "staging" | "production";
};
