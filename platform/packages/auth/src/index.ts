import { createHash, randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { ERRORS, type ApiContext, type KeyEnvironment, type PlanTier } from "@ozdna/core";
import { getDb, apiKeys, organizations } from "@ozdna/db";

export interface ValidatedKey {
  context: ApiContext;
  rateLimitPerMin: number;
  monthlyQuota: number;
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function parseBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token.startsWith("ozdna_sk_")) return null;
  return token;
}

export function validateApiKey(rawKey: string, requestId: string): ValidatedKey {
  const db = getDb();
  const hash = hashKey(rawKey);

  const rows = db
    .select({ key: apiKeys, org: organizations })
    .from(apiKeys)
    .innerJoin(organizations, eq(apiKeys.orgId, organizations.id))
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.active, true)))
    .limit(1)
    .all();

  const row = rows[0];
  if (!row) throw ERRORS.unauthorized(requestId);

  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.key.id))
    .run();

  return {
    context: {
      requestId,
      orgId: row.key.orgId,
      projectId: row.key.projectId,
      apiKeyId: row.key.id,
      plan: row.org.plan as PlanTier,
      environment: row.key.environment as KeyEnvironment,
    },
    rateLimitPerMin: row.key.rateLimitPerMin,
    monthlyQuota: row.key.monthlyQuota,
  };
}

export function generateRawKey(environment: KeyEnvironment): string {
  return `ozdna_sk_${environment === "test" ? "test" : "live"}_${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(rawKey: string): string {
  return hashKey(rawKey);
}
