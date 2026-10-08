// The only way an adapter talks to the network. Fixed host allow-list (SSRF), HTTPS only, no
// redirects, timeout, response-size cap, content-type check, strict UTF-8 and JSON. The fetch
// implementation is injected; tests pass a fake, so CI never touches the network.

export const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "api.crossref.org",
  "api.datacite.org",
  "doi.org",
]);

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_BYTES = 1024 * 1024;

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type HttpErrorCode =
  | "HOST_NOT_ALLOWED"
  | "TIMEOUT"
  | "NETWORK"
  | "REDIRECT_REFUSED"
  | "HTTP_STATUS"
  | "BAD_CONTENT_TYPE"
  | "TOO_LARGE"
  | "MALFORMED";

export class ProviderHttpError extends Error {
  constructor(
    readonly code: HttpErrorCode,
    readonly status: number | null,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "ProviderHttpError";
  }
}

export interface FetchJsonOptions {
  readonly fetch: FetchLike;
  readonly userAgent: string;
  readonly accept: readonly string[];
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  /** Statuses returned to the caller instead of thrown (e.g. 404). */
  readonly passStatuses?: readonly number[];
}

export interface FetchJsonResult {
  readonly status: number;
  /** Parsed JSON for 2xx; null for a passed-through status. */
  readonly json: unknown;
  /** SHA-256 hex of the exact response bytes (stored as provider_response_sha256). */
  readonly sha256: string;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource));
  let out = "";
  for (const b of d) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Throws unless `url` is https on an allow-listed host with no credentials or port. */
export function assertAllowedUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ProviderHttpError("HOST_NOT_ALLOWED", null, "invalid URL");
  }
  if (
    u.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(u.hostname) ||
    u.username ||
    u.password ||
    u.port
  ) {
    throw new ProviderHttpError("HOST_NOT_ALLOWED", null, `host ${u.hostname} is not allowed`);
  }
  return u;
}

async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > max)
    throw new ProviderHttpError("TOO_LARGE", res.status, `declared ${declared} bytes`);
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
      throw new ProviderHttpError("TOO_LARGE", res.status, `response exceeds ${max} bytes`);
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

export async function fetchJson(url: string, opts: FetchJsonOptions): Promise<FetchJsonResult> {
  const u = assertAllowedUrl(url);
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    let res: Response;
    try {
      res = await Promise.race([
        opts.fetch(u.toString(), {
          method: "GET",
          redirect: "manual",
          headers: { Accept: opts.accept.join(", "), "User-Agent": opts.userAgent },
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener("abort", () =>
            reject(new ProviderHttpError("TIMEOUT", null, `no response in ${timeoutMs} ms`)),
          ),
        ),
      ]);
    } catch (e) {
      if (e instanceof ProviderHttpError) throw e;
      if (timedOut) throw new ProviderHttpError("TIMEOUT", null, `no response in ${timeoutMs} ms`);
      throw new ProviderHttpError("NETWORK", null, "request failed");
    }

    if (res.status >= 300 && res.status < 400) {
      throw new ProviderHttpError("REDIRECT_REFUSED", res.status, "redirects are not followed");
    }
    const max = opts.maxBytes ?? DEFAULT_MAX_BYTES;
    if (opts.passStatuses?.includes(res.status)) {
      const bytes = await readCapped(res, max);
      return { status: res.status, json: null, sha256: await sha256Hex(bytes) };
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ProviderHttpError("HTTP_STATUS", res.status, `HTTP ${res.status}`);
    }
    const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!opts.accept.includes(type)) {
      throw new ProviderHttpError(
        "BAD_CONTENT_TYPE",
        res.status,
        `unexpected content-type ${type || "(none)"}`,
      );
    }
    const bytes = await readCapped(res, max);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    } catch {
      throw new ProviderHttpError("MALFORMED", res.status, "response is not UTF-8");
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ProviderHttpError("MALFORMED", res.status, "response is not JSON");
    }
    return { status: res.status, json, sha256: await sha256Hex(bytes) };
  } finally {
    clearTimeout(timer);
  }
}
