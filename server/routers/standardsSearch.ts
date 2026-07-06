/**
 * Standards Search Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements:
 *  1. Query rewriting (AI-assisted question refinement)
 *  2. Hybrid search (keyword + semantic) over regulation library + MSZT sources
 *  3. Structured answer generation (max 10 sentences + citations)
 *  4. Self-check / hallucination filter
 *  5. Extended answer ("Bővebb válasz")
 *  6. Search history persistence
 *  7. Configurable operation (answer length, mode, search logic)
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { searchQueries, regulationSources, knowledgeBaseDocuments, chunkEmbeddings } from "../../drizzle/schema";
import type { SearchSource } from "../../drizzle/schema";
import { and, desc, eq, like, or } from "drizzle-orm";
import { webSearchStandards, fetchUrlSources } from "../webSearch";
import { getEmbedding, cosineSimilarity } from "../embeddings";
import { searchMsztLive, isMsztLiveSearchEnabled, decryptPassword } from "../regulationScraper";
import { platformCredentials } from "../../drizzle/schema";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SearchMode = "mszt" | "internal" | "combined" | "web" | "combined_with_web";
export type AnswerLength = "short" | "standard" | "detailed";
export type OperationMode = "fast" | "accurate";
export type Confidence = "low" | "medium" | "high";

interface StructuredAnswer {
  answer: string;
  confidence: Confidence;
  sources: SearchSource[];
  hasSufficientSources: boolean;
  selfCheckPassed: boolean;
  selfCheckNotes: string;
  rewrittenQuestion: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Rewrite a user question into a more precise technical query.
 */
