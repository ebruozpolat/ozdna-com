// Wraps the provider fetch to keep a copy of each response's bytes (so the raw payload can be
// stored by reference) and to record which providers were contacted and how they answered.
// The adapters' own checks (host allow-list, timeout, size cap, content type) still apply:
// this wrapper sits underneath them and never relaxes them.

import { DEFAULT_MAX_BYTES, type FetchLike } from "@ozdna/source-verification";

export type ProviderName = "doi_ra" | "crossref" | "datacite";

const PROVIDER_BY_HOST: Readonly<Record<string, ProviderName>> = {
  "doi.org": "doi_ra",
  "api.crossref.org": "crossref",
  "api.datacite.org": "datacite",
};

export interface RecordedCall {
  readonly provider: ProviderName | null;
  readonly status: number | null;
  readonly sha256: string | null;
  /** Response bytes, kept only up to the adapters' size cap. */
  readonly bytes: Uint8Array | null;
  readonly failed: boolean;
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource));
  let out = "";
  for (const b of d) out += b.toString(16).padStart(2, "0");
  return out;
}

async function readUpTo(res: Response, max: number): Promise<Uint8Array | null> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export function recordingFetch(base: FetchLike): {
  fetch: FetchLike;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fetch: FetchLike = async (input, init) => {
    let host = "";
    try {
      host = new URL(input).hostname;
    } catch {}
    const provider = PROVIDER_BY_HOST[host] ?? null;
    let res: Response;
    try {
      res = await base(input, init);
    } catch (e) {
      calls.push({ provider, status: null, sha256: null, bytes: null, failed: true });
      throw e;
    }
    const bytes = await readUpTo(res, DEFAULT_MAX_BYTES + 1);
    if (bytes === null) {
      // Over the cap: hand the adapter a body that is still too large so it fails closed.
      calls.push({ provider, status: res.status, sha256: null, bytes: null, failed: false });
      return new Response(new Uint8Array(DEFAULT_MAX_BYTES + 1), {
        status: res.status,
        headers: res.headers,
      });
    }
    calls.push({
      provider,
      status: res.status,
      sha256: await sha256Bytes(bytes),
      bytes,
      failed: false,
    });
    return new Response(bytes, { status: res.status, headers: res.headers });
  };
  return { fetch, calls };
}
