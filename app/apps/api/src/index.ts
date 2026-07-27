// ozDNA API Worker (Hono). Wires the pure route handlers to real bindings, applies the one
// error envelope (plan/04 §4.5), and stamps X-Request-Id on every response. Route business
// logic lives in src/routes/* (pure, repo-injected); this file is the edge only.

import { type Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ApiError, badRequest, forbidden, notFound, toErrorBody } from "./errors.js";
import type { Env } from "./env.js";
import type { RouteDeps, RouteResult } from "./http.js";
import { D1Repo } from "./repo/d1.js";
import { handleVerifyByHash, handleVerifyByPhash, type VerifyUrls } from "./routes/verify.js";
import { handleWaitlist } from "./routes/waitlist.js";

type Vars = { requestId: string };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const deps: RouteDeps = {
  now: () => new Date().toISOString(),
  newToken: () => crypto.randomUUID(),
};

const urlsFrom = (env: Env): VerifyUrls => ({ siteBase: env.PUBLIC_SITE_BASE, apiBase: env.PUBLIC_API_BASE });

/** Stamp a request id on context + response, so it can be echoed in errors and logs (§4.5). */
app.use("*", async (c, next) => {
  const id = `req_${crypto.randomUUID().replace(/-/g, "")}`;
  c.set("requestId", id);
  await next();
  c.header("X-Request-Id", id);
});

const send = (c: Context<{ Bindings: Env; Variables: Vars }>, r: RouteResult) => {
  if (r.headers) for (const [k, v] of Object.entries(r.headers)) c.header(k, v);
  return c.json(r.body as object, r.status as ContentfulStatusCode);
};

/** Cloudflare Turnstile server-side check (§7). Skipped only when no secret is bound (dev). */
async function assertTurnstile(env: Env, token: string | undefined, ip: string | null): Promise<void> {
  if (!env.TURNSTILE_SECRET) return; // local dev: no secret bound
  if (!token) throw forbidden("turnstile_required", "Turnstile token required");
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const out = (await res.json()) as { success?: boolean };
  if (!out.success) throw forbidden("turnstile_required", "Turnstile verification failed");
}

app.get("/", (c) => c.json({ service: "ozdna-api", status: "ok" }));

app.post("/v1/waitlist", async (c) => {
  const body = (await c.req.json().catch(() => {
    throw badRequest("missing_field", "request body must be JSON");
  })) as Record<string, unknown>;
  await assertTurnstile(c.env, typeof body.turnstile_token === "string" ? body.turnstile_token : undefined, c.req.header("CF-Connecting-IP") ?? null);
  const result = await handleWaitlist(body, new D1Repo(c.env.DB), deps);
  return send(c, result);
});

app.get("/v1/verify", async (c) => {
  const hash = c.req.query("hash");
  const phash = c.req.query("phash");
  const repo = new D1Repo(c.env.DB);
  const urls = urlsFrom(c.env);
  if (hash) return send(c, await handleVerifyByHash(hash, repo, urls));
  if (phash) {
    const md = c.req.query("max_distance");
    const maxDistance = md === undefined ? undefined : Number(md);
    return send(c, await handleVerifyByPhash(phash, maxDistance, repo, urls));
  }
  throw badRequest("missing_field", "provide ?hash=<sha256> or ?phash=<16 hex>");
});

app.onError((err, c) => {
  const requestId = c.get("requestId") ?? "req_unknown";
  const apiErr = err instanceof ApiError ? err : new ApiError(500, "internal", "Internal server error");
  const body = toErrorBody(apiErr, requestId, c.env.PUBLIC_SITE_BASE);
  c.header("X-Request-Id", requestId);
  return c.json(body, apiErr.status as 500);
});

app.notFound((c) => {
  const requestId = c.get("requestId") ?? "req_unknown";
  const err = notFound("not_found_error", `no route for ${c.req.method} ${new URL(c.req.url).pathname}`);
  return c.json(toErrorBody(err, requestId, c.env.PUBLIC_SITE_BASE), 404);
});

export default app;
