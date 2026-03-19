import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import {
  createAnalysis,
  getAnalysisById,
  listAnalyses,
  updateAnalysisStatus,
} from "../db";
import type { ComplianceResult, ComplianceStatus } from "../../drizzle/schema";
import { nanoid } from "nanoid";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer using pdf-parse (pure JS, no native deps).
 * Falls back to a simple binary-safe extraction if the library is unavailable.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // Dynamically import to avoid issues if not installed
    const pdfModule = await import("pdf-parse");
    const pdfParse = (pdfModule as any).default ?? pdfModule;
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch {
    // Fallback: extract printable ASCII from the binary
    return buffer
      .toString("latin1")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s{3,}/g, "\n")
      .slice(0, 50000);
  }
}

/**
 * Split a long text into overlapping chunks for LLM processing.
 */
function chunkText(text: string, chunkSize = 3000, overlap = 300): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += chunkSize - overlap;
  }
  return chunks;
}

/**
 * Run the AI compliance analysis between a plan document and regulation chunks.
 */
async function runComplianceAnalysis(
  planText: string,
  regulationText: string,
  planName: string,
  regulationNames: string[]
): Promise<{ results: ComplianceResult[]; summary: string }> {
  const planChunks = chunkText(planText, 4000, 400);
  const regulationChunks = chunkText(regulationText, 4000, 400);

  // Use the first 2 plan chunks and first 3 regulation chunks for the pilot
  const planExcerpt = planChunks.slice(0, 2).join("\n\n---\n\n");
  const regulationExcerpt = regulationChunks.slice(0, 3).join("\n\n---\n\n");

  const systemPrompt = `Te egy tapasztalt mérnöki tervmegfelelőség-ellenőrző AI rendszer vagy. 
Feladatod: összehasonlítani egy tervdokumentumot a vonatkozó jogszabályokkal/szabványokkal, 
és strukturált megfelelőségi értékelést adni.

Minden ellenőrzési ponthoz add meg:
- title: rövid, egyértelmű cím (max 80 karakter)
- description: mit vizsgáltál (1-2 mondat)
- status: "megfelel", "bizonytalan", vagy "nem_felel_meg"
- justification: részletes indoklás (2-4 mondat)
- reference: konkrét szabályhivatkozás (pl. "MSZ EN 1990:2005 3.1 fejezet")
- category: kategória (pl. "Teherbírás", "Tűzvédelem", "Anyagminőség", "Geometria", "Dokumentáció")

Legyél precíz, szakmai és objektív. Ha az információ nem elegendő, jelöld "bizonytalan"-ként.
Minimum 5, maximum 12 ellenőrzési pontot adj meg.`;

  const userPrompt = `TERVDOKUMENTUM (${planName}):
${planExcerpt}

JOGSZABÁLYOK/SZABVÁNYOK (${regulationNames.join(", ")}):
${regulationExcerpt}

Végezd el a megfelelőség-ellenőrzést és adj strukturált JSON választ az alábbi sémában:
{
  "results": [
    {
      "id": "unique-id",
      "title": "...",
      "description": "...",
      "status": "megfelel|bizonytalan|nem_felel_meg",
      "justification": "...",
      "reference": "...",
      "category": "..."
    }
  ],
  "summary": "Összefoglaló értékelés 2-3 mondatban"
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "compliance_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  status: { type: "string", enum: ["megfelel", "bizonytalan", "nem_felel_meg"] },
                  justification: { type: "string" },
                  reference: { type: "string" },
                  category: { type: "string" },
                },
                required: ["id", "title", "description", "status", "justification", "reference", "category"],
                additionalProperties: false,
              },
            },
            summary: { type: "string" },
          },
          required: ["results", "summary"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("LLM did not return a response");
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

  const parsed = JSON.parse(content);
  return {
    results: parsed.results as ComplianceResult[],
    summary: parsed.summary as string,
  };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const complianceRouter = router({
  /**
   * Get a pre-signed upload URL for a PDF file.
   * Returns the S3 key and a public URL after upload.
   */
  uploadDocument: publicProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string().default("application/pdf"),
        base64: z.string(), // base64-encoded file content
      })
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const key = `compliance-docs/${nanoid()}-${input.filename}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      return { key, url };
    }),

  /**
   * Start a new compliance analysis.
   * Uploads documents, extracts text, runs AI analysis.
   */
  startAnalysis: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        planDocument: z.object({
          key: z.string(),
          name: z.string(),
          base64: z.string(),
        }),
        regulationDocuments: z.array(
          z.object({
            key: z.string().optional(),
            name: z.string(),
            base64: z.string(),
            sourceId: z.number().optional(), // reference to regulation_sources table
          })
        ).min(0).default([]),
        // Additional plan document names for multi-doc support
        planDocumentNames: z.array(z.string()).optional(),
        // Library regulation source IDs
        regulationSourceIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Create analysis record
      const allRegNames = input.regulationDocuments
        .filter((d) => !d.name.startsWith("__lib_source_"))
        .map((d) => d.name);
      const analysisId = await createAnalysis({
        title: input.title,
        status: "processing",
        planDocuments: (input.planDocumentNames ?? [input.planDocument.name]).map((name) => ({
          key: "",
          name,
          fileType: "pdf" as const,
        })),
        regulationDocumentNames: allRegNames,
        regulationSourceIds: input.regulationSourceIds ?? [],
      });

      // 2. Process asynchronously (fire and forget)
      processAnalysis(analysisId, input).catch((err) => {
        console.error(`[Analysis ${analysisId}] Failed:`, err);
        updateAnalysisStatus(analysisId, "error", {
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });

      return { analysisId };
    }),

  /**
   * Get the status and results of an analysis.
   */
  getAnalysis: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const analysis = await getAnalysisById(input.id);
      if (!analysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Elemzés nem található" });
      }
      return analysis;
    }),

  /**
   * List all analyses (most recent first).
   */
  listAnalyses: publicProcedure.query(async () => {
    return listAnalyses();
  }),
});

