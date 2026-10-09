import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Signer suites run inside workerd (real Ed25519 WebCrypto). Keys are generated per test.
export default defineConfig({
  root: __dirname,
  plugins: [cloudflareTest(async () => ({ wrangler: { configPath: "./wrangler.jsonc" } }))],
  test: { dir: __dirname, include: ["test/**/*.workers.test.ts"] },
});
