import { applyD1Migrations, env } from "cloudflare:test";

// Apply SQL migrations once per workerd isolate (D1 recipe).
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