async function rewriteQuery(question: string): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Te egy magyar mérnöki szabvány-kereső rendszer kérdés-átíró modulja vagy.
A felhasználó kérdését alakítsd át egy precíz, technikai keresési lekérdezéssé.
Adj vissza egyetlen sort: a pontosított, technikai kérdést magyarul.
Ne adj magyarázatot, csak a pontosított kérdést.`,
        },
        {
          role: "user",
          content: `Eredeti kérdés: "${question}"\n\nPontosított technikai kérdés:`,
        },
      ],
    });
    const rawRewritten = response.choices?.[0]?.message?.content;
    const rewritten = typeof rawRewritten === "string" ? rawRewritten.trim() : "";
    return rewritten && rewritten.length > 5 ? rewritten : question;
  } catch {
    return question;
  }
}

/**
 * Keyword-based search over regulation sources.
 */
async function keywordSearch(query: string, mode: SearchMode): Promise<SearchSource[]> {
  const db = await getDb();
  if (!db) return [];

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);

  if (keywords.length === 0) return [];

  try {
    // Build OR conditions for each keyword
    const conditions = keywords.map((kw) =>
      or(
        like(regulationSources.name, `%${kw}%`),
        like(regulationSources.content, `%${kw}%`)
      )
    );

    let sources = await db
      .select()
      .from(regulationSources)
      .where(or(...conditions))
      .limit(20);

    // Mód-szűrés (V11.15): az "internal" a TELJES feltöltött jogszabály-
    // állományt hozza (sourceType-tól függetlenül, mszt-t is). A "web" módban
    // nincs könyvtári találat. A többi (legacy) érték is a teljes állományt adja.
    if (mode === "web") {
      return [];
    }

    // Extract relevant excerpts
    const results: SearchSource[] = [];
    for (const src of sources) {
      if (!src.content) continue;

      // Find the most relevant excerpt containing keywords
      const contentLower = src.content.toLowerCase();
      let bestPos = -1;
      let bestScore = 0;

      for (const kw of keywords) {
        const pos = contentLower.indexOf(kw);
        if (pos !== -1) {
          const score = keywords.filter((k) => contentLower.includes(k)).length;
          if (score > bestScore) {
            bestScore = score;
            bestPos = pos;
          }
        }
      }

      if (bestPos === -1) continue;

      const start = Math.max(0, bestPos - 200);
      const end = Math.min(src.content.length, bestPos + 600);
      const excerpt = src.content.slice(start, end).replace(/\s+/g, " ").trim();

      results.push({
        documentName: src.name,
        url: src.sourceUrl ?? undefined,
        excerpt,
        relevanceScore: bestScore / keywords.length,
      });
    }

    // Sort by relevance
    return results.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)).slice(0, 8);
  } catch (err) {
    console.error("[StandardsSearch] Keyword search error:", err);
    return [];
  }
}

/**
 * Keyword-based search over Knowledge Base documents (user-uploaded internal docs).
 * Mirrors keywordSearch but reads from knowledge_base_documents.extractedText.
 */
async function searchKnowledgeBase(query: string): Promise<SearchSource[]> {
  const db = await getDb();
  if (!db) return [];

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);

  if (keywords.length === 0) return [];

  try {
    const conditions = keywords.map((kw) =>
      or(
        like(knowledgeBaseDocuments.name, `%${kw}%`),
        like(knowledgeBaseDocuments.extractedText, `%${kw}%`)
      )
    );

    const docs = await db
      .select({
        id: knowledgeBaseDocuments.id,
        name: knowledgeBaseDocuments.name,
        originalName: knowledgeBaseDocuments.originalName,
        extractedText: knowledgeBaseDocuments.extractedText,
      })
      .from(knowledgeBaseDocuments)
      .where(or(...conditions))
      .limit(20);

    const results: SearchSource[] = [];
    for (const doc of docs) {
      if (!doc.extractedText) continue;

      const contentLower = doc.extractedText.toLowerCase();
      let bestPos = -1;
      let bestScore = 0;

      for (const kw of keywords) {
        const pos = contentLower.indexOf(kw);
        if (pos !== -1) {
          const score = keywords.filter((k) => contentLower.includes(k)).length;
          if (score > bestScore) {
            bestScore = score;
            bestPos = pos;
          }
        }
      }

      if (bestPos === -1) continue;

      const start = Math.max(0, bestPos - 200);
      const end = Math.min(doc.extractedText.length, bestPos + 600);
      const excerpt = doc.extractedText.slice(start, end).replace(/\s+/g, " ").trim();

      results.push({
        documentName: `Tudástár: ${doc.name || doc.originalName}`,
        excerpt,
        relevanceScore: bestScore / keywords.length,
        sourceType: "library",
      });
    }

    return results
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
      .slice(0, 5);
  } catch (err) {
    console.error("[StandardsSearch] Knowledge base search error:", err);
    return [];
  }
}

/**
 * Live MSZT-search bridge — only runs when ENABLE_LIVE_MSZT_SEARCH=true AND
 * MSZT credentials are configured. Returns [] otherwise (silent fallback).
 */
async function liveMsztSources(query: string, topK = 5): Promise<SearchSource[]> {
  if (!isMsztLiveSearchEnabled()) return [];
  const db = await getDb();
  if (!db) return [];

  try {
    const credRows = await db
      .select()
      .from(platformCredentials)
      .where(eq(platformCredentials.platform, "mszt"))
      .limit(1);
    const cred = credRows[0];
    if (!cred?.username || !cred?.encryptedPassword) return [];
    const password = decryptPassword(cred.encryptedPassword);
    const hits = await searchMsztLive(query, { username: cred.username, password }, topK);
    return hits.map((h, i) => ({
      documentName: `MSZT (élő): ${h.documentName}`,
      url: h.url,
      excerpt: h.excerpt,
      relevanceScore: h.relevanceScore ?? Math.max(0.1, 0.6 - i * 0.05),
      sourceType: "mszt",
    } satisfies SearchSource));
  } catch (err) {
    console.warn("[StandardsSearch] live MSZT search failed:", err);
    return [];
  }
}

/**
 * Semantic search across both regulation_sources and knowledge_base_documents
 * using pre-computed chunk embeddings. Returns top-K SearchSource objects
 * with cosine-similarity-derived relevanceScore. Returns empty array if the
 * embedding API is unavailable or no chunks have been embedded yet — in that
 * case the caller falls back to pure keyword search and behavior is unchanged
 * from V11.
 */
async function semanticSearch(
  query: string,
  mode: SearchMode,
  topK = 8
): Promise<SearchSource[]> {
  const db = await getDb();
  if (!db) return [];

  const queryEmbedding = await getEmbedding(query);
  if (!queryEmbedding) return [];

  // Decide which source types to consider based on search mode (V11.15).
  // A Tudástár megszűnt — csak a feltöltött jogszabályok (regulation) chunk-jait
  // vesszük figyelembe. Web módban nincs szemantikus könyvtári találat.
  const includeRegulations = mode !== "web";
  const includeKnowledgeBase = false;

  type Row = {
    id: number;
    sourceType: "regulation" | "knowledge_base";
    sourceId: number;
    chunkIndex: number;
    text: string;
    embedding: number[];
  };

  let rows: Row[] = [];
  try {
    rows = await db
      .select({
        id: chunkEmbeddings.id,
        sourceType: chunkEmbeddings.sourceType,
        sourceId: chunkEmbeddings.sourceId,
        chunkIndex: chunkEmbeddings.chunkIndex,
        text: chunkEmbeddings.text,
        embedding: chunkEmbeddings.embedding,
      })
      .from(chunkEmbeddings) as Row[];
  } catch (err) {
    // Table may not exist yet on this environment (db:push not run for V12).
    console.error("[StandardsSearch] semantic search skipped (chunk_embeddings table missing?):", err);
    return [];
  }

  if (rows.length === 0) return [];

  // Score each chunk and group by (sourceType, sourceId).
  type Scored = { row: Row; score: number };
  const scored: Scored[] = [];
  for (const row of rows) {
    if (row.sourceType === "regulation" && !includeRegulations) continue;
    if (row.sourceType === "knowledge_base" && !includeKnowledgeBase) continue;
    if (!Array.isArray(row.embedding) || row.embedding.length === 0) continue;
    const score = cosineSimilarity(queryEmbedding, row.embedding);
    if (score > 0.1) scored.push({ row, score });
  }

  if (scored.length === 0) return [];

  // For mszt mode, further restrict to MSZT-sourced regulations
  let filteredScored = scored;
  if (mode === "mszt") {
    const regIds = Array.from(new Set(scored.filter((s) => s.row.sourceType === "regulation").map((s) => s.row.sourceId)));
    if (regIds.length === 0) return [];
    const msztRegs = await db
      .select({ id: regulationSources.id })
      .from(regulationSources)
      .where(eq(regulationSources.sourceType, "mszt"));
    const msztIds = new Set(msztRegs.map((r) => r.id));
    filteredScored = scored.filter((s) => s.row.sourceType === "regulation" && msztIds.has(s.row.sourceId));
  }

  filteredScored.sort((a, b) => b.score - a.score);
  const top = filteredScored.slice(0, topK);

  // Bulk-fetch the source names so the UI can display human-readable labels.
  const regIds = Array.from(new Set(top.filter((s) => s.row.sourceType === "regulation").map((s) => s.row.sourceId)));
  const kbIds = Array.from(new Set(top.filter((s) => s.row.sourceType === "knowledge_base").map((s) => s.row.sourceId)));

  const regNameById = new Map<number, { name: string; url: string | null }>();
  if (regIds.length > 0) {
    const regs = await db
      .select({ id: regulationSources.id, name: regulationSources.name, sourceUrl: regulationSources.sourceUrl })
      .from(regulationSources);
    for (const r of regs) {
      if (regIds.includes(r.id)) regNameById.set(r.id, { name: r.name, url: r.sourceUrl });
    }
  }

  const kbNameById = new Map<number, string>();
  if (kbIds.length > 0) {
    const docs = await db
      .select({ id: knowledgeBaseDocuments.id, name: knowledgeBaseDocuments.name, originalName: knowledgeBaseDocuments.originalName })
      .from(knowledgeBaseDocuments);
    for (const d of docs) {
      if (kbIds.includes(d.id)) kbNameById.set(d.id, d.name || d.originalName);
    }
  }

  return top.map(({ row, score }) => {
    if (row.sourceType === "regulation") {
      const meta = regNameById.get(row.sourceId);
      return {
        documentName: meta?.name ?? `Forrás #${row.sourceId}`,
        url: meta?.url ?? undefined,
        excerpt: row.text,
        relevanceScore: score,
        sourceType: "library",
      } satisfies SearchSource;
    }
    return {
      documentName: `Tudástár: ${kbNameById.get(row.sourceId) ?? `Doc #${row.sourceId}`}`,
      excerpt: row.text,
      relevanceScore: score,
      sourceType: "library",
    } satisfies SearchSource;
  });
}

