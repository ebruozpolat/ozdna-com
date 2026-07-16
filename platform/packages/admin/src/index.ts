import { eq, and } from "drizzle-orm";
import { ERRORS, generateId, type ApiContext, type KeyEnvironment } from "@ozdna/core";
import {
  getDb,
  organizations,
  workspaces,
  projects,
  apiKeys,
} from "@ozdna/db";
import { generateRawKey, hashApiKey } from "@ozdna/auth";

function assertOrgScope(ctx: ApiContext, orgId: string, requestId: string): void {
  if (ctx.orgId !== orgId) {
    throw ERRORS.forbidden("Access denied to this organization", requestId);
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "workspace";
}

export function getOrganization(orgId: string, ctx: ApiContext, requestId: string) {
  assertOrgScope(ctx, orgId, requestId);
  const db = getDb();
  const org = db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  if (!org) throw ERRORS.notFound("Organization not found", requestId);
  return {
    id: org.id,
    name: org.name,
    plan: org.plan,
    created_at: org.createdAt.toISOString(),
  };
}

export function updateOrganization(
  orgId: string,
  ctx: ApiContext,
  requestId: string,
  body: { name?: string },
) {
  assertOrgScope(ctx, orgId, requestId);
  if (!body.name?.trim()) throw ERRORS.invalidRequest("Missing field: name", requestId);
  const db = getDb();
  db.update(organizations).set({ name: body.name.trim() }).where(eq(organizations.id, orgId)).run();
  return getOrganization(orgId, ctx, requestId);
}

export function listWorkspaces(orgId: string, ctx: ApiContext, requestId: string) {
  assertOrgScope(ctx, orgId, requestId);
  const db = getDb();
  const rows = db.select().from(workspaces).where(eq(workspaces.orgId, orgId)).all();
  return {
    workspaces: rows.map((w) => ({
      id: w.id,
      org_id: w.orgId,
      name: w.name,
      slug: w.slug,
      created_at: w.createdAt.toISOString(),
    })),
  };
}

export function createWorkspace(
  orgId: string,
  ctx: ApiContext,
  requestId: string,
  body: { name?: string; slug?: string },
) {
  assertOrgScope(ctx, orgId, requestId);
  if (!body.name?.trim()) throw ERRORS.invalidRequest("Missing field: name", requestId);
  const now = new Date();
  const row = {
    id: generateId("ws"),
    orgId,
    name: body.name.trim(),
    slug: body.slug?.trim() || slugify(body.name),
    createdAt: now,
  };
  getDb().insert(workspaces).values(row).run();
  return {
    id: row.id,
    org_id: row.orgId,
    name: row.name,
    slug: row.slug,
    created_at: row.createdAt.toISOString(),
  };
}

function getWorkspaceInOrg(workspaceId: string, orgId: string, requestId: string) {
  const db = getDb();
  const ws = db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.orgId, orgId)))
    .get();
  if (!ws) throw ERRORS.notFound("Workspace not found", requestId);
  return ws;
}

export function listProjects(workspaceId: string, ctx: ApiContext, requestId: string) {
  getWorkspaceInOrg(workspaceId, ctx.orgId, requestId);
  const db = getDb();
  const rows = db
    .select()
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.orgId, ctx.orgId)))
    .all();
  return {
    projects: rows.map((p) => ({
      id: p.id,
      org_id: p.orgId,
      workspace_id: p.workspaceId,
      name: p.name,
      created_at: p.createdAt.toISOString(),
    })),
  };
}

export function createProject(
  workspaceId: string,
  ctx: ApiContext,
  requestId: string,
  body: { name?: string },
) {
  getWorkspaceInOrg(workspaceId, ctx.orgId, requestId);
  if (!body.name?.trim()) throw ERRORS.invalidRequest("Missing field: name", requestId);
  const now = new Date();
  const row = {
    id: generateId("proj"),
    orgId: ctx.orgId,
    workspaceId,
    name: body.name.trim(),
    createdAt: now,
  };
  getDb().insert(projects).values(row).run();
  return {
    id: row.id,
    org_id: row.orgId,
    workspace_id: row.workspaceId,
    name: row.name,
    created_at: row.createdAt.toISOString(),
  };
}

function getProjectInOrg(projectId: string, orgId: string, requestId: string) {
  const db = getDb();
  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
    .get();
  if (!project) throw ERRORS.notFound("Project not found", requestId);
  return project;
}

function assertProjectScope(projectId: string, ctx: ApiContext, requestId: string): void {
  getProjectInOrg(projectId, ctx.orgId, requestId);
  if (ctx.projectId !== projectId) {
    throw ERRORS.forbidden("Access denied to this project", requestId);
  }
}

export function listApiKeys(projectId: string, ctx: ApiContext, requestId: string) {
  assertProjectScope(projectId, ctx, requestId);
  const db = getDb();
  const rows = db.select().from(apiKeys).where(eq(apiKeys.projectId, projectId)).all();
  return {
    keys: rows.map((k) => ({
      id: k.id,
      project_id: k.projectId,
      org_id: k.orgId,
      name: k.name,
      key_prefix: k.keyPrefix,
      environment: k.environment,
      rate_limit_per_min: k.rateLimitPerMin,
      monthly_quota: k.monthlyQuota,
      active: k.active,
      created_at: k.createdAt.toISOString(),
      last_used_at: k.lastUsedAt?.toISOString() ?? null,
    })),
  };
}

export function createProjectApiKey(
  projectId: string,
  ctx: ApiContext,
  requestId: string,
  body: { name?: string; environment?: string },
) {
  assertProjectScope(projectId, ctx, requestId);
  if (!body.name?.trim()) throw ERRORS.invalidRequest("Missing field: name", requestId);
  const env: KeyEnvironment = body.environment === "live" ? "live" : "test";
  const rawKey = generateRawKey(env);
  const now = new Date();
  const id = generateId("key");
  getDb()
    .insert(apiKeys)
    .values({
      id,
      projectId,
      orgId: ctx.orgId,
      name: body.name.trim(),
      keyHash: hashApiKey(rawKey),
      keyPrefix: rawKey.slice(0, 20),
      environment: env,
      rateLimitPerMin: env === "live" ? 60 : 10,
      monthlyQuota: env === "live" ? 100_000 : 10_000,
      active: true,
      createdAt: now,
    })
    .run();

  return {
    id,
    project_id: projectId,
    name: body.name.trim(),
    environment: env,
    key: rawKey,
    key_prefix: rawKey.slice(0, 20),
    created_at: now.toISOString(),
    warning: "Store this key securely — it is shown only once.",
  };
}

export function revokeProjectApiKey(
  projectId: string,
  keyId: string,
  ctx: ApiContext,
  requestId: string,
) {
  assertProjectScope(projectId, ctx, requestId);
  const db = getDb();
  const key = db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.projectId, projectId)))
    .get();
  if (!key) throw ERRORS.notFound("API key not found", requestId);
  if (key.id === ctx.apiKeyId) {
    throw ERRORS.invalidRequest("Cannot revoke the key used for this request", requestId);
  }
  db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, keyId)).run();
  return { id: keyId, active: false, revoked_at: new Date().toISOString() };
}
