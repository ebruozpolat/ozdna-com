import type { FetchLike } from "../http.js";

/** Everything an adapter needs; nothing is read from globals or the environment. */
export interface AdapterContext {
  readonly fetch: FetchLike;
  /** Monitored contact address for Crossref/DataCite identification (ADR-004 §3). Required. */
  readonly contactEmail: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;

export function validContactEmail(email: unknown): email is string {
  return typeof email === "string" && EMAIL.test(email);
}

export function userAgent(ctx: AdapterContext): string {
  return `ozDNA-research-provenance/0.4 (mailto:${ctx.contactEmail})`;
}

/** Path-encode a normalised DOI for a URL path (keeps "/", encodes everything risky). */
export function doiPath(doi: string): string {
  return doi.split("/").map(encodeURIComponent).join("/");
}