// ── Hibrid keresés: normalizálás + cím-boost + rank fusion (V11.14) ─────────────

/**
 * Kisbetűsít + eltávolítja az ékezeteket — így "acél" matchel "Acelszerkezetek"-kel
 * (a régi szabvány-fájlnevek gyakran ékezet nélküliek).
 */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining diacritical marks
    .replace(/[^a-z0-9\s]/g, " ");
}

/** A kérdésből kinyeri a >3 karakteres tartalmi kulcsszavakat (normalizálva). */
function extractQueryKeywords(query: string): string[] {
  return normalizeForMatch(query)
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

/**
 * Cím-boost szorzó: hány kérdés-kulcsszó szerepel a dokumentum nevében.
 * A dokumentum neve erős téma-jel (pl. "acél" a kérdésben → MSZ EN 1993
 * "Acelszerkezetek"). Minden találat +12%-ot ad, maximum +48%.
 *
 * Megj.: egy korábbi kísérletben mérsékeltük ezt (+8%, max +24%), hogy a
 * téma-specifikus szabványok ne szoruljanak ki — de a mérséklés több jó
 * találatot rontott (öszvér → 1994, kihajlás → 1993-1-1 kiesett), mint amennyit
 * javított, ezért visszaállt az eredeti, jól kalibrált értékre.
 */
export function titleBoostFactor(queryKeywords: string[], documentName: string): number {
  if (queryKeywords.length === 0) return 1;
  const normName = normalizeForMatch(documentName);
  let matches = 0;
  for (const kw of queryKeywords) {
    if (normName.includes(kw)) matches++;
  }
  return 1 + Math.min(matches, 4) * 0.12;
}

/**
 * Hibrid forrás-egyesítés Reciprocal Rank Fusion-nel + cím-boosttal.
 *
 * A nyers score-ok (semantic cosine ~0.6 vs keyword ~0.5) NEM összemérhetők,
 * ezért rang-alapú fúziót használunk: minden listában a rang számít, nem az
 * abszolút pont. RRF: score = Σ 1/(K + rank). A K=60 a szakirodalmi default.
 * A végén a dokumentum-név téma-egyezése (cím-boost) szorozza a fúziós pontot,
 * így a kérdés tárgyához illő szabvány chunk-jai előrébb kerülnek.
 */
export function mergeSearchSources(
  keyword: SearchSource[],
  semantic: SearchSource[],
  maxItems: number,
  query = ""
): SearchSource[] {
  const K = 60;
  const queryKeywords = extractQueryKeywords(query);
  const keyOf = (s: SearchSource) => `${s.documentName}::${s.excerpt.slice(0, 80)}`;

  const fused = new Map<string, { source: SearchSource; score: number }>();
  const addList = (list: SearchSource[]) => {
    list.forEach((s, rank) => {
      const key = keyOf(s);
      const rrf = 1 / (K + rank);
      const existing = fused.get(key);
      if (existing) {
        existing.score += rrf;
      } else {
        fused.set(key, { source: s, score: rrf });
      }
    });
  };
  addList(semantic);
  addList(keyword);

  // Cím-boost alkalmazása a fúziós pontra.
  const boosted = Array.from(fused.values()).map(({ source, score }) => {
    const boost = titleBoostFactor(queryKeywords, source.documentName);
    return { source, score: score * boost };
  });

  // A nyers RRF-pont (~0.016–0.03) önmagában nem értelmes százalék — a UI 2%-ot
  // mutatott a legjobb találatra is. A top-találathoz normalizáljuk (legjobb =
  // 1.0), így a relevancia a forrás relatív erősségét jelzi.
  const sorted = boosted.sort((a, b) => b.score - a.score).slice(0, maxItems);
  const maxScore = sorted[0]?.score ?? 1;
  return sorted.map(({ source, score }) => ({
    ...source,
    relevanceScore: maxScore > 0 ? score / maxScore : 0,
  }));
}

/**
 * "Nincs lefedve" figyelmeztető szöveg — akkor jelenik meg, ha az önellenőrzés
 * megbukott, azaz a válasz nem vezethető vissza megbízhatóan a forrásokra.
 * A cél, hogy SOHA ne mutassunk magabiztos, de kitalált konkrétumot.
 */
function buildUnsupportedAnswerNotice(notes: string): string {
  const lines = [
    "**A betöltött szabványok ezt a kérdést nem fedik le megbízhatóan.**",
    "",
    "A rendszer talált kapcsolódó forrásokat (lásd a Hivatkozások szekciót), de az önellenőrzés szerint a válasz nem vezethető vissza egyértelműen ezekre. A megtévesztő, kitalált adatok elkerülése végett ezért nem jelenítünk meg konkrét választ.",
  ];
  if (notes) lines.push("", `_Az önellenőrzés észrevétele: ${notes}_`);
  lines.push("", "Javaslat: töltse fel a témához tartozó szabványt a Jogszabályok oldalon, vagy fogalmazza át a kérdést pontosabban.");
  return lines.join("\n");
}

/**
 * Generate a structured answer from sources using LLM.
 */
async function generateStructuredAnswer(
  question: string,
  rewrittenQuestion: string,
  sources: SearchSource[],
  answerLength: AnswerLength,
  operationMode: OperationMode
): Promise<StructuredAnswer> {
  if (sources.length === 0) {
    return {
      answer: "Nem található elegendő információ a rendelkezésre álló forrásokban a kérdés megválaszolásához.",
      confidence: "low",
      sources: [],
      hasSufficientSources: false,
      selfCheckPassed: false,
      selfCheckNotes: "Nincs releváns forrás.",
      rewrittenQuestion,
    };
  }

  const lengthInstruction = {
    short: "Adj maximum 3-4 mondatos tömör választ.",
    standard: "Adj maximum 8-10 mondatos szakmai választ.",
    detailed: "Adj részletes, 15-20 mondatos szakmai magyarázatot.",
  }[answerLength];

  const modeInstruction = operationMode === "accurate"
    ? `Kizárólag a megadott forrásokból dolgozz. Minden állítást forráshivatkozással [n] támasszál alá.
KRITIKUS: ha a források NEM tartalmazzák a kérdésre a választ, akkor KIZÁRÓLAG ennyit írj:
"A betöltött szabványok ezt a kérdést nem fedik le." — és semmi mást.
SOHA ne találj ki konkrét számokat, méreteket, szilárdsági/anyagosztályokat, határértékeket,
képleteket vagy szabvány-jelöléseket, amelyek nem szerepelnek szó szerint a forrásokban. Ha
bizonytalan vagy, hogy egy adat a forrásból származik-e, ne írd le.`
    : "Elsősorban a megadott forrásokból dolgozz, de szükség esetén általános mérnöki tudást is felhasználhatsz – ebben az esetben jelöld meg, hogy ez nem forrásból származik.";

  const sourcesText = sources
    .map((s, i) => `[${i + 1}] ${s.documentName}\n${s.excerpt}`)
    .join("\n\n---\n\n");

  const systemPrompt = `Te egy magyar mérnöki szabvány-tanácsadó AI vagy.
${modeInstruction}
${lengthInstruction}
A válasz végén add meg a felhasznált forrásokat strukturált formában.
Válaszolj szakmai, tömör stílusban. Ne spekulálj, ne hallucináld az adatokat.`;

  const userPrompt = `Kérdés: "${question}"
${rewrittenQuestion !== question ? `Pontosított kérdés: "${rewrittenQuestion}"` : ""}

Rendelkezésre álló források:
${sourcesText}

Kérlek, válaszolj a kérdésre a fenti források alapján. Jelöld meg a hivatkozásokat [1], [2] stb. formátumban.`;

  let answer = "";
  let confidence: Confidence = "medium";

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const rawContent = response.choices?.[0]?.message?.content;
    answer = typeof rawContent === "string" ? rawContent.trim() : "";
  } catch (err) {
    console.error("[StandardsSearch] LLM error:", err);
    return {
      answer: "Hiba történt a válasz generálása során. Kérjük, próbálja újra.",
      confidence: "low",
      sources,
      hasSufficientSources: true,
      selfCheckPassed: false,
      selfCheckNotes: "LLM hiba.",
      rewrittenQuestion,
    };
  }

  // ── Self-check (accurate mode only) ──────────────────────────────────────────
  let selfCheckPassed = true;
  let selfCheckNotes = "";

  if (operationMode === "accurate" && answer) {
    try {
      const checkResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Te egy ellenőrző AI vagy. Két különböző dolgot értékelj:
- "answerable": a megadott források TARTALMAZNAK-E a kérdésre vonatkozó érdemi információt? (Igaz akkor is, ha a válasz nem tökéletes, de a téma le van fedve. Hamis, ha a források egyáltalán nem a kérdés tárgyáról szólnak.)
- "passed": a válasz MINDEN konkrét állítása (számok, értékek, hivatkozások) pontosan visszavezethető-e a forrásokra?
Adj vissza JSON-t: { "answerable": boolean, "passed": boolean, "issues": string[], "confidence": "low"|"medium"|"high" }`,
          },
          {
            role: "user",
            content: `Kérdés: ${answer ? "(lásd a választ)" : ""}\n\nGenerált válasz:\n${answer}\n\nForrások:\n${sourcesText}\n\nÉrtékelés:`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "self_check",
            strict: true,
            schema: {
              type: "object",
              properties: {
                answerable: { type: "boolean" },
                passed: { type: "boolean" },
                issues: { type: "array", items: { type: "string" } },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
              },
              required: ["answerable", "passed", "issues", "confidence"],
              additionalProperties: false,
            },
          },
        },
      });

      const checkContent = checkResponse.choices?.[0]?.message?.content;
      let answerable = true;
      if (checkContent && typeof checkContent === "string") {
        const checkResult = JSON.parse(checkContent);
        answerable = checkResult.answerable !== false;
        selfCheckPassed = checkResult.passed;
        selfCheckNotes = checkResult.issues?.join("; ") ?? "";
        confidence = checkResult.confidence as Confidence;
      }

      // V11.17 megbízhatósági kapu — két különböző eset, hogy a hallucinációt
      // kiszűrjük, DE a jó (csak kissé pontatlan) válaszokat NE dobjuk el:
      if (!answerable) {
        // A források egyáltalán nem fedik le a kérdést → a magabiztos, esetleg
        // hallucinált prózát lecseréljük egyértelmű figyelmeztetésre.
        confidence = "low";
        selfCheckPassed = false;
        answer = buildUnsupportedAnswerNotice(selfCheckNotes);
      } else if (!selfCheckPassed && confidence === "high") {
        // Van érdemi forrás, de a válasz nem tökéletesen pontos → megtartjuk a
        // választ (a self-check megjegyzés jelzi a felhasználónak), de a
        // megbízhatóság nem lehet "high".
        confidence = "medium";
      }
    } catch {
      // Self-check failed silently – don't block the answer
      confidence = "medium";
    }
  } else {
    confidence = sources.length >= 3 ? "high" : sources.length >= 1 ? "medium" : "low";
  }

  return {
    answer,
    confidence,
    sources,
    hasSufficientSources: true,
    selfCheckPassed,
    selfCheckNotes,
    rewrittenQuestion,
  };
}

/**
 * Generate an extended answer based on the original answer and sources.
 */
async function generateExtendedAnswer(
  question: string,
  originalAnswer: string,
  sources: SearchSource[]
): Promise<string> {
  const sourcesText = sources
    .map((s, i) => `[${i + 1}] ${s.documentName}\n${s.excerpt}`)
    .join("\n\n---\n\n");

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Te egy magyar mérnöki szabvány-tanácsadó AI vagy.
Bővítsd ki az alábbi választ részletesebb szakmai magyarázattal.
Kizárólag a megadott forrásokra támaszkodj – ne adj hozzá forrás nélküli információt.
Adj részletes, 20-25 mondatos szakmai magyarázatot, több hivatkozással.`,
        },
        {
          role: "user",
          content: `Kérdés: "${question}"\n\nEredeti válasz:\n${originalAnswer}\n\nForrások:\n${sourcesText}\n\nBővített válasz:`,
        },
      ],
    });
    const rawExt = response.choices?.[0]?.message?.content;
    return typeof rawExt === "string" ? rawExt.trim() : originalAnswer;
  } catch {
    return originalAnswer;
  }
}

