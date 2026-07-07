import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { generateRequestId, ERRORS } from "@ozdna/core";
import { initSchema } from "@ozdna/db";
import { authenticate, completeRequest, handleError } from "@ozdna/gateway";
import { runDetect, runChat, runCompletion, runEmbeddings, runRerank, runModeration } from "@ozdna/inference";
import { getUsageSummary } from "@ozdna/analytics";
import { getCostMetrics } from "@ozdna/cost";
import { getBillingStatus } from "@ozdna/billing";
import { listPrompts } from "@ozdna/prompts";
import {
  listCorpora,
  createCorpus,
  getCorpus,
  addDocument,
  listDocuments,
  ingestCorpus,
  getFreshness,
  getIngestionJob,
  retrieveHybrid,
  runEval,
  getEvalSummary,
} from "@ozdna/rag";
import type { VerticalMode } from "@ozdna/core";
import { audit } from "@ozdna/observability";
import {
  getOrganization,
  updateOrganization,
  listWorkspaces,
  createWorkspace,
  listProjects,
  createProject,
  listApiKeys,
  createProjectApiKey,
  revokeProjectApiKey,
} from "@ozdna/admin";

initSchema();

function parseMode(value: unknown): VerticalMode {
  const modes = ["academic", "legal", "financial", "general"] as const;
  return modes.includes(value as VerticalMode) ? (value as VerticalMode) : "general";
}

async function handleLlmProxy(
  c: Context,
  endpoint: string,
  runner: (
    ctx: import("@ozdna/core").ApiContext,
    body: Record<string, unknown>,
    mode: VerticalMode,
  ) => Promise<{ body: unknown; model: string; cost_usd: number; cached?: boolean }>,
) {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const body = await c.req.json<Record<string, unknown>>();
    const mode = parseMode(body.mode);
    const result = await runner(gw.api, body, mode);
    completeRequest(gw, endpoint);
    const headers: Record<string, string> = {
      "X-Request-Id": requestId,
      "X-OzDNA-Model": result.model,
      "X-OzDNA-Cost-USD": String(result.cost_usd),
    };
    if (result.cached) headers["X-OzDNA-Cache"] = "HIT";
    return c.json(result.body, 200, headers);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Missing required")) {
      return handleError(ERRORS.invalidRequest(err.message, requestId), requestId);
    }
    return handleError(err, requestId);
  }
}

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "ozdna-api",
    version: "0.1.0",
    modules: [
      "ai-gateway",
      "model-router",
      "prompt-registry",
      "api-keys",
      "usage-analytics",
      "cost-optimization",
      "rag-management",
      "comply",
      "observability",
      "billing",
      "admin-api",
    ],
  }),
);

app.get("/", (c) =>
  c.json({
    name: "ozDNA Platform API",
    description: "Vertical AI Infrastructure",
    docs: "/openapi.json",
    health: "/health",
  }),
);

app.get("/openapi.json", async (c) => {
  const spec = await import("./openapi.json", { with: { type: "json" } });
  return c.json(spec.default);
});

app.post("/v1/detect", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });

    const body = await c.req.json<{ text?: string; mode?: string; language?: string }>();
    if (!body.text || body.text.length === 0) {
      throw ERRORS.invalidRequest("Missing required field: text", requestId);
    }
    if (body.text.length > 50_000) {
      throw ERRORS.invalidRequest("Text exceeds 50,000 character limit", requestId);
    }

    const result = await runDetect(gw.api, {
      text: body.text,
      mode: body.mode as "academic" | "legal" | "financial" | "general" | undefined,
      language: body.language,
    });

    completeRequest(gw, "/v1/detect");

    const { model, cost_usd, ...response } = result;
    return c.json(response, 200, {
      "X-Request-Id": requestId,
      "X-OzDNA-Model": model,
      "X-OzDNA-Cost-USD": String(cost_usd),
    });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.post("/v1/chat", (c) => handleLlmProxy(c, "/v1/chat", runChat));
