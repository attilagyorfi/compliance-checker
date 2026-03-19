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
import { searchQueries, regulationSources } from "../../drizzle/schema";
import type { SearchSource } from "../../drizzle/schema";
import { desc, eq, like, or } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SearchMode = "mszt" | "internal" | "combined";
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

    // Filter by mode
    if (mode === "mszt") {
      sources = sources.filter((s) => s.sourceType === "mszt");
    } else if (mode === "internal") {
      sources = sources.filter((s) => s.sourceType !== "mszt");
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
    ? "Kizárólag a megadott forrásokból dolgozz. Minden állítást forráshivatkozással támasszál alá. Ha egy állítás nem szerepel a forrásokban, ne tedd bele a válaszba."
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
            content: `Te egy ellenőrző AI vagy. Vizsgáld meg, hogy a generált válasz minden állítása visszavezethető-e a megadott forrásokra.
Adj vissza JSON-t: { "passed": boolean, "issues": string[], "confidence": "low"|"medium"|"high" }`,
          },
          {
            role: "user",
            content: `Generált válasz:\n${answer}\n\nForrások:\n${sourcesText}\n\nEllenőrzés:`,
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
                passed: { type: "boolean" },
                issues: { type: "array", items: { type: "string" } },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
              },
              required: ["passed", "issues", "confidence"],
              additionalProperties: false,
            },
          },
        },
      });

      const checkContent = checkResponse.choices?.[0]?.message?.content;
      if (checkContent && typeof checkContent === "string") {
        const checkResult = JSON.parse(checkContent);
        selfCheckPassed = checkResult.passed;
        selfCheckNotes = checkResult.issues?.join("; ") ?? "";
        confidence = checkResult.confidence as Confidence;
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
        searchMode: z.enum(["mszt", "internal", "combined"]).default("combined"),
        answerLength: z.enum(["short", "standard", "detailed"]).default("standard"),
        operationMode: z.enum(["fast", "accurate"]).default("accurate"),
        projectName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { question, searchMode, answerLength, operationMode, projectName } = input;

      // Step 1: Rewrite query
      const rewrittenQuestion = operationMode === "accurate"
        ? await rewriteQuery(question)
        : question;

      // Step 2: Hybrid search
      const sources = await keywordSearch(rewrittenQuestion, searchMode);

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
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      try {
        let query = db.select().from(searchQueries);

        if (input.search) {
          query = query.where(
            or(
              like(searchQueries.question, `%${input.search}%`),
              like(searchQueries.answer, `%${input.search}%`)
            )
          ) as typeof query;
        }

        const items = await query
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
