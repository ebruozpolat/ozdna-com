import type { DetectOutput } from "@ozdna/inference";

const DEFAULT_BASE = "http://localhost:8787";

export interface OzdnaChatResult {
  content: string;
  model: string;
  cost_usd: number;
  tokens_used: number;
}

function apiKey(): string {
  const key = process.env.TEZMAKALE_OZDNA_API_KEY;
  if (!key) {
    throw new Error("TEZMAKALE_OZDNA_API_KEY is not configured");
  }
  return key;
}

function baseUrl(): string {
  return process.env.OZDNA_API_BASE_URL ?? DEFAULT_BASE;
}

export async function ozdnaDeepDetect(input: {
  text: string;
  language?: string;
}): Promise<DetectOutput & { tokens_used: number }> {
  const res = await fetch(`${baseUrl()}/v1/detect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: input.text,
      mode: "academic",
      language: input.language ?? "tr",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OzDNA detect failed (${res.status}): ${err}`);
  }

  const costHeader = res.headers.get("X-OzDNA-Cost-USD");
  const body = (await res.json()) as DetectOutput;
  const tokensUsed = Math.ceil(input.text.length / 4) + 200;
  return {
    ...body,
    cost_usd: costHeader ? Number(costHeader) : body.cost_usd,
    tokens_used: tokensUsed,
  };
}

export async function ozdnaParaphrase(input: {
  text: string;
  language?: string;
}): Promise<OzdnaChatResult> {
  const lang = input.language ?? "tr";
  const res = await fetch(`${baseUrl()}/v1/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "academic",
      messages: [
        {
          role: "system",
          content:
            "You are an academic writing assistant. Improve clarity and natural flow while preserving meaning. Output only the revised text.",
        },
        {
          role: "user",
          content: `Language: ${lang}\n\nText:\n${input.text}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OzDNA paraphrase failed (${res.status}): ${err}`);
  }

  const costHeader = res.headers.get("X-OzDNA-Cost-USD");
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const tokensUsed = Math.ceil(input.text.length / 4) + Math.ceil(content.length / 4);
  return {
    content,
    model: data.model ?? res.headers.get("X-OzDNA-Model") ?? "unknown",
    cost_usd: costHeader ? Number(costHeader) : 0,
    tokens_used: tokensUsed,
  };
}

/** @deprecated use ozdnaParaphrase */
export const ozdnaHumanize = ozdnaParaphrase;
