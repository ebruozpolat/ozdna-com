#!/usr/bin/env node
/**
 * EN ↔ TR path helpers for ozdna.com static site.
 * Default: EN at /foo/ · TR at /tr/foo/
 * Exception: docs at /docs/ · /docs/tr/
 */

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

export const DOC_EN_REL = "docs/index.html";
export const DOC_TR_REL = "docs/tr/index.html";

export function urlFromRel(rel) {
  if (rel === "index.html") return "/";
  const dir = dirname(rel);
  if (dir === ".") return "/";
  return `/${dir}/`;
}

export function getI18nPair(relPath, root) {
  if (relPath === DOC_EN_REL || relPath === DOC_TR_REL) {
    return {
      enRel: DOC_EN_REL,
      trRel: DOC_TR_REL,
      enPath: "/docs/",
      trPath: "/docs/tr/",
    };
  }

  if (relPath.startsWith("tr/")) {
    const enRel = relPath.slice(3);
    if (!root || existsSync(join(root, enRel))) {
      return {
        enRel,
        trRel: relPath,
        enPath: urlFromRel(enRel),
        trPath: urlFromRel(relPath),
      };
    }
    return null;
  }

  const trRel = `tr/${relPath}`;
  if (root && !existsSync(join(root, trRel))) return null;

  return {
    enRel: relPath,
    trRel,
    enPath: urlFromRel(relPath),
    trPath: urlFromRel(trRel),
  };
}

/** Browser pathname → { en, tr } switch targets */
export function langSwitchUrls(pathname) {
  const path = pathname.endsWith("/") || pathname === "" ? pathname : `${pathname}/`;
  const normalized = path === "" ? "/" : path;

  if (normalized === "/docs/" || normalized.startsWith("/docs/tr")) {
    const onTr = normalized.startsWith("/docs/tr");
    return {
      en: "/docs/",
      tr: "/docs/tr/",
      current: onTr ? "tr" : "en",
    };
  }

  if (normalized === "/tr/" || normalized.startsWith("/tr/")) {
    const en =
      normalized === "/tr/"
        ? "/"
        : normalized.replace(/^\/tr/, "") || "/";
    return { en, tr: normalized, current: "tr" };
  }

  const tr = normalized === "/" ? "/tr/" : `/tr${normalized}`;
  return { en: normalized, tr, current: "en" };
}

const PRESERVE_ABS_PATHS = new Set([
  "/llms.txt",
  "/sitemap.xml",
  "/robots.txt",
  "/status/feed.json",
  "/changelog/feed.json",
]);

export function rewriteHrefForTr(href) {
  if (PRESERVE_ABS_PATHS.has(href)) return href;
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.startsWith("/tr/") ||
    href.startsWith("/docs/tr")
  ) {
    return href;
  }
  if (href.startsWith("/docs")) {
    return href === "/docs" || href === "/docs/"
      ? "/docs/tr/"
      : `/docs/tr${href.slice(5)}`;
  }
  if (href === "/") return "/tr/";
  if (href.startsWith("/#")) return `/tr/${href.slice(1)}`;
  return `/tr${href}`;
}

export function rewriteHrefForEn(href) {
  if (href.startsWith("/docs/tr")) {
    const rest = href.slice("/docs/tr".length);
    return rest ? `/docs${rest}` : "/docs/";
  }
  if (href.startsWith("/tr/")) {
    const rest = href.slice(4);
    return rest ? `/${rest}` : "/";
  }
  if (href === "/tr" || href === "/tr/") return "/";
  return href;
}
