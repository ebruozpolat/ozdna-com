#!/usr/bin/env node
/** Append /tr/* URLs to sitemap.xml from seo/pages.json */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pages = JSON.parse(readFileSync(join(ROOT, "seo/pages.json"), "utf8"));
const sitemapPath = join(ROOT, "sitemap.xml");

const base = readFileSync(sitemapPath, "utf8");
const existing = new Set([...base.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

const trUrls = Object.entries(pages)
  .filter(([rel]) => rel.startsWith("tr/") || rel === "docs/tr/index.html")
  .map(([, p]) => `https://ozdna.com${p.path}`)
  .filter((url) => !existing.has(url))
  .sort();

if (!trUrls.length) {
  console.log("Sitemap already includes all TR URLs.");
  process.exit(0);
}

const inserts = trUrls
  .map(
    (loc) => `  <url>
    <loc>${loc}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.75</priority>
  </url>`,
  )
  .join("\n");

const updated = base.replace("</urlset>", `${inserts}\n</urlset>`);
writeFileSync(sitemapPath, updated);
console.log(`Added ${trUrls.length} TR URLs to sitemap.xml`);
