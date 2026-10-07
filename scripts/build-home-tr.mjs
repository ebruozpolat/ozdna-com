#!/usr/bin/env node
/**
 * Build tr/index.html from the EN homepage (/index.html), which carries every Turkish string
 * in data-tr attributes. The TR page is static Turkish HTML (indexable), with the same CSS
 * and JS; the page script reads <html lang> and picks Turkish for its dynamic strings.
 *
 *   node scripts/build-home-tr.mjs          # write tr/index.html
 *   node scripts/build-home-tr.mjs --check  # exit 1 if tr/index.html is stale
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const en = readFileSync(join(ROOT, "index.html"), "utf8");

const HEAD = [
  [
    /<title>[^<]*<\/title>/,
    "<title>ozDNA — Kontrol edebileceğiniz iddialar. Bu DNA'da var.</title>",
  ],
  [
    /<meta name="description" content="[^"]*">/,
    '<meta name="description" content="Kolaxa\'dan ozDNA: yapay zekâ doğrulanabilirlik altyapısı. Alıntı öncelikli uyum istihbaratı için ComplyDNA, yapay zekâ üretimi içeriğin kökeni için OriginDNA.">',
  ],
  [/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="ozDNA — Kontrol edebileceğiniz iddialar.">'],
  [
    /<meta property="og:description" content="[^"]*">/,
    '<meta property="og:description" content="Kolaxa\'dan yapay zekâ doğrulanabilirlik altyapısı. Alıntı. İmza. Doğrulama.">',
  ],
  [/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="https://ozdna.com/tr/">'],
  [/<meta property="og:locale" content="en_US">/, '<meta property="og:locale" content="tr_TR">'],
  [/<meta property="og:locale:alternate" content="tr_TR">/, '<meta property="og:locale:alternate" content="en_US">'],
  [/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="https://ozdna.com/tr/">'],
];

/** Internal links that have a live Turkish page. Privacy/terms have none (404 under /tr/). */
const TR_LINKS = ["/products/comply/", "/products/origin/", "/verify/"];

function build(html) {
  let out = html.replace(/<html lang="en">/, '<html lang="tr">');
  for (const [re, to] of HEAD) {
    if (!re.test(out)) throw new Error(`head pattern not found: ${re}`);
    out = out.replace(re, to);
  }

  // Swap each data-tr element's content for its Turkish text.
  out = out.replace(
    /<([a-z][a-z0-9]*)\b([^>]*?\sdata-tr="([^"]*)"[^>]*)>([\s\S]*?)<\/\1>/g,
    (whole, tag, attrs, tr, inner) => {
      if (new RegExp(`<${tag}\\b`).test(inner)) {
        throw new Error(`nested <${tag}> inside a data-tr element: ${whole.slice(0, 120)}`);
      }
      return `<${tag}${attrs}>${tr}</${tag}>`;
    },
  );

  out = out
    .replace('data-lang="en" aria-pressed="true"', 'data-lang="en" aria-pressed="false"')
    .replace('data-lang="tr" aria-pressed="false"', 'data-lang="tr" aria-pressed="true"')
    .replace('aria-label="ozDNA home"', 'aria-label="ozDNA ana sayfa"');
  for (const href of TR_LINKS) out = out.split(`href="${href}`).join(`href="/tr${href}`);
  return out;
}

const tr = build(en);
const path = join(ROOT, "tr/index.html");
if (process.argv.includes("--check")) {
  const current = readFileSync(path, "utf8");
  if (current !== tr) {
    console.error("tr/index.html is stale: run node scripts/build-home-tr.mjs");
    process.exit(1);
  }
  console.log("tr/index.html up to date");
} else {
  writeFileSync(path, tr);
  console.log("wrote tr/index.html");
}
