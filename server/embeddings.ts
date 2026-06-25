/**
 * Embedding helpers — V11.13 (Manus-leválasztás után).
 *
 * Az aktív LLM-provider embeddings endpointját használja az ENV-config
 * (`getLlmEmbeddingsConfig`) alapján — elsősorban OpenAI text-embedding-3-small,
 * legacy fallback Manus forge ha az openaiApiKey üres. Ha egyik sem aktív, a
 * helper null-t ad vissza, és a hívók graceful fallback-elnek keyword-keresésre.
 */

import { getLlmEmbeddingsConfig } from "./_core/env";
import { chunkText } from "./relevanceChunker";

/**
 * Default chunk size for embedding generation. Smaller than the compliance
 * relevance chunker (3000) because embedding quality is best on focused text.
 */
const EMBEDDING_CHUNK_SIZE = 800;
const EMBEDDING_CHUNK_OVERLAP = 100;

let embeddingApiAvailable: boolean | null = null; // null = untested

interface EmbeddingApiResponse {
  data?: Array<{ embedding?: number[] }>;
}

async function callEmbeddingApi(input: string): Promise<number[] | null> {
  const cfg = getLlmEmbeddingsConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ model: cfg.model, input }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as EmbeddingApiResponse;
    const vec = json.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length > 0 ? vec : null;
  } catch {
    return null;
  }
}

interface BatchEmbeddingApiResponse {
  data?: Array<{ index?: number; embedding?: number[] }>;
}

/**
 * Több szöveg beágyazása egyetlen API-hívással (az OpenAI embeddings endpoint
 * tömb-inputot is fogad). Nagy dokumentumoknál (több száz chunk) ez nagyságrenddel
 * gyorsabb a chunkonkénti hívásnál. Egy átmeneti hibára egyszer újrapróbál.
 */
async function callEmbeddingApiBatch(inputs: string[], attempt = 1): Promise<(number[] | null)[]> {
  const cfg = getLlmEmbeddingsConfig();
  if (!cfg) return inputs.map(() => null);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, input: inputs }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`embed ${res.status}`);
    const json = (await res.json()) as BatchEmbeddingApiResponse;
    const byIndex = new Map<number, number[]>();
    for (const d of json.data ?? []) {
      if (typeof d.index === "number" && Array.isArray(d.embedding) && d.embedding.length > 0) {
        byIndex.set(d.index, d.embedding);
      }
    }
    return inputs.map((_, i) => byIndex.get(i) ?? null);
  } catch {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      return callEmbeddingApiBatch(inputs, attempt + 1);
    }
    return inputs.map(() => null);
  }
}

/**
 * Embed a single piece of text. Returns null if the embedding API is not
 * configured or the call fails.
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
  if (embeddingApiAvailable === false) return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;

  const vec = await callEmbeddingApi(trimmed);
  if (vec) {
    embeddingApiAvailable = true;
    return vec;
  }

  // Mark unavailable so we don't retry per-call until process restart.
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
  if (embeddingApiAvailable === false) return [];
  const chunks = chunkText(text, chunkSize, overlap).filter((c) => c.trim().length > 0);
  if (chunks.length === 0) return [];

  // Batch-elt beágyazás (50 chunk / hívás) — nagy szabványoknál (több száz chunk)
  // ez nagyságrenddel gyorsabb, mint a chunkonkénti hívás.
  const BATCH = 50;
  const result: EmbeddedChunk[] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vecs = await callEmbeddingApiBatch(slice);
    slice.forEach((chunk, j) => {
      const vec = vecs[j];
      if (vec) result.push({ chunkIndex: i + j, text: chunk, embedding: vec });
    });
  }
  // Frissítsük a cache-elt elérhetőségi állapotot az eredmény alapján.
  embeddingApiAvailable = result.length > 0;
  return result;
}

/**
 * Test-only export to reset the cached availability state (so multiple tests
 * can simulate "API down" / "API up" without process restart).
 */
export function _resetEmbeddingApiStateForTests(): void {
  embeddingApiAvailable = null;
}
