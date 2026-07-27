/**
 * drizzle-kit config for schema ↔ SQL diff checks.
 *
 * Applied D1 migrations live at repo `app/migrations/0001_init.sql` (source of truth).
 * Kit output goes to `./drizzle` under this package — use it to review diffs, not to
 * casually replace 0001_init.sql.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
