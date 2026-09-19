import type { ApiContext, VerticalMode, WorkflowStep } from "@ozdna/core";
import {
  cacheKey,
  getCachedResponse,
  setCachedResponse,
  fetchUpstreamWithRetry,
  UpstreamError,
} from "@ozdna/gateway";
import { routeModel } from "@ozdna/router";
import { calculateCost } from "@ozdna/cost";
import { recordUsage } from "@ozdna/analytics";
import { traceSpan, log } from "@ozdna/observability";
import { embedText, cosineSimilarity } from "@ozdna/rag";

const OPENAI_BASE = "https://api.openai.com/v1";

function openAiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function recordProxyUsage(
  ctx: ApiContext,
  endpoint: string,
  workflowId: string,
  step: WorkflowStep,
  model: string,
  mode: VerticalMode,
  tokensIn: number,
  tokensOut: number,
  latencyMs: number,
  status: "success" | "error",
): number {
  const cost = calculateCost(model, tokensIn, tokensOut);
  recordUsage({
    requestId: ctx.requestId,
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    apiKeyId: ctx.apiKeyId,
    endpoint,
    workflowId,
    step,
    model,
    mode,
    tokensIn,
    tokensOut,
    costUsd: cost.costUsd,
    latencyMs,
    status,
  });
  return cost.costUsd;
}

export interface ProxyResult {
  body: unknown;
  model: string;
  cost_usd: number;
  cached?: boolean;
}

