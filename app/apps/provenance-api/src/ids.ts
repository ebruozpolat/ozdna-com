// Random identifiers and secrets (CSPRNG, unbiased base62).

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** n unbiased base62 characters from crypto.getRandomValues (rejection sampling). */
export function randomBase62(n: number): string {
  let out = "";
  while (out.length < n) {
    const buf = crypto.getRandomValues(new Uint8Array(n * 2));
    for (const b of buf) {
      if (b < 248) out += ALPHABET[b % 62]; // 248 = 62 * 4: no modulo bias
      if (out.length === n) break;
    }
  }
  return out;
}

/** Prefixed id, e.g. prj_…, evt_…; 26 chars ≈ 154 bits. Matches provenance-schema prefixedId. */
export function newId(
  prefix: "ten" | "skey" | "svc" | "prj" | "art" | "evt" | "src" | "snp" | "svr",
): string {
  return `${prefix}_${randomBase62(26)}`;
}

/** New service-key secret. Shown once; only its SHA-256 is stored. */
export function newServiceKeySecret(): string {
  return `ozp_${randomBase62(40)}`;
}
