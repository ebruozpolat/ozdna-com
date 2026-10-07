#!/usr/bin/env node
/**
 * Apply the ozDNA design language (source of truth: /index.html) to every other HTML page.
 *
 *   node scripts/apply-design.mjs          # rewrite pages in place
 *   node scripts/apply-design.mjs --check  # exit 1 if any page would change
 *
 * What it does, per page (idempotent; safe to re-run):
 *   1. Replaces the old site header/nav with the shared <header class="oz-nav"> and the old
 *      site footer with the shared <footer class="oz-foot"> (between oz-shell markers).
 *      Page-specific nav links are kept (product + oversight pages); legacy platform pages
 *      get the standard nav. Legal notices inside the old footer are carried over.
 *   2. Maps the legacy palettes (paper, turquoise platform, oversight teal, deep-verify
 *      green) onto the new tokens inside <style> blocks, style="" attributes and the legacy
 *      stylesheets.
 *   3. Links /assets/ozdna-v1.css last in <head> and cache-busts the legacy stylesheets
 *      (/*.css is served immutable for a year).
 *
 * Run it AFTER scripts/build-tr-site.mjs, which regenerates tr/ pages from the EN sources.
 * The homepage and its Turkish twin are built by scripts/build-home-tr.mjs instead.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const CHECK = process.argv.includes("--check");
const CSS_HREF = "/assets/ozdna-v1.css";
const CSS_VERSION = "2";

const SKIP = new Set(["index.html", "tr/index.html", "success.html"]);
// complydna/ is the Python service (its web demo is 404 on the public site); touching it
// triggers the ComplyDNA eval workflow for no visible change.
const SKIP_DIRS = new Set([
  "app", "node_modules", ".git", "integrations", "platform", "plan", "docs/oversight", "complydna",
]);

/** TR paths Netlify answers with 404 (netlify.toml); never link to them. */
const TR_DEAD = [
  "architecture", "benchmarks", "blog", "case-studies", "changelog", "compare", "partners",
  "privacy", "roadmap", "sdk", "status", "terms", "trust", "pricing", "security",
];

// ---------------------------------------------------------------- palette

