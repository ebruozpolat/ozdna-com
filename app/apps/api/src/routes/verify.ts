// GET /v1/verify (plan/04-MVP-SPEC.md §4.2/§4.4). Public, no key. Two query modes:
//   ?hash=<64 hex sha256>                 → exact-fingerprint lookup
//   ?phash=<16 hex>[&max_distance=0..10]  → perceptual multi-index lookup (03 §2)
// The verdict VOCABULARY + copy + thresholds are owned by dna-core (plan/03 §6.3/§1.5); this
// route only maps repo results onto them and shapes the §4.4 JSON. It defines no verdict of
// its own and softens no string.

import {
  bandsFromHex,
  classifyPerceptual,
  exactVerdict,
  hammingU64,
  THRESHOLDS,
  toMatchProjection,
  VERDICT_COPY,
  VERDICT_FOOTER,
  type Verdict,
} from "@ozdna/dna-core";
import { badRequest } from "../errors.js";
import type { RouteResult } from "../http.js";
import type { AnchorInfo, RecordRow, Repo } from "../repo/types.js";

/** Base URLs for building public record + proof links (§4.4). */
export interface VerifyUrls {
  readonly siteBase: string; // e.g. https://ozdna.com  → /r/{id}
  readonly apiBase: string; // e.g. https://api.ozdna.com → /v1/anchors/{batch}/proof/{id}
}

const HEX64 = /^[0-9a-f]{64}$/i;
const HEX16 = /^[0-9a-f]{16}$/i;

/** Outer match ceiling is d ≤ 10 (03 §2.2 pigeonhole r=2). 11–12 is the NEAR list, deferred. */
const MAX_DISTANCE_CEILING = THRESHOLDS.probableMax; // 10

function recordView(r: RecordRow, urls: VerifyUrls) {
  return {
    id: r.id,
    kind: r.kind,
    created_at: r.createdAt,
    status: r.status,
    moderation_status: r.moderationStatus,
    record_url: `${urls.siteBase}/r/${r.id}`,
  };
}

function anchorView(a: AnchorInfo, recordId: string, urls: VerifyUrls) {
  return {
    status: a.status,
    chain: a.chain,
    tx_hash: a.txHash,
    anchored_at: a.confirmedAt,
    proof_url: `${urls.apiBase}/v1/anchors/${a.batchId}/proof/${recordId}`,
  };
}

interface MatchOpts {
  readonly verdict: Verdict;
  readonly hammingDistance: number | null;
  readonly records: readonly RecordRow[];
  readonly showAsMatch?: boolean;
  readonly pdqConfirmed?: boolean | null;
}

function buildMatch(opts: MatchOpts, urls: VerifyUrls) {
  const proj = toMatchProjection(opts.verdict);
  const match: Record<string, unknown> = {
    verdict: opts.verdict,
    headline: VERDICT_COPY[opts.verdict].headline,
    match_type: proj.matchType,
    confidence: proj.confidence,
    hamming_distance: opts.hammingDistance,
    records: opts.records.map((r) => recordView(r, urls)),
    footer: VERDICT_FOOTER,
  };
  // Perceptual nuance (§1.5): a PROBABLE hit without a confirming PDQ is "similar, unconfirmed".
  if (opts.showAsMatch !== undefined) match.show_as_match = opts.showAsMatch;
  if (opts.pdqConfirmed !== undefined) match.pdq_confirmed = opts.pdqConfirmed;
  return match;
}

export async function handleVerifyByHash(sha256Raw: string, repo: Repo, urls: VerifyUrls): Promise<RouteResult> {
  const sha256 = sha256Raw.toLowerCase();
  if (!HEX64.test(sha256)) throw badRequest("invalid_hash_format", "hash must be 64 hex characters (SHA-256)");

  const rows = await repo.findRecordsBySha256(sha256);
  const query = { method: "hash", sha256 };

  if (rows.length === 0) {
    return { status: 200, body: { query, match: buildMatch({ verdict: "NO_RECORD", hammingDistance: null, records: [] }, urls) } };
  }

  const primary = rows[0]!;
  const anchor = await repo.getAnchorForRecord(primary);
  const verdict = exactVerdict(anchor?.status === "confirmed");
  const body: Record<string, unknown> = {
    query,
    match: buildMatch({ verdict, hammingDistance: 0, records: rows.slice(0, 5) }, urls),
  };
  if (anchor) body.anchor = anchorView(anchor, primary.id, urls);
  return { status: 200, body };
}

export async function handleVerifyByPhash(
  phashRaw: string,
  maxDistanceRaw: number | undefined,
  repo: Repo,
  urls: VerifyUrls,
): Promise<RouteResult> {
  const phash = phashRaw.toLowerCase();
  if (!HEX16.test(phash)) throw badRequest("invalid_hash_format", "phash must be 16 hex characters (64-bit)");

  let maxDistance = maxDistanceRaw ?? 7; // 03 §2 default search is complete for d ≤ 7
  if (!Number.isInteger(maxDistance) || maxDistance < 0) {
    throw badRequest("invalid_request_error", "max_distance must be a non-negative integer");
  }
  if (maxDistance > MAX_DISTANCE_CEILING) maxDistance = MAX_DISTANCE_CEILING;

  const b = bandsFromHex(phash);
  const radius = maxDistance <= 3 ? 0 : maxDistance <= 7 ? 1 : 2; // pigeonhole probe radius (§2.2)
  const queryU = BigInt(`0x${phash}`);

  const candidates = await repo.findRecordCandidatesByBands([b.band0, b.band1, b.band2, b.band3], radius);
  const scored = candidates
    .map((c) => ({ c, d: hammingU64(queryU, c.phash64) }))
    .filter((x) => x.d <= maxDistance)
    .sort((a, z) => a.d - z.d)
    .slice(0, 5);

  const query = { method: "phash", phash, max_distance: maxDistance };

  if (scored.length === 0) {
    return { status: 200, body: { query, match: buildMatch({ verdict: "NO_RECORD", hammingDistance: null, records: [] }, urls) } };
  }

  const best = scored[0]!;
  // No query-side PDQ in GET mode, so PDQ confirmation is absent (null) — PROBABLE stays
  // "similar, unconfirmed" per §1.5 (showAsMatch=false without a passing PDQ).
  const cls = classifyPerceptual(best.d, null);
  const anchor = await repo.getAnchorForRecord(best.c);
  const body: Record<string, unknown> = {
    query,
    match: buildMatch(
      {
        verdict: cls.verdict,
        hammingDistance: best.d,
        records: scored.map((s) => s.c),
        showAsMatch: cls.showAsMatch,
        pdqConfirmed: cls.pdqConfirmed,
      },
      urls,
    ),
  };
  if (anchor) body.anchor = anchorView(anchor, best.c.id, urls);
  return { status: 200, body };
}
