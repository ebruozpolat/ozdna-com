import { readFileSync } from "node:fs";
import type { FetchLike } from "../src/http.js";

export const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

export interface Route {
  status?: number;
  body: string | Uint8Array;
  contentType?: string;
  headers?: Record<string, string>;
}

export interface Call {
  url: string;
  init: RequestInit;
}

/** Fake fetch: routes by "host + path" prefix; unknown URLs fail the test loudly. */
export function fakeFetch(routes: Record<string, Route | (() => Promise<Response>)>): {
  fetch: FetchLike;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const u = new URL(url);
    const key = Object.keys(routes).find((k) => `${u.hostname}${u.pathname}`.startsWith(k));
    if (!key) throw new Error(`fake fetch: no route for ${url}`);
    const r = routes[key]!;
    if (typeof r === "function") return r();
    return new Response(r.body as BodyInit, {
      status: r.status ?? 200,
      headers: { "content-type": r.contentType ?? "application/json", ...(r.headers ?? {}) },
    });
  };
  return { fetch, calls };
}

export const ra = (doi: string, agency: string): Route => ({
  body: JSON.stringify([{ DOI: doi, RA: agency }]),
});

export const CONTACT = "provenance-tests@ozdna.example";