// ── Router ─────────────────────────────────────────────────────────────────────

export const standardsSearchRouter = router({
  /**
   * Main search endpoint – query rewriting + hybrid search + structured answer
   */
  search: publicProcedure
    .input(
      z.object({
        question: z.string().min(3).max(1000),
        searchMode: z.enum(["mszt", "internal", "combined", "web", "combined_with_web"]).default("internal"),
        answerLength: z.enum(["short", "standard", "detailed"]).default("standard"),
        operationMode: z.enum(["fast", "accurate"]).default("accurate"),
        projectId: z.number().int().positive().optional(),
        projectName: z.string().optional(),
        urls: z.array(z.string().url()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { question, searchMode, answerLength, operationMode, projectId, projectName, urls } = input;

      // Step 1: Rewrite query
      const rewrittenQuestion = operationMode === "accurate"
        ? await rewriteQuery(question)
        : question;

      // Step 2: Hybrid search — 3 mód (V11.15 egyszerűsítés):
      //   web                = csak internet
      //   combined_with_web  = feltöltött jogszabályok + internet
      //   internal (default) = csak a feltöltött jogszabályok (regulation_sources)
      // A Tudástár (searchKnowledgeBase) és az élő MSZT keresés megszűnt.
      let sources: SearchSource[] = [];

      if (searchMode === "web") {
        // Internet-only search: use provided URLs if given, else DuckDuckGo
        if (urls && urls.length > 0) {
          sources = await fetchUrlSources(urls, rewrittenQuestion);
        } else {
          sources = await webSearchStandards(rewrittenQuestion, true);
        }
      } else if (searchMode === "combined_with_web") {
        // Feltöltött jogszabályok (keyword + szemantikus) + internet
        const webSources = urls && urls.length > 0
          ? await fetchUrlSources(urls, rewrittenQuestion)
          : await webSearchStandards(rewrittenQuestion, true);
        const libSources = await keywordSearch(rewrittenQuestion, "internal");
        const semanticSources = await semanticSearch(rewrittenQuestion, "internal");
        const allLibrary = mergeSearchSources(libSources, semanticSources, 8, rewrittenQuestion);
        const seenUrls = new Set(allLibrary.map((s: SearchSource) => s.url).filter(Boolean));
        const dedupedWeb = webSources.filter((s: SearchSource) => !s.url || !seenUrls.has(s.url));
        sources = [...allLibrary, ...dedupedWeb].slice(0, 10);
      } else {
        // internal (és bármely legacy érték) — csak a feltöltött jogszabályok
        const libSources = await keywordSearch(rewrittenQuestion, "internal");
        const semanticSources = await semanticSearch(rewrittenQuestion, "internal");
        sources = mergeSearchSources(libSources, semanticSources, 10, rewrittenQuestion);
      }

      // Step 3: Generate structured answer
      const result = await generateStructuredAnswer(
        question,
        rewrittenQuestion,
        sources,
        answerLength,
        operationMode
      );

      // Step 4: Persist to search history
      const db = await getDb();
      let queryId: number | undefined;
      if (db) {
        try {
          const inserted = await db.insert(searchQueries).values({
            question,
            rewrittenQuestion: result.rewrittenQuestion,
            searchMode,
            answerLength,
            operationMode,
            answer: result.answer,
            confidence: result.confidence,
            sources: result.sources,
            hasSufficientSources: result.hasSufficientSources,
            selfCheckPassed: result.selfCheckPassed,
            selfCheckNotes: result.selfCheckNotes,
            projectId: projectId ?? null,
            projectName,
          });
          queryId = (inserted as any).insertId;
        } catch (err) {
          console.error("[StandardsSearch] Failed to save query:", err);
        }
      }

      return {
        queryId,
        ...result,
      };
    }),

  /**
   * Generate extended answer for an existing search result
   */
  extendAnswer: publicProcedure
    .input(
      z.object({
        queryId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

      const rows = await db.select().from(searchQueries).where(eq(searchQueries.id, input.queryId)).limit(1);
      const query = rows[0];
      if (!query) throw new TRPCError({ code: "NOT_FOUND", message: "Keresés nem található." });
      if (!query.answer) throw new TRPCError({ code: "BAD_REQUEST", message: "Nincs alap válasz a bővítéshez." });

      // Return cached extended answer if available
      if (query.extendedAnswer) {
        return { extendedAnswer: query.extendedAnswer };
      }

      const extendedAnswer = await generateExtendedAnswer(
        query.question,
        query.answer,
        (query.sources as SearchSource[]) ?? []
      );

      // Cache the extended answer
      await db.update(searchQueries)
        .set({ extendedAnswer })
        .where(eq(searchQueries.id, input.queryId));

      return { extendedAnswer };
    }),

  /**
   * List search history
   */
  listHistory: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        projectId: z.number().int().positive().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      try {
        const conditions = [];
        if (input.search) {
          conditions.push(
            or(
              like(searchQueries.question, `%${input.search}%`),
              like(searchQueries.answer, `%${input.search}%`)
            )
          );
        }
        if (input.projectId !== undefined) {
          conditions.push(eq(searchQueries.projectId, input.projectId));
        }

        const baseQuery = db.select().from(searchQueries);
        const filtered = conditions.length > 0
          ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
          : baseQuery;

        const items = await filtered
          .orderBy(desc(searchQueries.createdAt))
          .limit(input.limit)
          .offset(input.offset);

        return { items, total: items.length };
      } catch (err) {
        console.error("[StandardsSearch] listHistory error:", err);
        return { items: [], total: 0 };
      }
    }),

  /**
   * Get single search query by ID
   */
  getQuery: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

      const rows = await db.select().from(searchQueries).where(eq(searchQueries.id, input.id)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Keresés nem található." });
      return rows[0];
    }),

  /**
   * Delete a search query from history
   */
  deleteQuery: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

      await db.delete(searchQueries).where(eq(searchQueries.id, input.id));
      return { success: true };
    }),
});
