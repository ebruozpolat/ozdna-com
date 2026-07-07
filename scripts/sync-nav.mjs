#!/usr/bin/env node
/**
 * Replace bloated topbar nav with the slim 4-link + CTA set on EN source pages.
 * Run: node scripts/sync-nav.mjs && node scripts/build-tr-site.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");

const DEFAULT_NAV = `  <div class="nav-links">
    <a href="/products/comply/">ComplyDNA</a>
    <a href="/architecture/">Platform</a>
    <a href="/docs/">Docs</a>
    <a href="/pricing/">Pricing</a>
    <a href="/#waitlist" class="nav-cta">Get Early Access</a>
  </div>`;

const OVERRIDES = {
  "products/comply/index.html": `  <div class="nav-links">
    <a href="/products/comply/">ComplyDNA</a>
    <a href="/architecture/">Platform</a>
    <a href="/docs/">Docs</a>
    <a href="/pricing/">Pricing</a>
    <a href="/#waitlist?intent=comply" class="nav-cta">Early Access</a>
  </div>`,
  "docs/index.html": `  <div class="nav-links">
    <a href="/products/comply/">ComplyDNA</a>
    <a href="/architecture/">Platform</a>
    <a href="/docs/" class="active">Docs</a>
    <a href="/pricing/">Pricing</a>
    <a href="/#waitlist" class="nav-cta">Get Early Access</a>
  </div>`,
};

const NAV_RE = /  <div class="nav-links">[\s\S]*?  <\/div>\n(?=<\/nav>)/;

function walkHtml(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (name === "tr" || name === "node_modules" || name === "platform" || name === "complydna") {
      continue;
    }
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walkHtml(path, files);
    else if (name.endsWith(".html")) files.push(path);
  }
  return files;
}

let updated = 0;
for (const file of walkHtml(ROOT)) {
  const rel = relative(ROOT, file);
  let html = readFileSync(file, "utf8");
  if (!NAV_RE.test(html)) continue;

  const replacement = OVERRIDES[rel] || DEFAULT_NAV;
  const next = html.replace(NAV_RE, `${replacement}\n`);
  if (next !== html) {
    writeFileSync(file, next);
    updated += 1;
    console.log(`  nav: ${rel}`);
  }
}

console.log(`Updated ${updated} files.`);
