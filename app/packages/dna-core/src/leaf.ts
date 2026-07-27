// Canonical record serialization — the Merkle leaf preimage.
// Normative per plan/03-ALGORITHMS.md §3.2. Fixed newline-delimited template (no JSON
// canonicalization edge cases), trivially reproducible by any independent verifier.
//
//   leaf_preimage (UTF-8) =
//     "ozdna.v1"          "\n"
//     id                  "\n"   -- prefixed ULID, e.g. rec_01JZ…
//     sha256_hex          "\n"   -- 64 lowercase hex
//     phash64_hex         "\n"   -- 16 lowercase hex (unsigned)
//     pdq256_hex          "\n"   -- 64 lowercase hex, or "" if absent
//     manifest_sha256_hex "\n"   -- 64 lowercase hex, or "" if absent
//     account_id          "\n"
//     registered_at       "\n"   -- ISO 8601 UTC with ms, e.g. 2026-10-14T09:31:02.417Z

import { utf8 } from "./sha256.js";

export interface LeafRecord {
  readonly id: string;
  readonly sha256Hex: string;
  readonly phash64Hex: string;
  readonly pdq256Hex?: string | null;
  readonly manifestSha256Hex?: string | null;
  readonly accountId: string;
  readonly registeredAt: string;
}

export const LEAF_VERSION = "ozdna.v1" as const;

/** Build the exact UTF-8 leaf preimage bytes for a record (§3.2). */
export function leafPreimage(r: LeafRecord): Uint8Array {
  const lines = [
    LEAF_VERSION,
    r.id,
    r.sha256Hex,
    r.phash64Hex,
    r.pdq256Hex ?? "",
    r.manifestSha256Hex ?? "",
    r.accountId,
    r.registeredAt,
  ];
  // trailing "\n" after every field, including the last (template has "\n" per line)
  return utf8(`${lines.join("\n")}\n`);
}
