#!/usr/bin/env node
/**
 * Generate ozdna.com Phase 2 SEO pages: long-tail blogs, comparisons, pillars.
 * Reads: scripts/ozdna-seo-phase2-data.json, seo/internal-links.json, seo/sitemap-urls.json
 * Run from repo root: node scripts/generate-ozdna-seo-phase2.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(ROOT, "scripts/ozdna-seo-phase2-data.json"), "utf8"));
const links = JSON.parse(readFileSync(join(ROOT, "seo/internal-links.json"), "utf8"));
const sitemapMaster = JSON.parse(readFileSync(join(ROOT, "seo/sitemap-urls.json"), "utf8"));

const blogBySlug = Object.fromEntries(data.blogs.map((b) => [b.slug, b]));

const PROOF = `<aside class="blog-proof">
  <h3>Built on ozDNA</h3>
  <p>We run production vertical AI on this stack — <a href="https://tezmakale.com" target="_blank" rel="noopener">TezMakale</a> (academic AI, Turkey) and <a href="/products/comply/">ComplyDNA</a> (RegTech). Gateways route requests; ozDNA optimizes cost, RAG reliability, and token economics for vertical products.</p>
</aside>`;

const FOOTER = `<footer>
  <div class="footer-brand">
    <a href="/" class="logo" aria-label="ozDNA">
      <img src="{{ASSET}}assets/logo.svg" alt="ozDNA" width="103" height="24" class="logo-img">
    </a>
    <p class="footer-tagline">Findbelow Ventures · Vertical AI infrastructure (PaaS)</p>
  </div>
  <div class="footer-links">
    <a href="https://tezmakale.com" target="_blank" rel="noopener">TezMakale</a>
    <a href="/trust/">Trust Center</a>
    <a href="/case-studies/tezmakale/">Case Study</a>
    <a href="/products/comply/">ComplyDNA</a>
    <a href="/blog/">Blog</a>
    <a href="mailto:hello@ozdna.com">Contact</a>
  </div>
  <p>© 2026 Findbelow Ventures</p>
</footer>
<script src="/analytics.js" defer></script>
<script src="/main.js" defer></script>`;

const NAV = `<nav>
  <a href="/" class="logo" aria-label="ozDNA home">
    <img src="{{ASSET}}assets/logo.svg" alt="ozDNA" width="120" height="28" class="logo-img">
  </a>
  <button class="nav-toggle" aria-label="Menu" aria-expanded="false">
    <span></span><span></span><span></span>
  </button>
  <div class="nav-links">
    <a href="/products/comply/">ComplyDNA</a>
    <a href="/architecture/">Platform</a>
    <a href="/docs/">Docs</a>
    <a href="/pricing/">Pricing</a>
    <a href="/#waitlist" class="nav-cta">Get Early Access</a>
  </div>
</nav>`;

function utmQuery(type, contentSlug) {
  const cfg = links.utm[type];
  if (!cfg) return "";
  const campaign = cfg.campaign.replace("{slug}", contentSlug);
  const params = new URLSearchParams({
    utm_source: cfg.source,
    utm_medium: cfg.medium,
    utm_campaign: campaign,
  });
  if (contentSlug && type !== "compare") params.set("utm_content", contentSlug);
  return `?${params}`;
}

function compareCell(kind, label) {
  const cls =
    kind === "yes" ? "compare-yes" : kind === "partial" ? "compare-partial" : "compare-no";
  const text = label ?? (kind === "yes" ? "Yes" : kind === "partial" ? "Varies" : "—");
  return `<td class="${cls}">${text}</td>`;
}

function defaultFeatureRows(competitor) {
  return [
    { capability: "Multi-provider LLM routing", competitor: "yes", ozdna: "yes" },
    { capability: "Fallback / retry across models", competitor: "yes", ozdna: "yes" },
    {
      capability: "Cost per request / workflow",
      competitor: "partial",
      competitorLabel: "Basic logging",
      ozdna: "yes",
      ozdnaLabel: "First-class cost engine",
    },
    { capability: "Usage economics (credits → real LLM spend)", competitor: "no", ozdna: "yes" },
    { capability: "Production RAG (chunk, ingest, hybrid retrieval)", competitor: "no", ozdna: "yes", ozdnaLabel: "RAG operating layer" },
    { capability: "Vertical modes (academic, legal, financial)", competitor: "no", ozdna: "yes", ozdnaLabel: "Prompt + corpus per mode" },
    {
      capability: "Live production vertical AI proof",
      competitor: "partial",
      competitorLabel: "Varies",
      ozdna: "yes",
      ozdnaLabel: '<a href="https://tezmakale.com" target="_blank" rel="noopener">TezMakale</a> (live)',
    },
    {
      capability: "Deployment model",
      competitor: "partial",
      competitorLabel: competitor === "LiteLLM" ? "Self-host OSS" : "SaaS / self-host",
      ozdna: "partial",
      ozdnaLabel: "Managed PaaS (private beta)",
    },
  ];
}

function shell({ depth, title, body }) {
  const asset = depth === 0 ? "/" : "../".repeat(depth);
  const css = depth === 0 ? "/styles.css" : `${asset}styles.css`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="${css}">
<link rel="icon" href="${asset}favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#080D12">
<meta name="color-scheme" content="dark">
</head>
<body>
<a class="skip-link" href="#main-content">Skip to main content</a>
${NAV.replace(/\{\{ASSET\}\}/g, asset)}
<main id="main-content">
${body}
</main>
${FOOTER.replace(/\{\{ASSET\}\}/g, asset)}
</body>
</html>`;
}

function blogRelatedBlock(slug) {
  const pillarSlug = links.blogToPillar[slug];
  const siblingSlug = links.blogSiblingLinks[slug];
  const pillar = pillarSlug ? links.pillars[pillarSlug] : null;
  const sibling = siblingSlug ? blogBySlug[siblingSlug] : null;
  if (!pillar && !sibling) return "";

  let html = `<section class="blog-related">
  <div class="section-label">Related reading</div>
  <h2>Continue exploring</h2>
  <ul class="blog-related-list">`;
  if (pillar) {
    html += `\n    <li><a href="${pillar.path}">${pillar.label} pillar →</a></li>`;
  }
  if (sibling) {
    html += `\n    <li><a href="/blog/${siblingSlug}/">${blogTitle(siblingSlug)}</a></li>`;
  }
  html += `\n  </ul>\n</section>`;
  return html;
}

function blogBody(post) {
  const utm = utmQuery("blog", post.slug);
  return `<article class="blog-article">
  <a href="/blog/" class="blog-back">← All posts</a>
  <div class="blog-meta">
    <span class="blog-pillar">${post.pillar}</span>
    <span class="blog-date">${post.date} · 6 min read</span>
  </div>
  <h1>${post.title}</h1>
  <p class="blog-lead">${post.description}</p>
  <p>Teams searching for <strong>${post.keyword}</strong> usually already feel the pain: inference spend climbing faster than revenue, or RAG quality drifting after launch. This note is part of the GPU Bill Bodyguard series — practical infrastructure thinking for vertical AI founders.</p>
  <h2>Start with workflow-level attribution</h2>
  <p>Blended cloud bills hide the real problem. Name the workflows users actually run — detection, retrieval, generation, re-ranking — and attribute tokens and dollars to each. Until that exists, "cheaper models" is guesswork.</p>
  <h2>Route to the cheapest capable model</h2>
  <p>LLM routing is not vanity failover. It is a policy: for this vertical step, which model clears your quality bar at the lowest cost and latency? That policy belongs in infrastructure, not scattered across application code.</p>
  <h2>RAG is an operations problem</h2>
  <p>Production RAG fails when freshness, eval coverage, and retrieval quality are treated as launch-week tasks. Gateways that only proxy HTTP do not fix stale corpora or missing eval hooks.</p>
  ${PROOF}
  ${blogRelatedBlock(post.slug)}
  <div class="blog-cta-box">
    <p>Building vertical AI in production? Join ozDNA early access.</p>
    <a href="/#waitlist${utm}" class="btn-primary">Get Early Access</a>
  </div>
</article>`;
}

function compareBody(c) {
  const rows = c.featureRows ?? defaultFeatureRows(c.competitor);
  const tableRows = rows
    .map(
      (r) => `<tr>
          <td>${r.capability}</td>
          ${compareCell(r.competitor, r.competitorLabel)}
          ${compareCell(r.ozdna, r.ozdnaLabel)}
        </tr>`,
    )
    .join("\n        ");

  const strengths = c.competitorStrengths ?? `${c.competitor} solves integration and observability for many teams.`;
  const positioning =
    c.ozdnaPositioning ??
    "ozDNA is built where RAG governance + cost optimization meet vertical AI products in production.";

  const whenWins = c.whenOzdnaWins ?? [
    {
      title: "Margin-aware AI SaaS",
      body: "Map user credits to real inference cost. Route cheap models for bulk tasks, premium models for quality-critical steps.",
    },
    {
      title: "RAG that survives launch",
      body: "Chunking, freshness, hybrid retrieval, and eval hooks — not just vector search bolted onto a gateway.",
    },
    {
      title: "Vertical depth",
      body: 'Academic AI at <a href="https://tezmakale.com" target="_blank" rel="noopener">TezMakale</a>. RegTech at <a href="/products/comply/">ComplyDNA</a>. Same stack, different corpora.',
    },
  ];

  const winCards = whenWins
    .map(
      (w, i) => `<article class="pillar-card">
      <div class="pillar-num">0${i + 1}</div>
      <h3>${w.title}</h3>
      <p>${w.body}</p>
    </article>`,
    )
    .join("\n    ");

  const utm = utmQuery("compare", c.slug);
  const pillarLink = c.parentPillar ? links.pillars[c.parentPillar]?.path : null;

  return `<section class="page-hero">
  <div class="section-label">Comparison</div>
  <h1>${c.tagline}<br>for <span class="accent">vertical AI</span> teams</h1>
  <p>${strengths} ${positioning}</p>
</section>
<section class="compare-section">
  <div class="section-label">Feature comparison</div>
  <h2 class="section-title">Gateway vs vertical AI infrastructure</h2>
  <p class="section-desc">Fair comparison — choose ${c.competitor} when routing and proxy fit is enough. Choose ozDNA when RAG reliability, token economics, and live vertical proof matter. Live proof: <a href="https://tezmakale.com" target="_blank" rel="noopener">TezMakale</a>.</p>
  <div class="compare-table-wrap">
    <table class="compare-table">
      <thead><tr><th scope="col">Capability</th><th scope="col">${c.competitor}</th><th scope="col">ozDNA</th></tr></thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>
</section>
<section class="pillars">
  <div class="section-label">When ozDNA wins</div>
  <h2 class="section-title">You need more than<br>a routing proxy.</h2>
  <div class="pillar-grid" style="grid-template-columns:repeat(3,1fr)">
    ${winCards}
  </div>
</section>
<section class="partner-strip">
  <div class="partner-inner">
    <div class="partner-copy">
      <div class="section-label">Production proof</div>
      <h2>Not a fork — a live product on ozDNA</h2>
      <p><a href="https://tezmakale.com" target="_blank" rel="noopener">TezMakale</a> handles real student traffic in Turkey: AI detection, detailed reports, token limits, peak-season spikes.</p>
    </div>
    <div class="partner-actions">
      <a href="/case-studies/tezmakale/" class="btn-ghost">Case study</a>
      <a href="https://tezmakale.com" class="btn-primary" target="_blank" rel="noopener">TezMakale →</a>
    </div>
  </div>
</section>
<section class="cta-section">
  <h2>Evaluating ${c.competitor}?</h2>
  <p>Join early access — mention ${c.competitor} on the waitlist. We will map your workflows onto ozDNA.</p>
  <a href="/#waitlist${utm}" class="btn-primary">Get Early Access</a>
  <div class="cta-actions" style="margin-top:1.5rem">
    ${pillarLink ? `<a href="${pillarLink}" class="btn-ghost">Cost & routing pillar →</a>` : ""}
    <a href="/docs/" class="btn-ghost">API Docs →</a>
    <a href="/pricing/" class="btn-ghost">Pricing →</a>
  </div>
</section>
<p class="compare-disclaimer" style="text-align:center;margin:2rem 1rem;font-size:0.85rem;opacity:0.7">${c.competitor} is a separate project; this page compares product fit, not affiliation.</p>`;
}

function pillarCards(cards) {
  return cards
    .map(
      (c) => `<article class="pillar-card">
      <div class="pillar-num">${c.num}</div>
      <h3>${c.title}</h3>
      <p>${c.body}</p>
    </article>`,
    )
    .join("\n    ");
}

function blogTitle(slug) {
  return links.blogTitles?.[slug] ?? blogBySlug[slug]?.title ?? slug;
}

function pillarBlogCluster(slug) {
  const pillar = links.pillars[slug];
  if (!pillar?.blogs?.length) return "";
  const items = pillar.blogs
    .map((blogSlug) => {
      const title = blogTitle(blogSlug);
      return `<li><a href="/blog/${blogSlug}/">${title}</a></li>`;
    })
    .join("\n      ");
  return `<section class="pillars">
  <div class="section-label">GPU Bill Bodyguard</div>
  <h2 class="section-title">Cost control in practice</h2>
  <ul class="blog-related-list">
      ${items}
  </ul>
</section>`;
}

function pillarCompareStrip(slug) {
  const pillar = links.pillars[slug];
  if (!pillar?.comparisons?.length) return "";
  const items = pillar.comparisons
    .map((compSlug) => {
      const comp = data.comparisons.find((c) => c.slug === compSlug);
      if (!comp) return "";
      return `<li><a href="/compare/${compSlug}/">${comp.title}</a></li>`;
    })
    .filter(Boolean)
    .join("\n      ");
  return `<section class="compare-section">
  <div class="section-label">Evaluating gateways</div>
  <h2 class="section-title">Routing proxies vs vertical AI infrastructure</h2>
  <p class="section-desc">Gateways route requests; ozDNA adds RAG governance + cost optimization for vertical AI products in production.</p>
  <ul class="blog-related-list">
      ${items}
  </ul>
</section>`;
}

function richPillarBody(p) {
  const utm = utmQuery("pillar", p.slug);
  return `<section class="page-hero">
  <div class="section-label">Infrastructure pillar</div>
  <h1>${p.h1}</h1>
  <p>${p.lead}</p>
</section>
<section class="pillars">
  <div class="section-label">The problem</div>
  <h2 class="section-title">API bills scale faster than revenue</h2>
  <p class="section-desc">Most teams discover LLM cost pain after launch. Blended cloud invoices hide which workflows burn tokens. Premium models applied uniformly turn inference from COGS into a structural liability.</p>
  <div class="pillar-grid" style="grid-template-columns:repeat(3,1fr)">
    ${pillarCards(p.problemCards)}
  </div>
</section>
<section class="pillars">
  <div class="section-label">Capabilities</div>
  <h2 class="section-title">Cost engine + routing policy in one layer</h2>
  <p class="section-desc">ozDNA is vertical AI infrastructure with a first-class cost engine: attribute every call to workflow and account, enforce routing policies per step, and connect usage economics to production models.</p>
  <div class="pillar-grid" style="grid-template-columns:repeat(3,1fr)">
    ${pillarCards(p.capabilityCards)}
  </div>
</section>
<section class="pillars">
  <div class="section-label">Operating model</div>
  <h2 class="section-title">Three steps to measurable inference cost</h2>
  <ol class="blog-related-list">
    <li><strong>Instrument</strong> — Name workflows and attach cost tags to every LLM call.</li>
    <li><strong>Route</strong> — Define per-step model policies; stop paying frontier prices for bulk tasks.</li>
    <li><strong>Govern</strong> — Review cost per outcome weekly; adjust routing before bills become structural.</li>
  </ol>
  <p style="margin-top:1.5rem"><a href="/architecture/" class="btn-ghost">Platform architecture →</a></p>
</section>
${pillarBlogCluster(p.slug)}
${pillarCompareStrip(p.slug)}
<section class="partner-strip">
  <div class="partner-inner">
    <div class="partner-copy">
      <div class="section-label">Built on ozDNA</div>
      <h2>Production vertical AI proof</h2>
      <p><a href="https://tezmakale.com" target="_blank" rel="noopener">TezMakale</a> and <a href="/products/comply/">ComplyDNA</a> run on this infrastructure today.</p>
    </div>
    <div class="partner-actions">
      <a href="/case-studies/tezmakale/" class="btn-ghost">Case study</a>
    </div>
  </div>
</section>
<section class="cta-section">
  <h2>Stop guessing inference cost</h2>
  <p>Join ozDNA early access. We will map your workflows, routing rules, and margin targets onto the cost engine.</p>
  <a href="/#waitlist${utm}" class="btn-primary">Get Early Access</a>
  <a href="/architecture/" class="btn-ghost">Platform architecture →</a>
</section>`;
}

function pillarBody(p) {
  if (p.rich) return richPillarBody(p);
  return `<section class="page-hero">
  <div class="section-label">Infrastructure pillar</div>
  <h1>${p.h1}</h1>
  <p>${p.description}</p>
</section>
<section class="pillars">
  <div class="pillar-grid" style="grid-template-columns:1fr">
    <article class="pillar-card">
      <h3>What ozDNA adds</h3>
      <p>Vertical AI teams need more than an LLM gateway — they need workflow-level cost control, RAG governance, and token economics that protect gross margin after launch.</p>
    </article>
  </div>
</section>
<section class="partner-strip">
  <div class="partner-inner">
    <div class="partner-copy">
      <div class="section-label">Built on ozDNA</div>
      <h2>Production vertical AI proof</h2>
      <p><a href="https://tezmakale.com" target="_blank" rel="noopener">TezMakale</a> and <a href="/products/comply/">ComplyDNA</a> run on this infrastructure today.</p>
    </div>
  </div>
</section>
<section class="cta-section">
  <h2>Explore ${p.title}</h2>
  <a href="/#waitlist${utmQuery("pillar", p.slug)}" class="btn-primary">Get Early Access</a>
  <a href="/architecture/" class="btn-ghost">Platform architecture →</a>
</section>`;
}

function writePage(relPath, html) {
  const full = join(ROOT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html, "utf8");
  console.log("wrote", relPath);
}

function buildSitemap(phase2Paths) {
  const lastmod = "2026-07-08";
  const urlMap = new Map();

  for (const entry of sitemapMaster.urls) {
    urlMap.set(entry.loc, entry);
  }

  for (const path of phase2Paths) {
    const loc = `https://ozdna.com${path}`;
    if (!urlMap.has(loc)) {
      urlMap.set(loc, { loc, priority: "0.8", changefreq: "weekly" });
    }
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const entry of urlMap.values()) {
    xml += `  <url><loc>${entry.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>\n`;
  }
  xml += "</urlset>\n";
  writeFileSync(join(ROOT, "sitemap.xml"), xml, "utf8");
  console.log("wrote sitemap.xml", `(${urlMap.size} URLs)`);
}

const pagesJsonPath = join(ROOT, "seo/pages.json");
const pages = JSON.parse(readFileSync(pagesJsonPath, "utf8"));
const sitemapPaths = [];

for (const post of data.blogs) {
  const rel = `blog/${post.slug}/index.html`;
  writePage(rel, shell({ depth: 2, title: `${post.title} — ozDNA Blog`, body: blogBody(post) }));
  pages[rel] = {
    path: `/blog/${post.slug}/`,
    title: `${post.title} — ozDNA Blog`,
    description: post.description,
    ogType: "article",
    article: true,
    datePublished: post.datePublished,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog/" },
      { name: post.title, path: `/blog/${post.slug}/` },
    ],
    alternateLanguages: [
      { lang: "en", path: `/blog/${post.slug}/` },
      { lang: "tr", path: `/tr/blog/${post.slug}/` },
    ],
  };
  sitemapPaths.push(`/blog/${post.slug}/`);
}

for (const c of data.comparisons) {
  const rel = `compare/${c.slug}/index.html`;
  writePage(rel, shell({ depth: 2, title: c.title, body: compareBody(c) }));
  pages[rel] = {
    path: `/compare/${c.slug}/`,
    title: c.title,
    description: c.description,
    ogType: "website",
    softwareApplication: true,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Compare", path: `/compare/${c.slug}/` },
    ],
    alternateLanguages: [
      { lang: "en", path: `/compare/${c.slug}/` },
      { lang: "tr", path: `/tr/compare/${c.slug}/` },
    ],
  };
  sitemapPaths.push(`/compare/${c.slug}/`);
}

for (const p of data.pillars) {
  const rel = `pillars/${p.slug}/index.html`;
  writePage(rel, shell({ depth: 2, title: `${p.title} | ozDNA`, body: pillarBody(p) }));
  pages[rel] = {
    path: `/pillars/${p.slug}/`,
    title: `${p.title} | ozDNA`,
    description: p.description,
    ogType: "website",
    softwareApplication: true,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: p.title, path: `/pillars/${p.slug}/` },
    ],
    alternateLanguages: [
      { lang: "en", path: `/pillars/${p.slug}/` },
      { lang: "tr", path: `/tr/pillars/${p.slug}/` },
    ],
  };
  sitemapPaths.push(`/pillars/${p.slug}/`);
}

writeFileSync(pagesJsonPath, JSON.stringify(pages, null, 2) + "\n", "utf8");

const blogIndexPath = join(ROOT, "blog/index.html");
if (existsSync(blogIndexPath)) {
  let blogIndex = readFileSync(blogIndexPath, "utf8");
  const marker = "</div>\n\n</main>";
  const newCards = data.blogs
    .filter((post) => !blogIndex.includes(`/blog/${post.slug}/`))
    .map(
      (post) => `  <a href="/blog/${post.slug}/" class="blog-card">
    <div class="blog-card-meta">
      <span class="blog-pillar">${post.pillar}</span>
      <span class="blog-date">${post.date}</span>
    </div>
    <h2>${post.title}</h2>
    <p>${post.description}</p>
  </a>`,
    )
    .join("\n");
  if (newCards && blogIndex.includes(marker)) {
    blogIndex = blogIndex.replace(marker, `${newCards}\n</div>\n\n</main>`);
    writeFileSync(blogIndexPath, blogIndex, "utf8");
    console.log("updated blog/index.html");
  }
}

buildSitemap(sitemapPaths);

console.log("\nRun: node scripts/apply-seo.mjs");
