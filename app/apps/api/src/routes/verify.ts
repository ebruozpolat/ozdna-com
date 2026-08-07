import {
  allBandProbes,
  bandsFromHex,
  exactVerdict,
  hashToHex,
  pickBestMatch,
  scorePerceptualCandidates,
  toHex,
  toUnsignedU64,
} from "@ozdna/dna-core";
import { Hono } from "hono";
import type { Env } from "../env.js";

const HEX64 = /^[0-9a-fA-F]{64}$/;
const HEX16 = /^[0-9a-fA-F]{16}$/;

export const verifyRoutes = new Hono<{ Bindings: Env }>();

type RecordRow = {
  id: string;
  sha256: string;
  phash64: number;
  pdq256: ArrayBuffer | null;
  status: string;
  created_at: string;
  anchored_at: string | null;
  creator_display: string | null;
};

function pdqBlobToBytes(blob: ArrayBuffer | null): Uint8Array | null {
  if (!blob) return null;
  const u = new Uint8Array(blob);
  return u.byteLength === 32 ? u : null;
}

function recordPublic(row: RecordRow) {
  const pdq = pdqBlobToBytes(row.pdq256);
  return {
    id: row.id,
    sha256: row.sha256,
    phash64: row.phash64,
    phash: hashToHex(toUnsignedU64(BigInt(row.phash64))),
    pdq256: pdq ? toHex(pdq) : null,
    status: row.status,
    createdAt: row.created_at,
    anchoredAt: row.anchored_at,
    creatorDisplay: row.creator_display,
  };
}

/**
 * GET /v1/verify?hash=… — exact SHA-256
 * GET /v1/verify?phash=…&pdq=…&deep=0|1 — perceptual (plan/03 §2.4)
 * Free tier: stages 0–2 (r≤1). deep=1 → stage 3 (r=2).
 */
verifyRoutes.get("/verify", async (c) => {
  const hash = (c.req.query("hash") ?? "").trim().toLowerCase();
  const phash = (c.req.query("phash") ?? "").trim().toLowerCase();
  const pdqHex = (c.req.query("pdq") ?? "").trim().toLowerCase();
  const deep = c.req.query("deep") === "1" || c.req.query("deep") === "true";

  if (hash) {
    if (!HEX64.test(hash)) {
      return c.json(
        { error: "invalid_hash", message: "hash must be 64 hex chars (sha-256)." },
        400,
      );
    }
    const row = await c.env.DB.prepare(
      `SELECT r.id, r.sha256, r.phash64, r.pdq256, r.status, r.created_at, r.anchored_at,
              u.display_name AS creator_display
       FROM records r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.sha256 = ? AND r.is_test = 0
       LIMIT 1`,
    )
      .bind(hash)
      .first<RecordRow>();

    if (!row) {
      return c.json({ verdict: "NO_RECORD", match_type: "none", hash, record: null });
    }

    const verdict = exactVerdict(row.status === "anchored");
    return c.json({
      verdict,
      match_type: "exact",
      confidence: "exact",
      hash,
      record: recordPublic(row),
    });
  }

  if (!phash) {
    return c.json(
      {
        error: "validation_error",
        message: "Provide hash= (sha256) or phash= (16 hex) for perceptual verify.",
      },
      400,
    );
  }
  if (!HEX16.test(phash)) {
    return c.json({ error: "invalid_phash", message: "phash must be 16 hex chars." }, 400);
  }
  if (pdqHex && !HEX64.test(pdqHex)) {
    return c.json(
      { error: "invalid_pdq", message: "pdq must be 64 hex chars when provided." },
      400,
    );
  }

  const queryU64 = BigInt(`0x${phash}`);
  const bands = bandsFromHex(phash);
  const radius = deep ? 2 : 1;
  const probes = allBandProbes(bands, radius as 0 | 1 | 2);

  // Inline literals (03 §2.4) — integers 0..65535, no injection surface.
  const inList = (vals: number[]) => vals.join(",");
  const sql = `
    SELECT r.id, r.sha256, r.phash64, r.pdq256, r.status, r.created_at, r.anchored_at,
           u.display_name AS creator_display
    FROM records r
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.is_test = 0 AND (
      r.band0 IN (${inList(probes.band0)})
      OR r.band1 IN (${inList(probes.band1)})
      OR r.band2 IN (${inList(probes.band2)})
      OR r.band3 IN (${inList(probes.band3)})
    )`;

  const result = await c.env.DB.prepare(sql).all<RecordRow>();
  const rows = result.results ?? [];

  // Dedupe by id
  const byId = new Map<string, RecordRow>();
  for (const r of rows) byId.set(r.id, r);

  const queryPdq = pdqHex
    ? Uint8Array.from(pdqHex.match(/.{2}/g)!.map((h) => Number.parseInt(h, 16)))
    : null;

  const scored = scorePerceptualCandidates(
    queryU64,
    [...byId.values()].map((r) => ({
      id: r.id,
      phash64: r.phash64,
      pdq256: pdqBlobToBytes(r.pdq256),
    })),
    queryPdq,
  );

  const { best, nearMisses } = pickBestMatch(scored);
  if (!best || best.classification.verdict === "NO_RECORD") {
    return c.json({
      verdict: "NO_RECORD",
      match_type: "none",
      phash,
      pdq: pdqHex || null,
      deep,
      record: null,
      near_misses: nearMisses.slice(0, 5).map((n) => ({
        id: n.id,
        phash_distance: n.phashDistance,
        pdq_distance: n.pdqDistance,
      })),
    });
  }

  const row = byId.get(best.id)!;
  const cls = best.classification;
  // Probable without PDQ confirm → similar, unconfirmed (still return the lead)
  const showMatch = cls.showAsMatch;
  const projection = showMatch
    ? {
        match_type: "perceptual" as const,
        confidence: cls.verdict === "VISUAL_MATCH_HIGH" ? ("high" as const) : ("medium" as const),
      }
    : { match_type: "none" as const, confidence: null };

  return c.json({
    verdict: cls.verdict,
    ...projection,
    phash,
    pdq: pdqHex || null,
    deep,
    phash_distance: best.phashDistance,
    pdq_distance: best.pdqDistance,
    pdq_confirmed: cls.pdqConfirmed,
    show_as_match: showMatch,
    record: recordPublic(row),
    near_misses: nearMisses.slice(0, 5).map((n) => ({
      id: n.id,
      phash_distance: n.phashDistance,
      pdq_distance: n.pdqDistance,
    })),
  });
});
