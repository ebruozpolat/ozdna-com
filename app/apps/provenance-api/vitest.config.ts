import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
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

/**
 * Fake metadata providers for Phase 4c tests (doi.org RA lookup, Crossref), served from the
 * synthetic fixtures of packages/source-verification. Reached only through the PROVIDER_FETCHER
 * service binding; per-DOI variants are switched via https://fake.control/variant.
 */
function fakeProviderScript(): string {
  const fx = (n: string) =>
    JSON.parse(
      readFileSync(
        path.join(__dirname, "../../packages/source-verification/test/fixtures", n),
        "utf8",
      ),
    );
  const normal = fx("crossref-normal.json");
  const retracted = fx("crossref-retracted.json");
  const withDoi = (rec: any, doi: string, updatedBy?: unknown[]) => {
    const copy = structuredClone(rec);
    copy.message.DOI = doi;
    if (updatedBy) copy.message["updated-by"] = updatedBy;
    return JSON.stringify(copy);
  };
  const flipDoi = "10.5555/ozdna.flip.2024";
  const works: Record<string, Record<string, string>> = {
    "10.5555/ozdna.normal.2024": { default: JSON.stringify(normal) },
    "10.5555/ozdna.retracted.2022": { default: JSON.stringify(retracted) },
    [flipDoi]: {
      default: withDoi(normal, flipDoi),
      retracted: withDoi(normal, flipDoi, retracted.message["updated-by"]),
    },
  };
  const notFound = readFileSync(
    path.join(__dirname, "../../packages/source-verification/test/fixtures/doira-not-found.json"),
    "utf8",
  );
  return `
const WORKS = ${JSON.stringify(works)};
const NOT_FOUND = ${JSON.stringify(notFound)};
const VARIANTS = new Map();
const json = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });
export default {
  async fetch(req) {
    const u = new URL(req.url);
    if (u.hostname === "fake.control") {
      const { doi, variant } = await req.json();
      VARIANTS.set(doi, variant);
      return new Response("ok");
    }
    if (u.hostname === "doi.org" && u.pathname.startsWith("/doiRA/")) {
      const doi = decodeURIComponent(u.pathname.slice(7));
      if (doi === "10.5555/ozdna.does-not-exist") return json(NOT_FOUND);
      if (doi === "10.5555/ozdna.outage") return new Response("down", { status: 503 });
      if (doi === "10.5555/ozdna.timeout") await new Promise((r) => setTimeout(r, 1500));
      return json(JSON.stringify([{ DOI: doi, RA: "Crossref" }]));
    }
    if (u.hostname === "api.crossref.org" && u.pathname.startsWith("/works/")) {
      const doi = decodeURIComponent(u.pathname.slice(7));
      if (doi === "10.5555/ozdna.ratelimited") return new Response("slow down", { status: 429 });
      const variants = WORKS[doi];
      if (!variants) return json('{"status":"error"}', 404);
      return json(variants[VARIANTS.get(doi) ?? "default"]);
    }
    return new Response("fake provider: no route for " + u.hostname, { status: 599 });
  },
};`;
}

/** Outbound fetch from the API Worker under test: always refused (CI never uses the network). */
const NETWORK_BLOCKED = `export default { async fetch(req) {
  return new Response("network blocked in tests: " + new URL(req.url).hostname, { status: 599 });
} };`;

export default defineConfig({
  root: __dirname,
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ADMIN_TOKEN: "test-admin-token",
            // Test-only identification; real deployments set this per environment.
            PROVIDER_CONTACT_EMAIL: "provenance-tests@ozdna.example",
            PROVIDER_TIMEOUT_MS: "300",
            PROVIDER_RATE_PER_MINUTE: "1000",
          },
          serviceBindings: { PROVIDER_FETCHER: "fake-providers" },
          outboundService: "network-blocked",
          r2Buckets: ["TEST_R2"],
          workers: [
            { name: "fake-providers", modules: true, script: fakeProviderScript() },
            { name: "network-blocked", modules: true, script: NETWORK_BLOCKED },
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
