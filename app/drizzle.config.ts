import { defineConfig } from "drizzle-kit";

// Generates a REFERENCE migration into migrations-drizzle/ to diff against the canonical
// hand-written migrations/0001_init.sql. NOT applied — the canonical migration is the raw
// 04 §5 SQL (drizzle-kit cannot emit COLLATE NOCASE; see apps/api/src/db/schema.ts). (A5)
export default defineConfig({
  dialect: "sqlite",
  schema: "./apps/api/src/db/schema.ts",
  out: "./migrations-drizzle",
});
