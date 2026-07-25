#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const netlifyToml = readFileSync(join(root, "netlify.toml"), "utf8");

const legalRoutes = [
  { route: "/privacy/", file: "privacy/index.html" },
  { route: "/terms/", file: "terms/index.html" },
  { route: "/tr/privacy/", file: "tr/privacy/index.html" },
  { route: "/tr/terms/", file: "tr/terms/index.html" },
];

function parseRedirects(toml) {
  return toml
    .split(/\[\[redirects\]\]/)
    .slice(1)
    .map((block) => {
      const redirect = {};
      for (const line of block.split("\n")) {
        const match = line.match(/^\s*(from|to|status|force)\s*=\s*(.+?)\s*$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        redirect[key] = rawValue.replace(/^"|"$/g, "");
      }
      return redirect;
    });
}

function matchesRoute(pattern, route) {
  if (!pattern) return false;
  if (pattern.endsWith("*")) {
    return route.startsWith(pattern.slice(0, -1));
  }
  return route === pattern;
}

const force404Redirects = parseRedirects(netlifyToml).filter(
  (redirect) => redirect.status === "404" && redirect.force === "true",
);

const failures = [];

for (const { route, file } of legalRoutes) {
  if (!existsSync(join(root, file))) {
    failures.push(`${route} is missing ${file}`);
  }

  const blockingRedirect = force404Redirects.find((redirect) =>
    matchesRoute(redirect.from, route),
  );
  if (blockingRedirect) {
    failures.push(`${route} is blocked by force-404 redirect ${blockingRedirect.from}`);
  }
}

if (failures.length > 0) {
  console.error("Legal route check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Legal route check passed.");
