#!/usr/bin/env node
/**
 * Inject canonical meta tags, Open Graph, Twitter Cards, and Schema.org JSON-LD
 * into static HTML pages. Also applies Lighthouse-oriented head/body fixes.
 *
 * Usage: node scripts/apply-seo.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getI18nPair } from "./i18n-paths.mjs";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const site = JSON.parse(readFileSync(join(ROOT, "seo/site.json"), "utf8"));
const pages = JSON.parse(readFileSync(join(ROOT, "seo/pages.json"), "utf8"));

const SKIP = new Set([
  "success.html",
  "integrations/tezmakale-crosslink.html",
]);

function walkHtml(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full).replace(/\\/g, "/");
    if (name === "node_modules" || name === ".netlify" || name === "platform") continue;
    const st = statSync(full);
    if (st.isDirectory()) walkHtml(full, acc);
    else if (name.endsWith(".html") && !rel.startsWith("node_modules/")) acc.push(rel);
  }
  return acc;
}

function depthPrefix(file) {
  const d = dirname(file);
  if (d === ".") return "";
  return "../".repeat(d.split("/").length);
}

function absRootPrefix(file) {
  const d = dirname(file);
  if (d === ".") return "/";
  return "/" + d.split("/").map(() => "..").join("/") + "/";
}

function escHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function buildJsonLd(page, canonical) {
  const graph = [];
  const orgId = `${site.baseUrl}/#organization`;
  const websiteId = `${site.baseUrl}/#website`;

  graph.push({
    "@type": "Organization",
    "@id": orgId,
    name: site.organization.name,
    legalName: site.organization.legalName,
    url: site.organization.url,
    logo: {
      "@type": "ImageObject",
      url: site.organization.logo,
    },
    email: site.organization.email,
    sameAs: site.organization.sameAs,
  });

  if (page.webSite) {
    graph.push({
      "@type": "WebSite",
      "@id": websiteId,
      url: site.baseUrl + "/",
      name: site.siteName,
      description: site.softwareApplication.description,
      publisher: { "@id": orgId },
      inLanguage: site.language,
    });
  }

  graph.push({
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: page.title,
    description: page.description,
    isPartOf: page.webSite ? { "@id": websiteId } : { "@id": orgId },
    inLanguage: page.language || site.language,
  });

  if (page.softwareApplication) {
    const app = site.softwareApplication;
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${site.baseUrl}/#software`,
      name: app.name,
      applicationCategory: app.applicationCategory,
      operatingSystem: app.operatingSystem,
      description: app.description,
      url: app.url,
      downloadUrl: app.downloadUrl,
      softwareVersion: app.softwareVersion,
      releaseNotes: app.releaseNotes,
      offers: {
        "@type": "Offer",
        price: app.offers.price,
        priceCurrency: app.offers.priceCurrency,
        description: app.offers.description,
      },
      provider: { "@id": orgId },
    });
  }

  if (page.article) {
    graph.push({
      "@type": "Article",
      "@id": `${canonical}#article`,
      headline: page.title.replace(/ — ozDNA Blog$/, "").replace(/ \| ozDNA$/, ""),
      description: page.description,
      url: canonical,
      datePublished: page.datePublished || "2026-01-01",
      author: { "@id": orgId },
      publisher: { "@id": orgId },
      mainEntityOfPage: { "@id": `${canonical}#webpage` },
      image: site.defaultOgImage,
    });
  }

  if (page.breadcrumbs?.length) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: page.breadcrumbs.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        item: site.baseUrl + crumb.path,
      })),
    });
  }

  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2);
}

function buildHreflangLinks(page, canonical, relPath) {
  let alts = page.alternateLanguages;
  if (!alts?.length) {
    const pair = getI18nPair(relPath, ROOT);
    if (pair) {
      alts = [
        { lang: "en", path: pair.enPath },
        { lang: "tr", path: pair.trPath },
      ];
    }
  }
  if (!alts?.length) {
    const lang = page.language || site.language;
    return `<link rel="alternate" hreflang="${lang}" href="${canonical}">`;
  }
  const links = alts.map(
    ({ lang, path }) =>
      `<link rel="alternate" hreflang="${lang}" href="${site.baseUrl}${path}">`,
  );
  const xDefault =
    page.xDefaultPath ||
    alts.find((a) => a.lang === "en")?.path ||
    page.path;
  links.push(
    `<link rel="alternate" hreflang="x-default" href="${site.baseUrl}${xDefault}">`,
  );
  return links.join("\n");
}

function buildSeoBlock(page, file) {
  const relPath = file.replace(/\\/g, "/");
  const canonical = site.baseUrl + page.path;
  const prefix = depthPrefix(file);
  const robots = page.robots || "index, follow, max-image-preview:large, max-snippet:-1";
  const ogType = page.ogType || "website";
  const jsonLd = buildJsonLd(page, canonical);
  const pageLocale = page.locale || site.locale;
  const hreflang = buildHreflangLinks(page, canonical, relPath);

  return `<title>${escHtml(page.title)}</title>
<meta name="description" content="${escHtml(page.description)}">
<meta name="author" content="${escHtml(site.organization.name)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
${hreflang}
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${site.siteName}">
<meta property="og:title" content="${escHtml(page.title)}">
<meta property="og:description" content="${escHtml(page.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${pageLocale}">
<meta property="og:image" content="${site.defaultOgImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escHtml(site.siteName)} — Vertical AI Infrastructure">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="${site.twitterSite}">
<meta name="twitter:title" content="${escHtml(page.title)}">
<meta name="twitter:description" content="${escHtml(page.description)}">
<meta name="twitter:image" content="${site.defaultOgImage}">
<meta name="twitter:image:alt" content="${escHtml(site.siteName)} — Vertical AI Infrastructure">
<script type="application/ld+json">
${jsonLd}
</script>
<link rel="stylesheet" href="${prefix}styles.css">
<link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#080D12">
<meta name="color-scheme" content="dark">`;
}

function stripOldSeo(html) {
  let out = html;
  out = out.replace(/<!-- ozdna-seo:start -->[\s\S]*?<!-- ozdna-seo:end -->\n?/g, "");
  out = out.replace(/<title>[\s\S]*?<\/title>\n?/g, "");
  out = out.replace(/<meta name="description"[^>]*>\n?/g, "");
  out = out.replace(/<meta name="keywords"[^>]*>\n?/g, "");
  out = out.replace(/<meta name="author"[^>]*>\n?/g, "");
  out = out.replace(/<meta name="robots"[^>]*>\n?/g, "");
  out = out.replace(/<link rel="canonical"[^>]*>\n?/g, "");
  out = out.replace(/<link rel="alternate" hreflang="[^"]*"[^>]*>\n?/g, "");
  out = out.replace(/<meta property="og:[^"]*"[^>]*>\n?/g, "");
  out = out.replace(/<meta name="twitter:[^"]*"[^>]*>\n?/g, "");
  out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, "");
  out = out.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*>\n?/g, "");
  out = out.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>\n?/g, "");
  out = out.replace(/<style>[\s\S]*?<\/style>\n?(?=<!-- ozdna-seo:end -->|<link rel="preconnect")/g, "");
  out = out.replace(/<link rel="preload" href="[^"]*styles\.css"[^>]*>\n?/g, "");
  out = out.replace(/<noscript><link rel="stylesheet" href="[^"]*styles\.css"><\/noscript>\n?/g, "");
  out = out.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">\n?/g, "");
  out = out.replace(/<link rel="preload" href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" as="style" onload="[^"]*">\n?/g, "");
  out = out.replace(/<noscript><link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet"><\/noscript>\n?/g, "");
  out = out.replace(/<meta name="color-scheme"[^>]*>\n?/g, "");
  return out;
}

function injectSeo(html, block) {
  const cleaned = stripOldSeo(html);
  const marker = `<!-- ozdna-seo:start -->\n${block}\n<!-- ozdna-seo:end -->`;
  if (cleaned.includes("<meta charset=")) {
    return cleaned.replace(
      /(<meta name="viewport" content="[^"]*">)/,
      `$1\n${marker}`,
    );
  }
  return cleaned.replace(/(<head>)/, `$1\n${marker}`);
}

function ensureSkipLink(html) {
  if (html.includes('class="skip-link"')) return html;
  return html.replace(
    /<body>\s*\n/,
    `<body>\n<a class="skip-link" href="#main-content">Skip to main content</a>\n`,
  );
}

function ensureMainLandmark(html) {
  if (html.includes('id="main-content"')) return html;

  if (/<main\b/.test(html)) {
    return html.replace(/<main(\s[^>]*)?>/, (m) => {
      if (m.includes('id="')) return m;
      return m.replace("<main", '<main id="main-content"');
    });
  }

  if (!/<\/nav>/.test(html) || !/<footer>/.test(html)) return html;

  return html
    .replace(/<\/nav>\s*\n/, "</nav>\n\n<main id=\"main-content\">\n")
    .replace(/\n<footer>/, "\n</main>\n\n<footer>");
}

function normalizeScripts(html, file) {
  let out = html;
  // Absolute paths for shared assets (cache-friendly)
  out = out.replace(/<script src="(?:\.\.\/)+main\.js"><\/script>/g, '<script src="/main.js" defer></script>');
  out = out.replace(/<script src="main\.js"><\/script>/g, '<script src="/main.js" defer></script>');
  if (!out.includes('src="/main.js"')) {
    out = out.replace(/<script src="[^"]*main\.js"[^>]*><\/script>/g, '<script src="/main.js" defer></script>');
  } else if (!out.includes('src="/main.js" defer')) {
    out = out.replace('<script src="/main.js"></script>', '<script src="/main.js" defer></script>');
  }
  // Ensure stylesheet link uses relative prefix and isn't duplicated after seo block
  const prefix = depthPrefix(file);
  out = out.replace(
    new RegExp(`<link rel="stylesheet" href="${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}styles\\.css">`),
    `<link rel="stylesheet" href="${prefix}styles.css">`,
  );
  // Remove duplicate stylesheet links only after SEO block
  const seoEnd = "<!-- ozdna-seo:end -->";
  const seoIdx = out.indexOf(seoEnd);
  if (seoIdx !== -1) {
    const head = out.slice(0, seoIdx + seoEnd.length);
    const tail = out.slice(seoIdx + seoEnd.length).replace(
      /\n<link rel="stylesheet" href="[^"]*styles\.css">/g,
      "",
    );
    out = head + tail;
  }
  // Extra favicon links on homepage only — preserve if present
  return out;
}

function processFile(relPath) {
  if (SKIP.has(relPath)) return null;
  const page = pages[relPath];
  if (!page) {
    console.warn(`  skip (no config): ${relPath}`);
    return null;
  }

  const full = join(ROOT, relPath);
  let html = readFileSync(full, "utf8");
  const block = buildSeoBlock(page, relPath);
  html = injectSeo(html, block);
  html = ensureSkipLink(html);
  html = ensureMainLandmark(html);
  html = normalizeScripts(html, relPath);
  writeFileSync(full, html);
  return relPath;
}

const files = walkHtml(ROOT).filter((f) => !f.includes("node_modules"));
const updated = files.map(processFile).filter(Boolean);
console.log(`Updated ${updated.length} pages:`);
updated.forEach((f) => console.log(`  ✓ ${f}`));
