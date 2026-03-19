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
          })
        ).min(1),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Create analysis record
      const analysisId = await createAnalysis({
        title: input.title,
        status: "processing",
        planDocumentName: input.planDocument.name,
        regulationDocumentNames: input.regulationDocuments.map((d) => d.name),
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
    regulationDocuments: Array<{ key?: string; name: string; base64: string }>;
  }
): Promise<void> {
  try {
    // Extract text from plan PDF
    const planBuffer = Buffer.from(input.planDocument.base64, "base64");
    const planText = await extractTextFromPdf(planBuffer);

    // Extract text from all regulation PDFs
    const regulationTexts: string[] = [];
    for (const doc of input.regulationDocuments) {
      const buf = Buffer.from(doc.base64, "base64");
      const text = await extractTextFromPdf(buf);
      regulationTexts.push(`=== ${doc.name} ===\n${text}`);
    }
    const combinedRegulationText = regulationTexts.join("\n\n");

    // Run AI analysis
    const { results, summary } = await runComplianceAnalysis(
      planText,
      combinedRegulationText,
      input.planDocument.name,
      input.regulationDocuments.map((d) => d.name)
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
