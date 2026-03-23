/**
 * Relevance-based chunking for compliance analysis.
 * Uses a lightweight TF-IDF inspired scoring to select the most relevant
 * chunks from a regulation document relative to a plan document query.
 */

export interface ScoredChunk {
  text: string;
  score: number;
  chunkIndex: number;
}

/**
 * Tokenise text into lowercase words (removes punctuation).
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Build a term-frequency map for a list of tokens.
 */
function buildTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  return tf;
}

/**
 * Compute cosine-like overlap score between two TF maps.
 * Returns a value in [0, 1].
 */
function overlapScore(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, countA] of Array.from(a.entries())) {
    normA += countA * countA;
    const countB = b.get(term) ?? 0;
    dot += countA * countB;
  }
  for (const [, countB] of Array.from(b.entries())) {
    normB += countB * countB;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Split text into overlapping chunks.
 */
export function chunkText(
  text: string,
  chunkSize = 3000,
  overlap = 300
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
    if (start + overlap >= text.length) break;
  }
  // Always include the last chunk
  if (chunks.length === 0 || text.length > (chunks[chunks.length - 1]?.length ?? 0)) {
    const lastStart = Math.max(0, text.length - chunkSize);
    const lastChunk = text.slice(lastStart);
    if (!chunks.includes(lastChunk)) chunks.push(lastChunk);
  }
  return chunks;
}

/**
 * Select the top-K most relevant chunks from a regulation document
 * relative to the content of a plan document.
 *
 * @param planText       - Full text of the plan document (query signal)
 * @param regulationText - Full text of the regulation document
 * @param topK           - Number of chunks to return (default 5)
 * @param chunkSize      - Characters per chunk (default 3000)
 * @param overlap        - Overlap between chunks (default 300)
 */
export function selectRelevantChunks(
  planText: string,
  regulationText: string,
  topK = 5,
  chunkSize = 3000,
  overlap = 300
): ScoredChunk[] {
  const planTokens = tokenise(planText.slice(0, 8000)); // Use first 8k chars as query
  const planTF = buildTF(planTokens);

  const chunks = chunkText(regulationText, chunkSize, overlap);

  const scored: ScoredChunk[] = chunks.map((text, chunkIndex) => {
    const tokens = tokenise(text);
    const tf = buildTF(tokens);
    const score = overlapScore(planTF, tf);
    return { text, score, chunkIndex };
  });

  // Sort by score descending, take top-K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Build a combined regulation excerpt from the top-K relevant chunks,
 * preserving original document order.
 */
export function buildRelevantExcerpt(
  planText: string,
  regulationText: string,
  topK = 5,
  chunkSize = 3000,
  overlap = 300
): string {
  const relevant = selectRelevantChunks(planText, regulationText, topK, chunkSize, overlap);
  // Re-sort by original chunk index to preserve reading order
  relevant.sort((a, b) => a.chunkIndex - b.chunkIndex);
  return relevant.map((c) => c.text).join("\n\n---\n\n");
}
