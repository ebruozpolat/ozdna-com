import type { ApiContext, VerticalMode } from "@ozdna/core";
import { routeModel } from "@ozdna/router";
import { getPrompt } from "@ozdna/prompts";
import { retrieveHybrid, buildRagContext } from "@ozdna/rag";
import { calculateCost } from "@ozdna/cost";
import { recordUsage } from "@ozdna/analytics";
import { traceSpan } from "@ozdna/observability";

export interface DetectInput {
  text: string;
  mode?: VerticalMode;
  language?: string;
}

export interface DetectOutput {
  ai_probability: number;
  confidence: "low" | "medium" | "high";
  verdict: "human_written" | "mixed" | "ai_generated";
  segments: number;
  segment_map: Array<{ start: number; end: number; score: number }>;
  processing_ms: number;
  mode: VerticalMode;
  language: string;
  model: string;
  cost_usd: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function mockDetectScore(text: string): number {
  const aiMarkers = [
    "methodology", "furthermore", "in conclusion", "it is important to note",
    "bu çalışmada", "sonuç olarak", "ayrıca", "metodoloji",
  ];
  const lower = text.toLowerCase();
  const hits = aiMarkers.filter((m) => lower.includes(m)).length;
  return Math.min(0.98, 0.45 + hits * 0.12 + (text.length > 500 ? 0.15 : 0));
}

function buildSegments(text: string, baseScore: number) {
  const chunkSize = Math.max(100, Math.floor(text.length / 8));
  const segments: Array<{ start: number; end: number; score: number }> = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    segments.push({
      start: i,
      end: Math.min(i + chunkSize, text.length),
      score: Math.min(0.99, baseScore + (Math.random() - 0.5) * 0.1),
    });
  }
  return segments;
}

async function callOpenAI(
  model: string,
  systemPrompt: string,
  userText: string,
): Promise<{ content: string; tokensIn: number; tokensOut: number } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? "",
    tokensIn: data.usage.prompt_tokens,
    tokensOut: data.usage.completion_tokens,
  };
}

export async function runDetect(
  ctx: ApiContext,
  input: DetectInput,
): Promise<DetectOutput> {
  const start = Date.now();
  const mode = input.mode ?? "general";
  const language = input.language ?? "en";
  const workflowId = `detect-${mode}-v1`;

  const route = routeModel("detect", mode);
  const prompt = getPrompt("detect", mode, { mode, language });
  const rag = await retrieveHybrid({ mode, query: input.text, orgId: ctx.orgId });
  const ragContext = buildRagContext(rag);
  const systemPrompt = prompt.content + ragContext;

  traceSpan(ctx.requestId, "router", "route", Date.now() - start, { model: route.model });
  traceSpan(ctx.requestId, "prompts", "resolve", 0, { hash: prompt.hash });
  if (rag) traceSpan(ctx.requestId, "rag", "retrieve", 0, { corpus: rag.corpusName, method: rag.method });

  let tokensIn = estimateTokens(systemPrompt + input.text);
  let tokensOut = 50;

  const openaiResult = await callOpenAI(
    route.model,
    systemPrompt,
    `Analyze this text for AI generation:\n\n${input.text}`,
  );

  const score = mockDetectScore(input.text);
  if (openaiResult) {
    tokensIn = openaiResult.tokensIn;
    tokensOut = openaiResult.tokensOut;
  }

  const cost = calculateCost(route.model, tokensIn, tokensOut);
  const segments = buildSegments(input.text, score);
  const latencyMs = Date.now() - start;

  recordUsage({
    requestId: ctx.requestId,
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    apiKeyId: ctx.apiKeyId,
    endpoint: "/v1/detect",
    workflowId,
    step: "detect",
    model: route.model,
    mode,
    tokensIn,
    tokensOut,
    costUsd: cost.costUsd,
    latencyMs,
    status: "success",
  });

  return {
    ai_probability: Math.round(score * 100) / 100,
    confidence: score > 0.8 ? "high" : score > 0.5 ? "medium" : "low",
    verdict: score > 0.75 ? "ai_generated" : score > 0.4 ? "mixed" : "human_written",
    segments: segments.length,
    segment_map: segments,
    processing_ms: latencyMs,
    mode,
    language,
    model: route.model,
    cost_usd: cost.costUsd,
  };
}

export {
  runChat,
  runCompletion,
  runEmbeddings,
  runRerank,
  runModeration,
} from "./proxy.js";
export type { ProxyResult } from "./proxy.js";
