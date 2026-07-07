#!/usr/bin/env node
/** Build i18n/tr-global.json and i18n/tr-pages.json from core + chunks */
import { writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chunksDir = join(root, "i18n", "page-chunks");

function sortPairs(pairs) {
  return [...pairs].sort((a, b) => b[0].length - a[0].length);
}

const { globalPairs, pages: corePages } = await import(
  pathToFileURL(join(root, "scripts", "generate-tr-i18n.mjs")).href
);

const pages = { ...corePages };
for (const file of readdirSync(chunksDir).filter((f) => f.endsWith(".json")).sort()) {
  Object.assign(pages, JSON.parse(readFileSync(join(chunksDir, file), "utf8")));
}

for (const key of Object.keys(pages)) {
  pages[key].replacements = sortPairs(pages[key].replacements || []);
}

writeFileSync(join(root, "i18n", "tr-global.json"), JSON.stringify(globalPairs, null, 2) + "\n");
writeFileSync(join(root, "i18n", "tr-pages.json"), JSON.stringify(pages, null, 2) + "\n");

let pageReplCount = 0;
for (const p of Object.values(pages)) pageReplCount += p.replacements.length;
console.log(JSON.stringify({
  pageCount: Object.keys(pages).length,
  globalCount: globalPairs.length,
  pageReplCount,
  total: globalPairs.length + pageReplCount,
}));
