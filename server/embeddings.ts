/**
 * Embedding helpers — V12 semantic search foundation.
 *
 * Calls a Manus-compatible embeddings endpoint (OpenAI-shaped) at
 * `${forgeApiUrl}/v1/embeddings`. If the endpoint is not available or any call
 * fails, the helper returns null and callers fall back gracefully to keyword
 * search. This is by design: deploying without embedding support must not
 * break any existing search flow.
 */

import { ENV } from "./_core/env";
import { chunkText } from "./relevanceChunker";

/**
 * Default chunk size for embedding generation. Smaller than the compliance
 * relevance chunker (3000) because embedding quality is best on focused text.
 */
const EMBEDDING_CHUNK_SIZE = 800;
const EMBEDDING_CHUNK_OVERLAP = 100;

/**
 * Default embedding model. Falls back across model names because the Manus
 * forge gateway may expose different families. The first one that succeeds
 * is cached for the lifetime of the process.
 */
const EMBEDDING_MODEL_CANDIDATES = [
  "text-embedding-3-small",
  "gemini-embedding-001",
  "embedding-001",
];

let resolvedEmbeddingModel: string | null = null;
let embeddingApiAvailable: boolean | null = null; // null = untested

function resolveEmbeddingsUrl(): string {
  const base = ENV.forgeApiUrl?.trim();
  if (base && base.length > 0) {
    return `${base.replace(/\/$/, "")}/v1/embeddings`;
  }
  return "https://forge.manus.im/v1/embeddings";
}

interface EmbeddingApiResponse {
  data?: Array<{ embedding?: number[] }>;
}

async function callEmbeddingApi(input: string, model: string): Promise<number[] | null> {
  if (!ENV.forgeApiKey) return null;
  try {
    const res = await fetch(resolveEmbeddingsUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // 404 / 400 / model-not-found → try next candidate at higher level
      return null;
    }
    const json = (await res.json()) as EmbeddingApiResponse;
    const vec = json.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length > 0 ? vec : null;
  } catch {
    return null;
  }
}

/**
 * Embed a single piece of text. Returns null if the embedding API is not
 * available or all model candidates fail.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (embeddingApiAvailable === false) return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;

  if (resolvedEmbeddingModel) {
    return callEmbeddingApi(trimmed, resolvedEmbeddingModel);
  }

  for (const model of EMBEDDING_MODEL_CANDIDATES) {
    const vec = await callEmbeddingApi(trimmed, model);
    if (vec) {
      resolvedEmbeddingModel = model;
      embeddingApiAvailable = true;
      return vec;
    }
  }

  // None of the candidates returned a usable vector. Mark unavailable so we
  // don't retry per-call until process restart.
  embeddingApiAvailable = false;
  return null;
}

/**
 * Cosine similarity between two vectors. Returns 0 for mismatched dims or
 * zero vectors (safer than throwing).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface EmbeddedChunk {
  chunkIndex: number;
  text: string;
  embedding: number[];
}

/**
 * Chunk a long text and embed each chunk. Skips empty chunks and any chunk
 * whose embedding call fails (so a transient API hiccup doesn't drop the
 * whole document — the partial set is still useful).
 */
export async function chunkAndEmbed(
  text: string,
  chunkSize: number = EMBEDDING_CHUNK_SIZE,
  overlap: number = EMBEDDING_CHUNK_OVERLAP
): Promise<EmbeddedChunk[]> {
  const chunks = chunkText(text, chunkSize, overlap).filter((c) => c.trim().length > 0);
  const result: EmbeddedChunk[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const embedding = await getEmbedding(chunk);
    if (embedding) {
      result.push({ chunkIndex: i, text: chunk, embedding });
    }
  }
  return result;
}

/**
 * Test-only export to reset the cached availability state (so multiple tests
 * can simulate "API down" / "API up" without process restart).
 */
export function _resetEmbeddingApiStateForTests(): void {
  embeddingApiAvailable = null;
  resolvedEmbeddingModel = null;
}