const HEX = {
  // paper family (light + dark variants collapse to the dark design)
  F2EFE6: "0b0b0b", "141208": "0b0b0b", "191611": "ffffff", EDE8D9: "ffffff",
  B52F0B: "6ba4ff", E23D0E: "6ba4ff", FF6B3D: "6ba4ff",
  "5C574C": "b8b8b8", "938D7B": "b8b8b8", "6F6A5C": "b8b8b8", "8A8474": "949494",
  "1F7A3D": "6ba4ff", "4CC470": "6ba4ff", B4680E: "d9b44a", E0A44B: "d9b44a",
  // turquoise platform stylesheet
  "40E0D0": "ffffff", B8FFF9: "ffffff", "080D12": "0b0b0b", "0D1620": "111111",
  "111B26": "151515", F0F8FF: "ffffff", B0C5D6: "b8b8b8", D4E4F2: "d9d9d9", "8BA3B8": "949494",
  // oversight teal
  "0a0c10": "0b0b0b", "12151c": "111111", "0f1218": "0f0f0f", "232833": "2a2a2a",
  e6e9ef: "ffffff", "9aa4b2": "b8b8b8", "7d8796": "949494", "5eead4": "6ba4ff",
  "3d9a8c": "4a7cc4", e0b453: "d9b44a",
  // deep-verify green
  "0f1410": "0b0b0b", e8ece4: "ffffff", "9aa394": "b8b8b8", c4f06a: "6ba4ff",
  "1a211c": "111111", "2a332c": "2a2a2a", "1c2a1e": "111111", e8b86d: "d9b44a",
  e07a6a: "ff7a70", "8fd19e": "6ba4ff",
};
const HEX_MAP = new Map(Object.entries(HEX).map(([k, v]) => [k.toLowerCase(), v]));
const HEX_RE = new RegExp(`#(${[...HEX_MAP.keys()].join("|")})(?![0-9a-f])`, "gi");
const RGB = [
  [/rgba?\(\s*25\s*,\s*22\s*,\s*17\s*,/g, "rgba(255,255,255,"],
  [/rgba?\(\s*237\s*,\s*232\s*,\s*217\s*,/g, "rgba(255,255,255,"],
  [/rgba?\(\s*64\s*,\s*224\s*,\s*208\s*,/g, "rgba(255,255,255,"],
  [/rgba?\(\s*94\s*,\s*234\s*,\s*212\s*,/g, "rgba(107,164,255,"],
  [/rgba?\(\s*8\s*,\s*13\s*,\s*18\s*,/g, "rgba(11,11,11,"],
];

export function mapPalette(css) {
  let out = css.replace(HEX_RE, (_, h) => `#${HEX_MAP.get(h.toLowerCase())}`);
  for (const [re, to] of RGB) out = out.replace(re, to);
  return out;
}

function mapInlineStyles(html) {
  return html
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (_, a, css, b) => a + mapPalette(css) + b)
    .replace(/\sstyle="([^"]*)"/g, (_, css) => ` style="${mapPalette(css)}"`);
}

// ---------------------------------------------------------------- urls

const urlOf = (rel) => `/${rel.replace(/index\.html$/, "")}`;
const live = (rel) =>
  existsSync(join(ROOT, rel)) &&
  !(rel.startsWith("tr/") && TR_DEAD.some((d) => rel.startsWith(`tr/${d}/`)));

function counterparts(rel) {
  let en;
  let tr;
  if (rel.startsWith("oversight/tr/")) [en, tr] = [`oversight/${rel.slice(13)}`, rel];
  else if (rel.startsWith("oversight/")) [en, tr] = [rel, `oversight/tr/${rel.slice(10)}`];
  else if (rel.startsWith("docs/tr/")) [en, tr] = [`docs/${rel.slice(8)}`, rel];
  else if (rel.startsWith("docs/")) [en, tr] = [rel, `docs/tr/${rel.slice(5)}`];
  else if (rel.startsWith("tr/")) [en, tr] = [rel.slice(3), rel];
  else [en, tr] = [rel, `tr/${rel}`];
  const oversight = rel.startsWith("oversight/");
  return {
    en: live(en) ? urlOf(en) : oversight ? "/oversight/" : "/",
    tr: live(tr) ? urlOf(tr) : oversight ? "/oversight/tr/" : "/tr/",
  };
}

const isTr = (rel, html) => /<html[^>]*\blang="tr"/.test(html) || /(^|\/)tr\//.test(rel);

// ---------------------------------------------------------------- shell

const STANDARD_NAV = {
  en: [["/products/comply/", "ComplyDNA"], ["/products/origin/", "OriginDNA"], ["/verify/", "Verify"]],
  tr: [["/tr/products/comply/", "ComplyDNA"], ["/tr/products/origin/", "OriginDNA"], ["/tr/verify/", "Doğrula"]],
};

const esc = (s) => s.replace(/&(?![a-z#0-9]+;)/gi, "&amp;").replace(/</g, "&lt;");
const textOf = (html) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Links of a page-specific nav, or null when the page should get the standard nav. */
function pageNav(oldHeader) {
  if (!oldHeader) return null;
  const nav = oldHeader.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/);
  if (!nav) return null;
  const links = [...nav[1].matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(([, href, inner]) => [href, textOf(inner)])
    .filter(([href, label]) => label && !/^\/(tr\/)?(pricing|architecture|docs)\//.test(href));
  // Legacy platform nav (rewritten by main.js at runtime) → standard nav instead.
  if (/class="nav-links"/.test(oldHeader)) return null;
  return links.length ? links : null;
}

function header(rel, lang, links) {
  const { en, tr } = counterparts(rel);
  const here = urlOf(rel);
  const home = rel.startsWith("oversight/") ? (lang === "tr" ? "/oversight/tr/" : "/oversight/") : lang === "tr" ? "/tr/" : "/";
  const a = links
    .map(([href, label]) => `      <a href="${href}"${href === here ? ' aria-current="page"' : ""}>${esc(label)}</a>`)
    .join("\n");
  return `<!-- oz-shell:header -->
<header class="oz-nav">
  <div class="oz-wrap">
    <a class="oz-logo" href="${home}" aria-label="ozDNA home">oz<span>DNA</span></a>
    <nav class="oz-links" id="oz-links" aria-label="${lang === "tr" ? "Ana menü" : "Primary"}">
${a}
    </nav>
    <div class="oz-lang" role="group" aria-label="${lang === "tr" ? "Dil" : "Language"}">
      <a href="${en}" lang="en" hreflang="en"${lang === "en" ? ' aria-current="true"' : ""}>EN</a>
      <a href="${tr}" lang="tr" hreflang="tr"${lang === "tr" ? ' aria-current="true"' : ""}>TR</a>
    </div>
    <button class="oz-menu" type="button" aria-expanded="false" aria-controls="oz-links">${lang === "tr" ? "MENÜ" : "MENU"}</button>
  </div>
</header>
<!-- /oz-shell:header -->`;
}

function footer(lang, legal) {
  const t = lang === "tr";
  const p = t ? "/tr" : "";
  return `<!-- oz-shell:footer -->
<footer class="oz-foot">
  <div class="oz-wrap">
    <div class="oz-cols">
      <a class="oz-logo" href="${t ? "/tr/" : "/"}" aria-label="ozDNA home">oz<span>DNA</span></a>
      <ul aria-label="${t ? "Yasal" : "Legal"}"><li><a href="/privacy/">${t ? "Gizlilik" : "Privacy"}</a></li><li><a href="/terms/">${t ? "Kullanım şartları" : "Terms"}</a></li><li><a href="/privacy/">KVKK</a></li></ul>
      <ul aria-label="${t ? "Ürünler" : "Products"}"><li><a href="${p}/products/comply/">ComplyDNA</a></li><li><a href="${p}/products/origin/">OriginDNA</a></li><li><a href="${p}/verify/">${t ? "Doğrula" : "Verify"}</a></li></ul>
      <ul aria-label="${t ? "İletişim" : "Contact"}"><li><a href="mailto:hello@ozdna.com">${t ? "İletişim" : "Contact"}</a></li></ul>
      <p class="oz-note">${t ? "Kolaxa'nın bir ürünüdür." : "A Kolaxa product."}</p>
    </div>
    <div class="oz-legal">
${legal ? `${legal.trim()}\n` : ""}      <p>${t ? "Bu sitedeki AB Yapay Zekâ Tüzüğü bilgileri genel bilgilendirmedir ve hukuki tavsiye değildir." : "EU AI Act information on this site is general information and not legal advice."}</p>
      <p>© Kolaxa</p>
    </div>
  </div>
</footer>
<script>(function(){var b=document.querySelector(".oz-menu"),n=document.getElementById("oz-links");if(!b||!n)return;b.addEventListener("click",function(){b.setAttribute("aria-expanded",String(n.classList.toggle("open")))});n.addEventListener("click",function(e){if(e.target.closest("a")){n.classList.remove("open");b.setAttribute("aria-expanded","false")}})})();</script>
<!-- /oz-shell:footer -->`;
}

/** Legal notices worth keeping from an old footer (ComplyDNA notice, oversight fine print). */
function legalFrom(oldFooter) {
  if (!oldFooter) return "";
  const keep = [];
  const start = oldFooter.indexOf('<div class="footer-legal">');
  if (start >= 0) {
    const end = oldFooter.indexOf('<div class="foot">', start);
    if (end > start) keep.push(oldFooter.slice(start, end).trim());
  }
  for (const m of oldFooter.matchAll(/<p class="fine">[\s\S]*?<\/p>/g)) keep.push(m[0]);
  return keep.join("\n");
}

// ---------------------------------------------------------------- page

const HEADER_MARK = /<!-- oz-shell:header -->[\s\S]*?<!-- \/oz-shell:header -->\n?/;
const FOOTER_MARK = /<!-- oz-shell:footer -->[\s\S]*?<!-- \/oz-shell:footer -->\n?/;

function transform(rel, html) {
  const lang = isTr(rel, html) ? "tr" : "en";
  let out = html;

  // --- header
  let oldHeader = null;
  let links;
  const marked = out.match(HEADER_MARK);
  if (marked) {
    links = [...marked[0].matchAll(/<a href="([^"]*)"(?: aria-current="page")?>([^<]*)<\/a>/g)]
      .filter(([, , l]) => l)
      .map(([, h, l]) => [h, l.replace(/&amp;/g, "&")]);
    out = out.replace(HEADER_MARK, "");
  } else {
    const mainAt = out.search(/<main\b/);
    const re = /^<(header|nav)\b[^>]*>[\s\S]*?^<\/\1>\n?/m;
    const m = out.match(re);
    if (m && (mainAt < 0 || m.index < mainAt)) {
      oldHeader = m[0];
      out = out.slice(0, m.index) + out.slice(m.index + m[0].length);
    }
    links = pageNav(oldHeader);
  }
  if (!links) links = STANDARD_NAV[lang];

  // --- footer
  let legal = "";
  const fm = out.match(FOOTER_MARK);
  if (fm) {
    const inner = fm[0].match(/<div class="oz-legal">\n([\s\S]*?)      <p>(?:Bu sitedeki|EU AI Act)/);
    legal = inner ? inner[1] : "";
    out = out.replace(FOOTER_MARK, "");
  } else {
    const all = [...out.matchAll(/^<footer\b[^>]*>[\s\S]*?^<\/footer>\n?/gm)];
    const last = all.at(-1);
    if (last) {
      legal = legalFrom(last[0]);
      out = out.slice(0, last.index) + out.slice(last.index + last[0].length);
    }
  }

  // --- insert shell
  const h = header(rel, lang, links);
  const skip = out.match(/<body\b[^>]*>\s*(<a class="skip-link"[^>]*>[\s\S]*?<\/a>\s*)?/);
  if (!skip) throw new Error(`${rel}: no <body>`);
  const at = skip.index + skip[0].length;
  out = `${out.slice(0, at)}${h}\n${out.slice(at)}`;
  const foot = `${footer(lang, legal)}\n`;
  const endFooterAt = all_tail(out);
  out = out.slice(0, endFooterAt) + foot + out.slice(endFooterAt);

  // --- palette + stylesheets
  out = mapInlineStyles(out);
  out = out.replace(/(href="[^"]*(?:styles|site)\.css)(?:\?v=\d+)?"/g, `$1?v=${CSS_VERSION}"`);
  if (!out.includes(CSS_HREF)) {
    out = out.replace("</head>", `<link rel="stylesheet" href="${CSS_HREF}">\n</head>`);
  }
  return out;
}

/** Insert the footer where the old one was: before trailing top-level <script>s and </body>. */
function all_tail(html) {
  const m = html.match(
    /(?:\s*<script\b[^>]*>(?:(?!<\/script>)[\s\S])*<\/script>)*\s*<\/body>\s*<\/html>\s*$/,
  );
  if (!m) throw new Error("no </body></html> at end of file");
  return m.index;
}

// ---------------------------------------------------------------- main

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(ROOT, abs);
    if (statSync(abs).isDirectory()) {
      if (!SKIP_DIRS.has(rel) && !name.startsWith(".")) walk(abs, files);
    } else if (name.endsWith(".html") && !SKIP.has(rel)) files.push(rel);
  }
  return files;
}

const LEGACY_CSS = ["styles.css", "oversight/assets/site.css"];

let changed = 0;
for (const rel of walk(ROOT).sort()) {
  const abs = join(ROOT, rel);
  const before = readFileSync(abs, "utf8");
  const after = transform(rel, before);
  if (after !== before) {
    changed++;
    if (CHECK) console.log(`would change: ${rel}`);
    else writeFileSync(abs, after);
  }
}
for (const rel of LEGACY_CSS) {
  const abs = join(ROOT, rel);
  const before = readFileSync(abs, "utf8");
  const after = mapPalette(before);
  if (after !== before) {
    changed++;
    if (CHECK) console.log(`would change: ${rel}`);
    else writeFileSync(abs, after);
  }
}
console.log(`${CHECK ? "check" : "apply"}: ${changed} file(s) ${CHECK ? "out of date" : "updated"}`);
if (CHECK && changed) process.exit(1);
