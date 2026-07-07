import { createHash, randomBytes } from "node:crypto";
import { generateId } from "@ozdna/core";
import {
  initSchema,
  getDb,
  organizations,
  users,
  workspaces,
  projects,
  roles,
  permissions,
  rolePermissions,
  orgMembers,
  apiKeys,
  prompts,
  ragCorpora,
  ragDocuments,
  billingAccounts,
  routingRules,
} from "./index.js";

initSchema();
const db = getDb();
const now = new Date();

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function promptHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

const orgId = generateId("org");
const workspaceId = generateId("ws");
const projectId = generateId("proj");
const rawKey = `ozdna_sk_test_${randomBytes(24).toString("hex")}`;

const PERMISSION_DEFS: Array<[string, string]> = [
  ["org:read", "View organization settings"],
  ["org:write", "Update organization settings"],
  ["org:delete", "Delete organization"],
  ["members:read", "List members"],
  ["members:write", "Invite and manage members"],
  ["workspace:read", "List workspaces"],
  ["workspace:write", "Create and update workspaces"],
  ["project:read", "List projects"],
  ["project:write", "Create and update projects"],
  ["api_keys:read", "List API keys"],
  ["api_keys:write", "Create API keys"],
  ["api_keys:revoke", "Revoke API keys"],
  ["usage:read", "View usage and cost metrics"],
  ["billing:read", "View billing and quotas"],
  ["billing:write", "Change plan and billing"],
  ["audit:read", "Query audit logs"],
  ["roles:read", "View roles and permissions"],
  ["roles:write", "Manage custom roles"],
];

const permissionIds = new Map<string, string>();
for (const [key, description] of PERMISSION_DEFS) {
  const id = generateId("perm");
  permissionIds.set(key, id);
  db.insert(permissions).values({ id, key, description }).run();
}

const ROLE_DEFS: Record<string, { description: string; keys: string[] }> = {
  owner: {
    description: "Full organization control",
    keys: PERMISSION_DEFS.map(([k]) => k),
  },
  admin: {
    description: "Manage workspaces, projects, keys, and members",
    keys: PERMISSION_DEFS.filter(([k]) => k !== "org:delete").map(([k]) => k),
  },
  developer: {
    description: "Build and integrate in assigned workspaces",
    keys: [
      "workspace:read",
      "project:read",
      "project:write",
      "api_keys:read",
      "api_keys:write",
      "api_keys:revoke",
      "usage:read",
      "audit:read",
    ],
  },
  viewer: {
    description: "Read-only access",
    keys: ["org:read", "workspace:read", "project:read", "api_keys:read", "usage:read", "audit:read", "billing:read"],
  },
};

const roleIds = new Map<string, string>();
for (const [name, def] of Object.entries(ROLE_DEFS)) {
  const roleId = generateId("role");
  roleIds.set(name, roleId);
  db.insert(roles).values({
    id: roleId,
    orgId: null,
    name,
    description: def.description,
    system: true,
    createdAt: now,
  }).run();
  for (const permKey of def.keys) {
    const permId = permissionIds.get(permKey);
    if (permId) {
      db.insert(rolePermissions).values({ roleId, permissionId: permId }).run();
    }
  }
}

const userId = generateId("user");
db.insert(users).values({
  id: userId,
  email: "hello@ozdna.com",
  name: "Platform Admin",
  createdAt: now,
}).run();

db.insert(organizations).values({
  id: orgId,
  name: "Findbelow Ventures",
  plan: "developer",
  createdAt: now,
}).run();

db.insert(workspaces).values({
  id: workspaceId,
  orgId,
  name: "Production",
  slug: "production",
  createdAt: now,
}).run();

db.insert(orgMembers).values({
  id: generateId("mbr"),
  orgId,
  userId,
  roleId: roleIds.get("owner")!,
  createdAt: now,
}).run();

db.insert(projects).values({
  id: projectId,
  orgId,
  workspaceId,
  name: "TezMakale Sandbox",
  createdAt: now,
}).run();

const complyProjectId = generateId("proj");
db.insert(projects).values({
  id: complyProjectId,
  orgId,
  workspaceId,
  name: "ComplyDNA Sandbox",
  createdAt: now,
}).run();

const keyId = generateId("key");
db.insert(apiKeys).values({
  id: keyId,
  projectId,
  orgId,
  name: "Sandbox Key",
  keyHash: hashKey(rawKey),
  keyPrefix: rawKey.slice(0, 20),
  environment: "test",
  rateLimitPerMin: 60,
  monthlyQuota: 10000,
  active: true,
  createdAt: now,
}).run();

db.insert(billingAccounts).values({
  id: generateId("bill"),
  orgId,
  plan: "developer",
  monthlyQuota: 10000,
  usedThisMonth: 0,
  periodStart: now,
  createdAt: now,
}).run();

const detectPrompt = `You are an academic AI detection system. Analyze text for AI-generated patterns.
Return segment-level scores. Mode: {{mode}}. Language: {{language}}.`;

db.insert(prompts).values({
  id: generateId("prm"),
  name: "detect-academic-v1",
  version: 1,
  mode: "academic",
  workflow: "detect",
  content: detectPrompt,
  hash: promptHash(detectPrompt),
  active: true,
  createdAt: now,
}).run();

