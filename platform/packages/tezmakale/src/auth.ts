import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { ERRORS, generateId } from "@ozdna/core";
import { getDb, tezmakaleAccounts, tezmakaleSessions } from "@ozdna/db";
import { initialTokensForPlan, type TezmakalePlan } from "./config.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface TezmakaleUser {
  id: string;
  email: string;
  name: string;
  plan: TezmakalePlan;
}

export function registerUser(input: {
  email: string;
  password: string;
  name: string;
  requestId?: string;
}): TezmakaleUser {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@") || input.password.length < 8) {
    throw ERRORS.invalidRequest("Valid email and password (min 8 chars) required", input.requestId);
  }

  const existing = db.select().from(tezmakaleAccounts).where(eq(tezmakaleAccounts.email, email)).limit(1).all()[0];
  if (existing) {
    throw ERRORS.invalidRequest("Email already registered", input.requestId);
  }

  const salt = randomBytes(16).toString("hex");
  const id = generateId("tm");
  const now = new Date();
  db.insert(tezmakaleAccounts).values({
    id,
    email,
    name: input.name.trim() || email.split("@")[0]!,
    passwordHash: hashPassword(input.password, salt),
    passwordSalt: salt,
    plan: "free",
    lemonCustomerId: null,
    lemonSubscriptionId: null,
    tokensRemaining: initialTokensForPlan("free"),
    createdAt: now,
    updatedAt: now,
  }).run();

  return { id, email, name: input.name.trim() || email.split("@")[0]!, plan: "free" };
}

export function loginUser(input: {
  email: string;
  password: string;
  requestId?: string;
}): { user: TezmakaleUser; sessionToken: string; expiresAt: Date } {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const account = db.select().from(tezmakaleAccounts).where(eq(tezmakaleAccounts.email, email)).limit(1).all()[0];
  if (!account) {
    throw ERRORS.unauthorized(input.requestId);
  }

  const expected = hashPassword(input.password, account.passwordSalt);
  const ok =
    expected.length === account.passwordHash.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(account.passwordHash));
  if (!ok) {
    throw ERRORS.unauthorized(input.requestId);
  }

  const rawToken = `tm_sess_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.insert(tezmakaleSessions).values({
    id: generateId("sess"),
    accountId: account.id,
    tokenHash: hashToken(rawToken),
    expiresAt,
    createdAt: new Date(),
  }).run();

  return {
    user: {
      id: account.id,
      email: account.email,
      name: account.name,
      plan: account.plan as TezmakalePlan,
    },
    sessionToken: rawToken,
    expiresAt,
  };
}

export function logoutSession(token: string): void {
  const db = getDb();
  db.delete(tezmakaleSessions).where(eq(tezmakaleSessions.tokenHash, hashToken(token))).run();
}

export function resolveSession(token: string | undefined, requestId?: string): TezmakaleUser {
  if (!token?.startsWith("tm_sess_")) {
    throw ERRORS.unauthorized(requestId);
  }
  const db = getDb();
  const session = db
    .select()
    .from(tezmakaleSessions)
    .where(eq(tezmakaleSessions.tokenHash, hashToken(token)))
    .limit(1)
    .all()[0];

  if (!session || session.expiresAt.getTime() < Date.now()) {
    throw ERRORS.unauthorized(requestId);
  }

  const account = db
    .select()
    .from(tezmakaleAccounts)
    .where(eq(tezmakaleAccounts.id, session.accountId))
    .limit(1)
    .all()[0];

  if (!account) {
    throw ERRORS.unauthorized(requestId);
  }

  return {
    id: account.id,
    email: account.email,
    name: account.name,
    plan: account.plan as TezmakalePlan,
  };
}

export function getAccountById(accountId: string) {
  const db = getDb();
  return db.select().from(tezmakaleAccounts).where(eq(tezmakaleAccounts.id, accountId)).limit(1).all()[0];
}
