#!/usr/bin/env node
// Record real provider responses as test fixtures. NOT run in CI, and never by the test suite:
// tests use only the committed fixtures and a blocked global fetch.
//
// Usage (from a machine with network access):
//   node app/scripts/record-metadata-fixtures.mjs --mailto you@example.org --out <dir> <doi> [<doi> ...]
//
// For each DOI it records, byte for byte:
//   <slug>.doira.json                 https://doi.org/doiRA/<doi>
//   <slug>.crossref.json | .datacite.json   the work record from the RA's API (if Crossref/DataCite)
//   <slug>.meta.json                  status, content-type, URL, fetched_at, sha256 of each body
// Requests are sequential with a 1 s pause, identified with mailto (ADR-004 §3).

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const mailto = flag("--mailto");
const out = flag("--out");
const dois = args;
if (!mailto || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(mailto) || !out || dois.length === 0) {
  process.stderr.write(
    "usage: record-metadata-fixtures.mjs --mailto <email> --out <dir> <doi> [<doi> ...]\n",
  );
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const ua = `ozDNA-research-provenance-fixture-recorder/0.4 (mailto:${mailto})`;
const path = (doi) => doi.split("/").map(encodeURIComponent).join("/");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function grab(url, accept) {
  const res = await fetch(url, {
    headers: { Accept: accept, "User-Agent": ua },
    redirect: "manual",
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  return {
    url,
    status: res.status,
    content_type: res.headers.get("content-type"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes,
  };
}

for (const raw of dois) {
  const doi = raw.trim().toLowerCase();
  const slug = doi.replace(/[^a-z0-9]+/g, "_").slice(0, 80);
  const meta = { doi, fetched_at: new Date().toISOString(), responses: [] };

  const ra = await grab(`https://doi.org/doiRA/${path(doi)}`, "application/json");
  writeFileSync(join(out, `${slug}.doira.json`), ra.bytes);
  meta.responses.push({ ...ra, bytes: undefined, file: `${slug}.doira.json` });
  let agency = null;
  try {
    agency = JSON.parse(new TextDecoder().decode(ra.bytes))[0]?.RA ?? null;
  } catch {}
  await sleep(1000);

  const target =
    agency === "Crossref"
      ? {
          url: `https://api.crossref.org/works/${path(doi)}?mailto=${encodeURIComponent(mailto)}`,
          accept: "application/json",
          ext: "crossref",
        }
      : agency === "DataCite"
        ? {
            url: `https://api.datacite.org/dois/${path(doi)}?mailto=${encodeURIComponent(mailto)}`,
            accept: "application/vnd.api+json",
            ext: "datacite",
          }
        : null;
  if (target) {
    const rec = await grab(target.url, target.accept);
    writeFileSync(join(out, `${slug}.${target.ext}.json`), rec.bytes);
    meta.responses.push({ ...rec, bytes: undefined, file: `${slug}.${target.ext}.json` });
    await sleep(1000);
  }
  writeFileSync(join(out, `${slug}.meta.json`), `${JSON.stringify(meta, null, 2)}\n`);
  process.stdout.write(
    `${doi}: RA=${agency ?? "?"} ${meta.responses.map((r) => r.status).join(",")}\n`,
  );
}