app.post("/v1/completion", (c) => handleLlmProxy(c, "/v1/completion", runCompletion));
app.post("/v1/embeddings", (c) => handleLlmProxy(c, "/v1/embeddings", runEmbeddings));
app.post("/v1/rerank", (c) => handleLlmProxy(c, "/v1/rerank", runRerank));
app.post("/v1/moderation", (c) => handleLlmProxy(c, "/v1/moderation", runModeration));

// ——— Admin REST API (org / workspace / project / keys) ———

app.get("/v1/orgs/:orgId", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const org = getOrganization(c.req.param("orgId"), gw.api, requestId);
    completeRequest(gw, "/v1/orgs/:orgId");
    return c.json(org, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.patch("/v1/orgs/:orgId", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const body = await c.req.json<{ name?: string }>();
    const org = updateOrganization(c.req.param("orgId"), gw.api, requestId, body);
    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "admin.org.update", org.id);
    completeRequest(gw, "/v1/orgs/:orgId");
    return c.json(org, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/orgs/:orgId/workspaces", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const result = listWorkspaces(c.req.param("orgId"), gw.api, requestId);
    completeRequest(gw, "/v1/orgs/:orgId/workspaces");
    return c.json(result, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.post("/v1/orgs/:orgId/workspaces", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const body = await c.req.json<{ name?: string; slug?: string }>();
    const workspace = createWorkspace(c.req.param("orgId"), gw.api, requestId, body);
    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "admin.workspace.create", workspace.id);
    completeRequest(gw, "/v1/orgs/:orgId/workspaces");
    return c.json(workspace, 201, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/workspaces/:workspaceId/projects", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const result = listProjects(c.req.param("workspaceId"), gw.api, requestId);
    completeRequest(gw, "/v1/workspaces/:workspaceId/projects");
    return c.json(result, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.post("/v1/workspaces/:workspaceId/projects", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const body = await c.req.json<{ name?: string }>();
    const project = createProject(c.req.param("workspaceId"), gw.api, requestId, body);
    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "admin.project.create", project.id);
    completeRequest(gw, "/v1/workspaces/:workspaceId/projects");
    return c.json(project, 201, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/projects/:projectId/keys", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const result = listApiKeys(c.req.param("projectId"), gw.api, requestId);
    completeRequest(gw, "/v1/projects/:projectId/keys");
    return c.json(result, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.post("/v1/projects/:projectId/keys", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const body = await c.req.json<{ name?: string; environment?: string }>();
    const key = createProjectApiKey(c.req.param("projectId"), gw.api, requestId, body);
    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "admin.api_key.create", key.id);
    completeRequest(gw, "/v1/projects/:projectId/keys");
    return c.json(key, 201, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.delete("/v1/projects/:projectId/keys/:keyId", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const result = revokeProjectApiKey(
      c.req.param("projectId"),
      c.req.param("keyId"),
      gw.api,
      requestId,
    );
    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "admin.api_key.revoke", result.id);
    completeRequest(gw, "/v1/projects/:projectId/keys/:keyId");
    return c.json(result, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/metrics/cost", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });

    const workflowId = c.req.query("workflow_id") ?? "detect-academic-v1";
    const hours = Number(c.req.query("hours") ?? "24");
    const metrics = getCostMetrics(gw.api.orgId, workflowId, hours);

    completeRequest(gw, "/v1/metrics/cost");
    return c.json(metrics, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/metrics/usage", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });

    const hours = Number(c.req.query("hours") ?? "24");
    const summary = getUsageSummary(gw.api.orgId, hours);
    const billing = getBillingStatus(gw.api.orgId);

    completeRequest(gw, "/v1/metrics/usage");
    return c.json({ billing, endpoints: summary }, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/platform/status", async (c) => {
  return c.json({
    platform: "ozDNA Vertical AI Infrastructure",
    version: "0.1.0",
    modules: {
      ai_gateway: { status: "active", description: "Unified API entry with auth, rate limits, audit, LLM proxy" },
      model_router: { status: "active", description: "Cost-aware routing with fallback chains" },
      prompt_registry: { status: "active", prompts: listPrompts().length },
      api_keys: { status: "active", description: "Bearer token auth with scoped keys" },
      admin_api: {
        status: "active",
        description: "Org, workspace, project, and API key lifecycle",
        endpoints: [
          "GET/PATCH /v1/orgs/:orgId",
          "GET/POST /v1/orgs/:orgId/workspaces",
          "GET/POST /v1/workspaces/:workspaceId/projects",
          "GET/POST /v1/projects/:projectId/keys",
          "DELETE /v1/projects/:projectId/keys/:keyId",
        ],
      },
      llm_proxy: {
        status: "active",
        endpoints: ["/v1/chat", "/v1/completion", "/v1/embeddings", "/v1/rerank", "/v1/moderation"],
      },
      usage_analytics: { status: "active", description: "Per-request event tracking" },
      cost_optimization: { status: "active", description: "Token-level cost attribution" },
      rag_management: {
        status: "active",
        phase: "2",
        corpora: listCorpora().length,
        features: ["vector-retrieval", "chunk-ingestion", "freshness-tracking", "eval-hooks"],
      },
      observability: { status: "active", description: "Structured logs + audit trail" },
      billing: { status: "active", description: "Quota enforcement + plan metering" },
    },
  });
});

// ——— RAG Management (Phase 2) ———

app.get("/v1/rag/corpora", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const corpora = listCorpora(gw.api.orgId).map((cor) => ({
      id: cor.id,
      name: cor.name,
      mode: cor.mode,
      status: cor.status,
      document_count: cor.documentCount,
      chunk_count: cor.chunkCount,
      embedding_model: cor.embeddingModel,
      last_ingested_at: cor.lastIngestedAt?.toISOString() ?? null,
    }));
    completeRequest(gw, "/v1/rag/corpora");
    return c.json({ corpora }, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.post("/v1/rag/corpora", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const body = await c.req.json<{
      name?: string;
      mode?: string;
      description?: string;
      freshness_policy_days?: number;
      embedding_model?: string;
    }>();
    if (!body.name || !body.mode) {
      throw ERRORS.invalidRequest("Missing required fields: name, mode", requestId);
    }
    const corpus = createCorpus({
      orgId: gw.api.orgId,
      projectId: gw.api.projectId,
      name: body.name,
      mode: body.mode as "academic" | "legal" | "financial" | "general",
      description: body.description,
      freshnessPolicyDays: body.freshness_policy_days,
      embeddingModel: body.embedding_model,
    });
    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "rag.corpus.create", corpus!.id);
    completeRequest(gw, "/v1/rag/corpora");
    return c.json(corpus, 201, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/rag/corpora/:id", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const corpus = getCorpus(c.req.param("id"));
    if (!corpus) throw ERRORS.notFound("Corpus not found", requestId);
    if (corpus.orgId && corpus.orgId !== gw.api.orgId) {
      throw ERRORS.forbidden("Access denied to this corpus", requestId);
    }
    const freshness = getFreshness(corpus.id);
    completeRequest(gw, "/v1/rag/corpora/:id");
    return c.json({ ...corpus, freshness }, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.post("/v1/rag/corpora/:id/documents", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const corpusId = c.req.param("id");
    const corpus = getCorpus(corpusId);
    if (!corpus) throw ERRORS.notFound("Corpus not found", requestId);
    if (corpus.orgId && corpus.orgId !== gw.api.orgId) {
      throw ERRORS.forbidden("Access denied to this corpus", requestId);
    }
    const body = await c.req.json<{ title?: string; content?: string; metadata?: Record<string, unknown> }>();
    if (!body.title || !body.content) {
      throw ERRORS.invalidRequest("Missing required fields: title, content", requestId);
    }
    const doc = addDocument(corpusId, {
      title: body.title,
      content: body.content,
      metadata: body.metadata,
    });
    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "rag.document.add", doc!.id);
    completeRequest(gw, "/v1/rag/corpora/:id/documents");
    return c.json(doc, 201, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/rag/corpora/:id/documents", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const corpus = getCorpus(c.req.param("id"));
    if (!corpus) throw ERRORS.notFound("Corpus not found", requestId);
    completeRequest(gw, "/v1/rag/corpora/:id/documents");
    return c.json({ documents: listDocuments(corpus.id) }, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.post("/v1/rag/corpora/:id/ingest", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const corpusId = c.req.param("id");
    const corpus = getCorpus(corpusId);
    if (!corpus) throw ERRORS.notFound("Corpus not found", requestId);
    const result = await ingestCorpus(corpusId);
    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "rag.ingest", corpusId, result);
    completeRequest(gw, "/v1/rag/corpora/:id/ingest");
    return c.json(result, 202, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/rag/corpora/:id/freshness", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const freshness = getFreshness(c.req.param("id"));
    if (!freshness) throw ERRORS.notFound("Corpus not found", requestId);
    completeRequest(gw, "/v1/rag/corpora/:id/freshness");
    return c.json(freshness, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/rag/ingest/:jobId", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const job = getIngestionJob(c.req.param("jobId"));
    if (!job) throw ERRORS.notFound("Ingestion job not found", requestId);
    completeRequest(gw, "/v1/rag/ingest/:jobId");
    return c.json(job, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.post("/v1/rag/retrieve", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const body = await c.req.json<{
      query?: string;
      mode?: string;
      corpus_id?: string;
      limit?: number;
    }>();
    if (!body.query) throw ERRORS.invalidRequest("Missing required field: query", requestId);
    const result = await retrieveHybrid({
      query: body.query,
      mode: body.mode as "academic" | "legal" | "financial" | "general" | undefined,
      corpusId: body.corpus_id,
      limit: body.limit,
      orgId: gw.api.orgId,
    });
    completeRequest(gw, "/v1/rag/retrieve");
    return c.json(result ?? { chunks: [], method: "none" }, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.post("/v1/rag/eval", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const body = await c.req.json<{
      corpus_id?: string;
      query?: string;
      expected_chunk_id?: string;
      limit?: number;
    }>();
    if (!body.corpus_id || !body.query) {
      throw ERRORS.invalidRequest("Missing required fields: corpus_id, query", requestId);
    }
    const result = await runEval({
      corpusId: body.corpus_id,
      orgId: gw.api.orgId,
      query: body.query,
      expectedChunkId: body.expected_chunk_id,
      limit: body.limit,
    });
    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "rag.eval", body.corpus_id, { hit: result.hit });
    completeRequest(gw, "/v1/rag/eval");
    return c.json(result, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/rag/corpora/:id/eval-summary", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });
    const summary = getEvalSummary(c.req.param("id"));
    completeRequest(gw, "/v1/rag/corpora/:id/eval-summary");
    return c.json(summary, 200, { "X-Request-Id": requestId });
  } catch (err) {
    return handleError(err, requestId);
  }
});

app.get("/v1/comply/monitor", async (c) => {
  const requestId = c.req.header("X-Request-Id") ?? generateRequestId();
  try {
    const gw = authenticate({
      authorization: c.req.header("Authorization"),
      requestId,
      path: c.req.path,
      method: c.req.method,
    });

    const corpora = listCorpora(gw.api.orgId).filter(
      (corpus) => corpus.mode === "financial" || corpus.mode === "legal",
    );
    const freshnessRows = corpora.map((corpus) => getFreshness(corpus.id)).filter(Boolean);
    const staleCount = freshnessRows.filter((row) => row?.status === "stale").length;
    const alerts = staleCount + (corpora.length > 0 ? 1 : 0);

    audit(gw.api.requestId, gw.api.orgId, gw.api.apiKeyId, "comply.monitor", "regulatory-delta", {
      corpora: corpora.length,
      alerts,
    });
    completeRequest(gw, "/v1/comply/monitor");

    return c.json(
      {
        framework: "BDDK + MASAK + KVKK",
        corpora_monitored: corpora.length,
        corpus_freshness: staleCount === 0 && corpora.length > 0 ? "fresh" : corpora.length === 0 ? "none" : "review",
        alerts,
        cost_usd: 0,
        routed_to: "gpt-4o-mini",
        phase: "2-preview",
        production_proof: "https://tezmakale.com",
      },
      200,
      { "X-Request-Id": requestId },
    );
  } catch (err) {
    return handleError(err, requestId);
  }
});

const port = Number(process.env.PORT ?? 8787);

console.log(`ozDNA Platform API starting on http://localhost:${port}`);
console.log("Modules: Gateway · Router · Prompts · Keys · Analytics · Cost · RAG · Observability · Billing");

serve({ fetch: app.fetch, port });