// ── Background processing ─────────────────────────────────────────────────────

async function processAnalysis(
  analysisId: number,
  input: {
    title: string;
    planDocument: { key: string; name: string; base64: string };
    regulationDocuments: Array<{ key?: string; name: string; base64: string; sourceId?: number }>;
    planDocumentNames?: string[];
    regulationSourceIds?: number[];
  }
): Promise<void> {
  try {
    // Extract text from plan PDF (primary document)
    const planBuffer = Buffer.from(input.planDocument.base64, "base64");
    const planText = await extractTextFromDocument(planBuffer, input.planDocument.name);

    // Extract text from uploaded regulation documents
    const regulationTexts: string[] = [];
    const regulationNames: string[] = [];

    for (const doc of input.regulationDocuments) {
      // Skip library source placeholders
      if (doc.name.startsWith("__lib_source_")) continue;
      if (!doc.base64) continue;
      const buf = Buffer.from(doc.base64, "base64");
      const text = await extractTextFromDocument(buf, doc.name);
      regulationTexts.push(`=== ${doc.name} ===\n${text}`);
      regulationNames.push(doc.name);
    }

    // Fetch text from library regulation sources
    if (input.regulationSourceIds && input.regulationSourceIds.length > 0) {
      try {
        const { getDb } = await import("../db");
        const { regulationSources } = await import("../../drizzle/schema");
        const { inArray } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          const sources = await db
            .select()
            .from(regulationSources)
            .where(inArray(regulationSources.id, input.regulationSourceIds));
          for (const src of sources) {
            if (src.content) {
              regulationTexts.push(`=== ${src.name} ===\n${src.content}`);
              regulationNames.push(src.name);
            } else {
              // Try to fetch on-the-fly for free sources
              if (["njt", "netjogtar", "url"].includes(src.sourceType) && src.sourceUrl) {
                try {
                  const { fetchRegulationText } = await import("../regulationScraper");
                  const fetched = await fetchRegulationText(src.sourceType as any, src.sourceUrl);
                  if (fetched.text) {
                    regulationTexts.push(`=== ${src.name} ===\n${fetched.text}`);
                    regulationNames.push(src.name);
                    // Cache it
                    const { eq } = await import("drizzle-orm");
                    await db.update(regulationSources).set({
                      content: fetched.text.slice(0, 65000),
                      contentFetchedAt: fetched.fetchedAt,
                    }).where(eq(regulationSources.id, src.id));
                  }
                } catch (fetchErr) {
                  console.warn(`[Analysis ${analysisId}] Could not fetch source ${src.id}:`, fetchErr);
                  regulationTexts.push(`=== ${src.name} ===\n[Tartalom nem elérhető – bejelentkezés szükséges]`);
                  regulationNames.push(src.name);
                }
              } else {
                regulationTexts.push(`=== ${src.name} ===\n[Tartalom nem elérhető – kérjük töltse le a jogszabály könyvtárban]`);
                regulationNames.push(src.name);
              }
            }
          }
        }
      } catch (dbErr) {
        console.warn(`[Analysis ${analysisId}] DB error fetching library sources:`, dbErr);
      }
    }

    const combinedRegulationText = regulationTexts.join("\n\n");

    // Run AI analysis
    const { results, summary } = await runComplianceAnalysis(
      planText,
      combinedRegulationText,
      input.planDocument.name,
      regulationNames
    );

    // Update analysis with results
    await updateAnalysisStatus(analysisId, "completed", { results, summary });
  } catch (err) {
    await updateAnalysisStatus(analysisId, "error", {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Extract text from a document buffer, supporting multiple file types.
 */
async function extractTextFromDocument(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  
  if (ext === "pdf") {
    return extractTextFromPdf(buffer);
  }
  
  if (["docx", "doc"].includes(ext)) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch {
      return buffer.toString("utf8").replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F]/g, " ").slice(0, 50000);
    }
  }
  
  if (["xlsx", "xls"].includes(ext)) {
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const texts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const csv = XLSX.utils.sheet_to_csv(sheet);
          texts.push(`[Munkalap: ${sheetName}]\n${csv}`);
        }
      }
      return texts.join("\n\n").slice(0, 50000);
    } catch {
      return "[Excel fájl – szöveg kinyerés sikertelen]";
    }
  }
  
  if (["dwg", "dxf"].includes(ext)) {
    // DWG/DXF: extract text entities from DXF (ASCII format)
    const text = buffer.toString("utf8", 0, Math.min(buffer.length, 100000));
    const textEntities: string[] = [];
    const lines = text.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i]?.trim() === "1" && lines[i + 1]) {
        const val = lines[i + 1].trim();
        if (val.length > 1 && val.length < 500 && !/^[0-9\s\-\.]+$/.test(val)) {
          textEntities.push(val);
        }
      }
    }
    return textEntities.length > 0
      ? `[${ext.toUpperCase()} rajzfájl szöveges elemei:]\n` + textEntities.join("\n")
      : `[${ext.toUpperCase()} rajzfájl – szöveges tartalom nem kinyerhető automatikusan]`;
  }
  
  if (ext === "ifc") {
    // IFC is a text-based format (STEP/EXPRESS)
    const text = buffer.toString("utf8", 0, Math.min(buffer.length, 100000));
    // Extract IFCSPACE, IFCZONE, IFCBUILDINGSTOREY, property sets
    const relevant = text
      .split("\n")
      .filter((line) => /IFC(SPACE|ZONE|BUILDING|STOREY|PROPERTY|WALL|SLAB|BEAM|COLUMN|DOOR|WINDOW)/i.test(line))
      .slice(0, 2000)
      .join("\n");
    return relevant || `[IFC BIM fájl – ${buffer.length} bájt, szöveges tartalom kinyerve]`;
  }
  
  // Fallback: try UTF-8 text
  return buffer.toString("utf8").replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F]/g, " ").slice(0, 50000);
}
