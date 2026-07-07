#!/usr/bin/env node
/**
 * Generate Turkish HTML pages under tr/ from EN sources + i18n JSON.
 * Run: node scripts/build-tr-site.mjs && node scripts/apply-seo.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteHrefForTr } from "./i18n-paths.mjs";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const globalPairs = JSON.parse(readFileSync(join(ROOT, "i18n/tr-global.json"), "utf8"));
const trPages = JSON.parse(readFileSync(join(ROOT, "i18n/tr-pages.json"), "utf8"));
const pagesConfig = JSON.parse(readFileSync(join(ROOT, "seo/pages.json"), "utf8"));

function applyReplacements(html, pairs) {
  let out = html;
  for (const [en, tr] of pairs) {
    if (en && out.includes(en)) out = out.split(en).join(tr);
  }
  return out;
}

function rewriteInternalHrefs(html) {
  return html.replace(/href="(\/[^"]*)"/g, (match, href) => {
    const next = rewriteHrefForTr(href);
    return next === href ? match : `href="${next}"`;
  });
}

function prefixRelativeAssets(html) {
  return html.replace(
    /(\s(?:href|src))="(?!https?:|\/|mailto:|#|data:)([^"]+)"/g,
    (m, attr, path) => `${attr}="../${path}"`,
  );
}

function stripSeoBlock(html) {
  return html.replace(/<!-- ozdna-seo:start -->[\s\S]*?<!-- ozdna-seo:end -->\n?/g, "");
}

function buildTrPage(enRel) {
  const meta = trPages[enRel];
  if (!meta) {
    console.warn(`  skip (no tr meta): ${enRel}`);
    return null;
  }

  const trRel = `tr/${enRel}`;
  const enPath = join(ROOT, enRel);
  if (!existsSync(enPath)) {
    console.warn(`  skip (missing EN): ${enRel}`);
    return null;
  }

  let html = readFileSync(enPath, "utf8");
  html = stripSeoBlock(html);
  html = html.replace('<html lang="en">', '<html lang="tr">');
  html = applyReplacements(html, globalPairs);
  html = applyReplacements(html, meta.replacements || []);
  html = rewriteInternalHrefs(html);
  html = html.replace(/href="#waitlist"/g, 'href="/tr/#waitlist"');
  html = prefixRelativeAssets(html);

  // Remove hardcoded lang switcher — main.js injects dynamically
  html = html.replace(/\s*<div class="lang-switch"[\s\S]*?<\/div>\n?/g, "\n");

  const outPath = join(ROOT, trRel);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);

  const trPath =
    enRel === "index.html"
      ? "/tr/"
      : meta.breadcrumbs?.[meta.breadcrumbs.length - 1]?.path ||
        `/tr/${dirname(enRel)}/`.replace(/\/\.$/, "/");

  pagesConfig[trRel] = {
    path: trPath,
    language: "tr",
    locale: "tr_TR",
    title: meta.title,
    description: meta.description,
    ogType: pagesConfig[enRel]?.ogType || "website",
    ...(pagesConfig[enRel]?.softwareApplication ? { softwareApplication: true } : {}),
    ...(pagesConfig[enRel]?.article ? { article: true, datePublished: pagesConfig[enRel].datePublished } : {}),
    alternateLanguages: [
      { lang: "en", path: pagesConfig[enRel]?.path || "/" },
      { lang: "tr", path: trPath },
    ],
    breadcrumbs: meta.breadcrumbs || [],
  };

  if (pagesConfig[enRel]) {
    pagesConfig[enRel].alternateLanguages = [
      { lang: "en", path: pagesConfig[enRel].path },
      { lang: "tr", path: trPath },
    ];
  }

  return trRel;
}

const built = Object.keys(trPages).map(buildTrPage).filter(Boolean);
writeFileSync(join(ROOT, "seo/pages.json"), JSON.stringify(pagesConfig, null, 2) + "\n");

console.log(`Built ${built.length} Turkish pages:`);
built.forEach((f) => console.log(`  ✓ ${f}`));
