import { SELF } from "cloudflare:test";

export const ADMIN = "test-admin-token";
export const ACTOR = { kind: "person", id: "researcher-1" } as const;
export const T0 = "2026-10-07T10:00:00.000Z";
export const H = (c: string) => c.repeat(64);

let counter = 0;
/** Unique-ish suffix so tests never collide on external_ref or tenant names. */
export function uniq(prefix: string): string {
  counter++;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function api(
  path: string,
  init: {
    method?: string;
    key?: string;
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.key) headers.Authorization = `Bearer ${init.key}`;
  let body: string | undefined;
  if (init.rawBody !== undefined) body = init.rawBody;
  else if (init.body !== undefined) body = JSON.stringify(init.body);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await SELF.fetch(`http://local/v1/provenance${path}`, {
    method: init.method ?? (body !== undefined ? "POST" : "GET"),
    headers,
    ...(body !== undefined ? { body } : {}),
  });
  const text = await res.text();
  return { status: res.status, json: (text ? JSON.parse(text) : null) as any };
}

export async function createTenant(scopes?: string[]) {
  const r = await api("/admin/tenants", {
    headers: { "X-Admin-Token": ADMIN },
    body: { name: uniq("tenant"), ...(scopes ? { scopes } : {}) },
  });
  if (r.status !== 201) throw new Error(`tenant: ${r.status} ${JSON.stringify(r.json)}`);
  return {
    tenantId: r.json.tenant.id as string,
    key: r.json.service_key.key as string,
    serviceId: r.json.service_key.service_id as string,
    keyId: r.json.service_key.id as string,
  };
}

export async function createProject(key: string, externalRef = uniq("ext")) {
  const r = await api("/projects", {
    key,
    body: { external_ref: externalRef, occurred_at: T0, actor: ACTOR },
  });
  if (r.status !== 201) throw new Error(`project: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.project.id as string;
}

export async function createArtifact(key: string, projectId: string, label = "Manuscript v1") {
  const r = await api(`/projects/${projectId}/artifacts`, {
    key,
    body: {
      kind: "manuscript",
      content_sha256: H("a"),
      byte_length: 1234,
      media_type: "application/pdf",
      label,
      occurred_at: T0,
      actor: ACTOR,
    },
  });
  if (r.status !== 201) throw new Error(`artifact: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.artifact.id as string;
}

export function declaredAiBody(tool = "ExampleLLM") {
  return {
    type: "ai.use_declared",
    type_version: 1,
    artifact_id: null,
    payload: { tool, purpose: "editing" },
    occurred_at: T0,
    actor: ACTOR,
  };
}

export function expectErrorShape(json: any) {
  if (
    typeof json?.error !== "string" ||
    typeof json?.code !== "string" ||
    typeof json?.message !== "string"
  ) {
    throw new Error(`bad error shape: ${JSON.stringify(json)}`);
  }
}