const corpusId = generateId("cor");
db.insert(ragCorpora).values({
  id: corpusId,
  orgId,
  projectId,
  name: "Academic TR Reference",
  mode: "academic",
  description: "Turkish academic writing patterns and calibration corpus",
  documentCount: 2,
  chunkCount: 0,
  embeddingModel: "local-bow",
  freshnessPolicyDays: 30,
  status: "active",
  createdAt: now,
}).run();

db.insert(ragDocuments).values({
  id: generateId("doc"),
  corpusId,
  title: "Academic register — Turkish",
  content: "Turkish academic prose uses formal register, passive constructions, and discipline-specific terminology.",
  metadata: JSON.stringify({ language: "tr" }),
  createdAt: now,
}).run();

db.insert(ragDocuments).values({
  id: generateId("doc"),
  corpusId,
  title: "AI detection calibration",
  content: "Segment-level analysis improves accuracy for mixed human/AI text in thesis chapters.",
  metadata: JSON.stringify({ language: "en" }),
  createdAt: now,
}).run();

const financialCorpusId = generateId("cor");
db.insert(ragCorpora).values({
  id: financialCorpusId,
  orgId,
  projectId: complyProjectId,
  name: "TR Financial Regulation — Comply",
  mode: "financial",
  description: "5549, BDDK, MASAK regulatory reference corpus for ComplyDNA",
  documentCount: 3,
  chunkCount: 0,
  embeddingModel: "local-bow",
  freshnessPolicyDays: 7,
  status: "active",
  createdAt: now,
}).run();

const financialDocs = [
  {
    title: "5549 — AML/CFT obligations",
    content: "Law 5549 requires obliged parties to implement customer due diligence, suspicious transaction reporting to MASAK, and record retention for financial intelligence purposes.",
    metadata: { framework: "5549", language: "en" },
  },
  {
    title: "BDDK — Payment institution licensing",
    content: "BDDK regulates payment and electronic money institutions in Turkey. Licensing applications require capital adequacy, governance, and IT security controls aligned with communiqués.",
    metadata: { framework: "BDDK", language: "en" },
  },
  {
    title: "MASAK — Suspicious transaction reporting",
    content: "MASAK receives suspicious transaction reports from obliged entities. Reporting timelines and STR format requirements apply to banks, PSPs, and designated non-financial businesses.",
    metadata: { framework: "MASAK", language: "en" },
  },
];

for (const doc of financialDocs) {
  db.insert(ragDocuments).values({
    id: generateId("doc"),
    corpusId: financialCorpusId,
    title: doc.title,
    content: doc.content,
    metadata: JSON.stringify(doc.metadata),
    createdAt: now,
  }).run();
}

const legalCorpusId = generateId("cor");
db.insert(ragCorpora).values({
  id: legalCorpusId,
  orgId,
  projectId: complyProjectId,
  name: "KVKK & Legal Reference — Comply",
  mode: "legal",
  description: "KVKK data protection and legal compliance corpus for ComplyDNA",
  documentCount: 2,
  chunkCount: 0,
  embeddingModel: "local-bow",
  freshnessPolicyDays: 14,
  status: "active",
  createdAt: now,
}).run();

db.insert(ragDocuments).values({
  id: generateId("doc"),
  corpusId: legalCorpusId,
  title: "KVKK — Personal data processing",
  content: "KVKK requires lawful basis, data minimization, and explicit consent for sensitive personal data. Cross-border transfers need adequate protection or explicit approval.",
  metadata: JSON.stringify({ framework: "KVKK", language: "en" }),
  createdAt: now,
}).run();

db.insert(ragDocuments).values({
  id: generateId("doc"),
  corpusId: legalCorpusId,
  title: "KVKK — Data breach notification",
  content: "Personal data breaches must be reported to the KVKK Board without undue delay and, where feasible, within 72 hours of becoming aware of the breach.",
  metadata: JSON.stringify({ framework: "KVKK", language: "en" }),
  createdAt: now,
}).run();

for (const rule of [
  { workflow: "detect", mode: "general", primary: "gpt-4o-mini", fallback: "gpt-3.5-turbo", maxCost: 0.01 },
  { workflow: "detect", mode: "academic", primary: "gpt-4o-mini", fallback: "gpt-4o", maxCost: 0.02 },
  { workflow: "detect", mode: "legal", primary: "gpt-4o-mini", fallback: null, maxCost: 0.02 },
  { workflow: "detect", mode: "financial", primary: "gpt-4o-mini", fallback: null, maxCost: 0.02 },
]) {
  db.insert(routingRules).values({
    id: generateId("route"),
    workflow: rule.workflow,
    mode: rule.mode,
    primaryModel: rule.primary,
    fallbackModel: rule.fallback,
    maxCostUsd: rule.maxCost,
    priority: 0,
    active: true,
  }).run();
}

console.log("\n✓ ozDNA platform seeded\n");
console.log("  Organization:", orgId);
console.log("  Workspace:   ", workspaceId);
console.log("  User:        ", userId, "(hello@ozdna.com · owner)");
console.log("  Project:     ", projectId);
console.log("  API Key:     ", rawKey);
console.log("  ComplyDNA proj:", complyProjectId);
console.log("  Financial:   ", financialCorpusId);
console.log("  Legal:       ", legalCorpusId);
console.log("\n  Use: Authorization: Bearer", rawKey);
console.log("  Start API: npm run dev (from platform/)\n");
