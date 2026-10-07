import { applyD1Migrations, env } from "cloudflare:test";

// Apply the provenance migrations once per workerd isolate (D1 recipe).
await applyD1Migrations(env.PROV_DB, env.TEST_MIGRATIONS);
