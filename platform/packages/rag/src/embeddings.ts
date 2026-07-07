const EMBED_DIM = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % EMBED_DIM;
}

export function embedLocal(text: string): number[] {
  const vec = new Array<number>(EMBED_DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  for (const token of tokens) {
    const idx = hashToken(token);
    vec[idx] += 1;
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function embedText(
  text: string,
  model = "local-bow",
): Promise<{ vector: number[]; model: string; dimensions: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && model !== "local-bow") {
    const embeddingModel = model.startsWith("text-") ? model : "text-embedding-3-small";
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: embeddingModel, input: text.slice(0, 8000) }),
    });
    if (res.ok) {
      const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
      const vector = data.data[0]?.embedding ?? embedLocal(text);
      return { vector, model: embeddingModel, dimensions: vector.length };
    }
  }

  const vector = embedLocal(text);
  return { vector, model: "local-bow", dimensions: vector.length };
}

export function serializeEmbedding(vector: number[]): string {
  return JSON.stringify(vector);
}

export function deserializeEmbedding(raw: string): number[] {
  return JSON.parse(raw) as number[];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
