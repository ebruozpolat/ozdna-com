export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

export function chunkText(text: string, opts: ChunkOptions = {}): TextChunk[] {
  const chunkSize = opts.chunkSize ?? 512;
  const overlap = opts.overlap ?? 64;
  const step = Math.max(1, chunkSize - overlap);
  const chunks: TextChunk[] = [];

  if (text.length <= chunkSize) {
    return [{ index: 0, content: text.trim(), tokenCount: estimateTokens(text) }];
  }

  let index = 0;
  for (let start = 0; start < text.length; start += step) {
    const slice = text.slice(start, start + chunkSize).trim();
    if (!slice) continue;
    chunks.push({ index, content: slice, tokenCount: estimateTokens(slice) });
    index++;
    if (start + chunkSize >= text.length) break;
  }

  return chunks;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
