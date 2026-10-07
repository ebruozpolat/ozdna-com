import { webcrypto } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { build } from "esbuild";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The real signer Worker (apps/signer) runs as an auxiliary worker, so tests exercise the
 * actual service-binding RPC path. Its key is generated here, per test run: no key is ever
 * committed. The bundle goes to dist/ (gitignored).
 */
async function bundleSigner(): Promise<string> {
  const outfile = path.join(__dirname, "dist/test-signer.mjs");
  await build({
    entryPoints: [path.join(__dirname, "../signer/src/index.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    mainFields: ["module", "main"],
    external: ["cloudflare:workers"],
    logLevel: "silent",
  });
  return outfile;
}

async function testSigningKeyJwk(): Promise<string> {
  const kp = (await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  return JSON.stringify(await webcrypto.subtle.exportKey("jwk", kp.privateKey));
}

export default defineConfig({
  root: __dirname,
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations, ADMIN_TOKEN: "test-admin-token" },
          workers: [
            {
              name: "ozdna-provenance-signer",
              modules: true,
              scriptPath: await bundleSigner(),
              compatibilityDate: "2026-01-01",
              compatibilityFlags: ["nodejs_compat"],
              bindings: { SIGNING_KEY_ED25519_JWK: await testSigningKeyJwk() },
            },
          ],
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
