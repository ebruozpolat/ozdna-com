import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// D1 suites for the provenance API, against its OWN migrations (not app/migrations).
export default defineConfig({
  root: __dirname,
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, ADMIN_TOKEN: "test-admin-token" },
        },
      };
    }),
  ],
  test: {
    dir: __dirname,
    include: ["test/**/*.workers.test.ts"],
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
