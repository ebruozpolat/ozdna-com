// Normalised provider snapshots and Retraction Watch redaction.
//
// A snapshot is the canonical JSON (ozdna-cjson/v1) of what the adapter extracted from a provider
// response, so the same response always gives the same snapshot_sha256 (no timestamps inside).
// Retraction Watch-sourced update entries are reduced to {source, entry_sha256} both in the
// snapshot and in the stored raw payload: we keep hashes and the reporting source, never RW
// data itself (ADR-004 §2).

import { canonicalize, normalizeNfcDeep } from "@ozdna/provenance-schema";
import type { LookupOutcome, ProviderRecord } from "@ozdna/source-verification";
import { sha256Bytes } from "./recorder.js";

export const SNAPSHOT_SCHEMA = "ozdna.source.snapshot/v1";
const RW = "retraction-watch";
const enc = new TextEncoder();

export interface Snapshot {
  readonly provider: "crossref" | "datacite" | "doi_ra";
  readonly canonical: string;
  readonly sha256: string;
  readonly response_sha256: string;
}

async function hashJson(value: unknown): Promise<string> {
  return sha256Bytes(enc.encode(canonicalize(normalizeNfcDeep(value))));
}

async function snapshotUpdates(record: ProviderRecord) {
  const out = [];
  for (const u of record.updates) {
    out.push(
      u.source === RW
        ? { source: RW, entry_sha256: await hashJson({ type: u.type, notice_doi: u.notice_doi }) }
        : { source: u.source, type: u.type, notice_doi: u.notice_doi },
    );
  }
  return out;
}

/** Snapshot of a provider outcome, or null when there is nothing a provider said. */
export async function snapshotOf(
  doi: string,
  lookup: LookupOutcome | null,
): Promise<Snapshot | null> {
  if (lookup === null) return null;
  let body: Record<string, unknown>;
  let provider: Snapshot["provider"];
  let responseSha: string | null;
  if (lookup.kind === "found") {
    const r = lookup.record;
    provider = r.provider;
    responseSha = r.response_sha256;
    body = {
      schema: SNAPSHOT_SCHEMA,
      outcome: "found",
      provider,
      doi: r.doi,
      title: r.title,
      family_names: [...r.family_names],
      year: r.year,
      container: r.container,
      integrity_signal: r.integrity_signal,
      updates: await snapshotUpdates(r),
      response_sha256: r.response_sha256,
    };
  } else if (lookup.kind === "not_found") {
    provider = lookup.provider ?? "doi_ra";
    responseSha = lookup.response_sha256;
    body = {
      schema: SNAPSHOT_SCHEMA,
      outcome: "not_found",
      provider,
      doi,
      response_sha256: responseSha,
    };
  } else {
    return null; // unavailable: no provider answer to snapshot
  }
  if (responseSha === null) return null;
  const canonical = canonicalize(normalizeNfcDeep(body));
  return {
    provider,
    canonical,
    sha256: await sha256Bytes(enc.encode(canonical)),
    response_sha256: responseSha,
  };
}

function isRwEntry(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && (v as Record<string, unknown>).source === RW;
}

/**
 * Replace Retraction Watch-sourced entries in a Crossref work record's `updated-by` /
 * `update-to` arrays with {source, entry_sha256}. Returns null when nothing was redacted (the
 * original bytes are stored unchanged) or the bytes are not a JSON object.
 */
export async function redactRetractionWatch(bytes: Uint8Array): Promise<Uint8Array | null> {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    return null;
  }
  const message = (json as { message?: unknown } | null)?.message;
  if (typeof message !== "object" || message === null) return null;
  let redacted = 0;
  const m = message as Record<string, unknown>;
  for (const key of ["updated-by", "update-to"]) {
    const list = m[key];
    if (!Array.isArray(list)) continue;
    const next = [];
    for (const entry of list) {
      if (isRwEntry(entry)) {
        redacted++;
        next.push({
          source: RW,
          entry_sha256: await sha256Bytes(enc.encode(JSON.stringify(entry))),
        });
      } else {
        next.push(entry);
      }
    }
    m[key] = next;
  }
  if (redacted === 0) return null;
  return enc.encode(JSON.stringify(json));
}