export async function runChat(
  ctx: ApiContext,
  body: Record<string, unknown>,
  mode: VerticalMode = "general",
): Promise<ProxyResult> {
  const start = Date.now();
  const route = routeModel("chat", mode);
  const model = route.model;
  const workflowId = `chat-${mode}-v1`;
  const apiKey = openAiKey();
  const payload = { ...body, model };

  if (!apiKey) {
    const content =
      "ozDNA gateway preview — set OPENAI_API_KEY for live upstream. Routed model: " + model;
    const tokensIn = estimateTokens(JSON.stringify(body));
    const tokensOut = estimateTokens(content);
    const cost = recordProxyUsage(ctx, "/v1/chat", workflowId, "chat", model, mode, tokensIn, tokensOut, Date.now() - start, "success");
    return {
      body: {
        id: `chatcmpl_${ctx.requestId}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut, total_tokens: tokensIn + tokensOut },
      },
      model,
      cost_usd: cost,
    };
  }

  const upstream = await fetchUpstreamWithRetry(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = upstream.json as {
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const cost = recordProxyUsage(
    ctx,
    "/v1/chat",
    workflowId,
    "chat",
    model,
    mode,
    data.usage?.prompt_tokens ?? estimateTokens(JSON.stringify(body)),
    data.usage?.completion_tokens ?? 0,
    Date.now() - start,
    "success",
  );
  traceSpan(ctx.requestId, "gateway", "chat", Date.now() - start, { model });

  return { body: upstream.json, model, cost_usd: cost };
}

export async function runCompletion(
  ctx: ApiContext,
  body: Record<string, unknown>,
  mode: VerticalMode = "general",
): Promise<ProxyResult> {
  const start = Date.now();
  const route = routeModel("completion", mode);
  const model = route.model;
  const workflowId = `completion-${mode}-v1`;
  const apiKey = openAiKey();
  const payload = { ...body, model };

  if (!apiKey) {
    const prompt = String(body.prompt ?? "");
    const text = `[preview] ${prompt.slice(0, 120)}…`;
    const tokensIn = estimateTokens(prompt);
    const tokensOut = estimateTokens(text);
    const cost = recordProxyUsage(ctx, "/v1/completion", workflowId, "completion", model, mode, tokensIn, tokensOut, Date.now() - start, "success");
    return {
      body: {
        id: `cmpl_${ctx.requestId}`,
        object: "text_completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ text, index: 0, finish_reason: "stop" }],
        usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut, total_tokens: tokensIn + tokensOut },
      },
      model,
      cost_usd: cost,
    };
  }

  const upstream = await fetchUpstreamWithRetry(`${OPENAI_BASE}/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = upstream.json as { usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
  const cost = recordProxyUsage(
    ctx,
    "/v1/completion",
    workflowId,
    "completion",
    model,
    mode,
    data.usage?.prompt_tokens ?? 0,
    data.usage?.completion_tokens ?? 0,
    Date.now() - start,
    "success",
  );
  return { body: upstream.json, model, cost_usd: cost };
}

export async function runEmbeddings(
  ctx: ApiContext,
  body: Record<string, unknown>,
  mode: VerticalMode = "general",
): Promise<ProxyResult> {
  const start = Date.now();
  const route = routeModel("embeddings", mode);
  const model = route.model;
  const workflowId = `embeddings-${mode}-v1`;
  const input = body.input;
  const cacheK = cacheKey(ctx.orgId, "/v1/embeddings", { model, input });
  const cached = getCachedResponse(cacheK);
  if (cached) {
    log({ level: "info", requestId: ctx.requestId, component: "gateway", message: "embeddings cache hit" });
    return { body: cached, model, cost_usd: 0, cached: true };
  }

  const texts = Array.isArray(input) ? (input as string[]) : [String(input ?? "")];
  const apiKey = openAiKey();

  if (apiKey && model !== "local-bow") {
    try {
      const upstream = await fetchUpstreamWithRetry(`${OPENAI_BASE}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model }),
      });
      const data = upstream.json as { usage?: { prompt_tokens?: number }; model?: string };
      const tokensIn = data.usage?.prompt_tokens ?? estimateTokens(texts.join(" "));
      const cost = recordProxyUsage(
        ctx,
        "/v1/embeddings",
        workflowId,
        "embeddings",
        model,
        mode,
        tokensIn,
        0,
        Date.now() - start,
        "success",
      );
      setCachedResponse(cacheK, upstream.json, 60_000);
      return { body: upstream.json, model, cost_usd: cost };
    } catch (err) {
      if (!(err instanceof UpstreamError)) throw err;
      log({
        level: "warn",
        requestId: ctx.requestId,
        component: "gateway",
        message: "embeddings upstream fallback",
        metadata: { status: err.status },
      });
    }
  }

  const rows = await Promise.all(texts.map((t) => embedText(t, model === "local-bow" ? "local-bow" : model)));
  const response = {
    object: "list",
    data: rows.map((row, index) => ({
      object: "embedding",
      index,
      embedding: row.vector,
    })),
    model: rows[0]?.model ?? "local-bow",
    usage: { prompt_tokens: estimateTokens(texts.join(" ")), total_tokens: estimateTokens(texts.join(" ")) },
  };
  const tokensIn = estimateTokens(texts.join(" "));
  const cost = recordProxyUsage(ctx, "/v1/embeddings", workflowId, "embeddings", response.model, mode, tokensIn, 0, Date.now() - start, "success");
  setCachedResponse(cacheK, response, 60_000);
  return { body: response, model: response.model, cost_usd: cost };
}

export async function runRerank(
  ctx: ApiContext,
  body: Record<string, unknown>,
  mode: VerticalMode = "general",
): Promise<ProxyResult> {
  const start = Date.now();
  const route = routeModel("rerank", mode);
  const model = route.model;
  const query = String(body.query ?? "");
  const documents = (body.documents as string[]) ?? [];
  const topN = Number(body.top_n ?? documents.length);

  if (!query || documents.length === 0) {
    throw new Error("Missing required fields: query, documents");
  }

  const queryEmb = await embedText(query, model);
  const scored = await Promise.all(
    documents.map(async (doc, index) => {
      const docEmb = await embedText(doc, queryEmb.model);
      return { index, document: doc, relevance_score: cosineSimilarity(queryEmb.vector, docEmb.vector) };
    }),
  );
  scored.sort((a, b) => b.relevance_score - a.relevance_score);

  const results = scored.slice(0, topN);
  const tokensIn = estimateTokens(query + documents.join(" "));
  const cost = recordProxyUsage(ctx, "/v1/rerank", `rerank-${mode}-v1`, "rerank", model, mode, tokensIn, 0, Date.now() - start, "success");

  return {
    body: { object: "list", model, results },
    model,
    cost_usd: cost,
  };
}

export async function runModeration(
  ctx: ApiContext,
  body: Record<string, unknown>,
  mode: VerticalMode = "general",
): Promise<ProxyResult> {
  const start = Date.now();
  const route = routeModel("moderation", mode);
  const model = route.model;
  const input = body.input ?? body.text;
  const text = Array.isArray(input) ? (input as string[]).join("\n") : String(input ?? "");
  const workflowId = `moderation-${mode}-v1`;
  const apiKey = openAiKey();

  if (apiKey) {
    try {
      const upstream = await fetchUpstreamWithRetry(`${OPENAI_BASE}/moderations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model, input: text }),
      });
      const tokensIn = estimateTokens(text);
      const cost = recordProxyUsage(ctx, "/v1/moderation", workflowId, "moderation", model, mode, tokensIn, 0, Date.now() - start, "success");
      return { body: upstream.json, model, cost_usd: cost };
    } catch (err) {
      if (!(err instanceof UpstreamError)) throw err;
    }
  }

  const flagged = /\b(violence|hate|spam|illegal)\b/i.test(text);
  const response = {
    id: `modr_${ctx.requestId}`,
    model,
    results: [
      {
        flagged,
        categories: { harassment: false, hate: flagged, violence: flagged, self_harm: false },
        category_scores: {
          harassment: 0.01,
          hate: flagged ? 0.9 : 0.01,
          violence: flagged ? 0.85 : 0.01,
          self_harm: 0.01,
        },
      },
    ],
  };
  const cost = recordProxyUsage(ctx, "/v1/moderation", workflowId, "moderation", model, mode, estimateTokens(text), 0, Date.now() - start, "success");
  return { body: response, model, cost_usd: cost };
}
