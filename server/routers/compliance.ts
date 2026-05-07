import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import {
  createAnalysis,
  getAnalysisById,
  listAnalyses,
  updateAnalysisStatus,
} from "../db";
import type { ComplianceResult, ComplianceSeverity, ComplianceStatus } from "../../drizzle/schema";
import { nanoid } from "nanoid";
import { buildRelevantExcerpt } from "../relevanceChunker";
import { auditLog } from "../auditLog";
import { runWithRetry } from "../analysisQueue";

// ── OCR detection ─────────────────────────────────────────────────────────────

/**
 * Detect if a PDF is likely scanned (low text density per page).
 * Returns true if the extracted text is suspiciously short relative to file size.
 */
function isLikelyScanned(text: string, fileSize: number): boolean {
  const textDensity = text.length / Math.max(fileSize, 1);
  return textDensity < 0.01 && text.length < 500;
}

/**
 * Attempt OCR on a PDF buffer using tesseract.js.
 * Falls back gracefully if not available.
 */
async function ocrPdf(buffer: Buffer): Promise<{ text: string; used: boolean }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Tesseract = require("tesseract.js");
    const { data } = await Tesseract.recognize(buffer, "hun+eng", {
      logger: () => {}, // suppress progress logs
    });
    return { text: data.text, used: true };
  } catch {
    return { text: "", used: false };
  }
}

// ── Text extraction ───────────────────────────────────────────────────────────

async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; ocrUsed: boolean; qualityWarning?: string }> {
  try {
    const pdfModule = await import("pdf-parse");
    const pdfParse = (pdfModule as any).default ?? pdfModule;
    const data = await pdfParse(buffer);
    const text = data.text || "";

    // Check if OCR might be needed
    if (isLikelyScanned(text, buffer.length)) {
      const ocr = await ocrPdf(buffer);
      if (ocr.used && ocr.text.length > text.length) {
        return {
          text: ocr.text,
          ocrUsed: true,
          qualityWarning: "A dokumentum szkennelt PDF-nek tűnik. Az OCR feldolgozás pontossága korlátozott lehet.",
        };
      }
      return {
        text: text || ocr.text,
        ocrUsed: ocr.used,
        qualityWarning: text.length < 200
          ? "A dokumentumból kevés szöveg nyerhető ki. Az elemzés pontossága korlátozott lehet."
          : undefined,
      };
    }

    return { text, ocrUsed: false };
  } catch {
    return {
      text: buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, "\n").slice(0, 50000),
      ocrUsed: false,
      qualityWarning: "PDF feldolgozási hiba – szöveg részlegesen kinyerve.",
    };
  }
}

async function extractTextFromDocument(buffer: Buffer, filename: string): Promise<{ text: string; ocrUsed: boolean; qualityWarning?: string }> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (["pdf"].includes(ext)) {
    return extractTextFromPdf(buffer);
  }
  try {
    const { extractDocumentText } = await import("../documentExtractor");
    const result = await extractDocumentText(buffer, filename);
    return { text: result.text, ocrUsed: false };
  } catch {
    return { text: buffer.toString("utf8").slice(0, 50000), ocrUsed: false };
  }
}

// ── AI compliance analysis ────────────────────────────────────────────────────

async function runComplianceAnalysis(
  planText: string,
  regulationText: string,
  planName: string,
  regulationNames: string[]
): Promise<{ results: ComplianceResult[]; summary: string }> {
  // Use relevance-based chunking instead of fixed first-N chunks
  const planExcerpt = planText.slice(0, 6000);
  const regulationExcerpt = buildRelevantExcerpt(planText, regulationText, 5, 3500, 350);

  const systemPrompt = `Te egy tapasztalt mérnöki tervmegfelelőség-ellenőrző AI rendszer vagy.
Feladatod: összehasonlítani egy tervdokumentumot a vonatkozó jogszabályokkal/szabványokkal,
és strukturált, bizonyíték-alapú megfelelőségi értékelést adni.

Minden ellenőrzési ponthoz add meg:
- id: egyedi azonosító (pl. "finding-001")
- title: rövid, egyértelmű cím (max 80 karakter)
- description: mit vizsgáltál (1-2 mondat)
- status: "megfelel", "reszben_megfelel", "bizonytalan", vagy "nem_felel_meg"
- severity: "kritikus", "kozepes", vagy "alacsony" (csak ha status nem "megfelel")
- confidence: 0-100 közötti egész szám (mennyire biztos az értékelés)
- justification: részletes indoklás (2-4 mondat)
- regulationExcerpt: szó szerinti idézet a jogszabályból/szabványból (max 200 karakter)
- planExcerpt: szó szerinti idézet a tervdokumentumból (max 200 karakter), ha releváns
- reference: konkrét szabályhivatkozás (pl. "MSZ EN 1990:2005 3.1 fejezet")
- category: kategória (pl. "Teherbírás", "Tűzvédelem", "Anyagminőség", "Geometria", "Dokumentáció")
- nextStep: ajánlott következő lépés (1 mondat), ha status nem "megfelel"
- uncertaintyReason: a bizonytalanság oka (1 mondat), ha status "bizonytalan"

Legyél precíz, szakmai és objektív. Ha az információ nem elegendő, jelöld "bizonytalan"-ként.
Minimum 5, maximum 15 ellenőrzési pontot adj meg.`;

  const userPrompt = `TERVDOKUMENTUM (${planName}):
${planExcerpt}

JOGSZABÁLYOK/SZABVÁNYOK (${regulationNames.join(", ")}):
${regulationExcerpt}

Végezd el a megfelelőség-ellenőrzést és adj strukturált JSON választ.`;

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
                  status: { type: "string", enum: ["megfelel", "reszben_megfelel", "bizonytalan", "nem_felel_meg"] },
                  severity: { type: "string", enum: ["kritikus", "kozepes", "alacsony"] },
                  confidence: { type: "integer" },
                  justification: { type: "string" },
                  regulationExcerpt: { type: "string" },
                  planExcerpt: { type: "string" },
                  reference: { type: "string" },
                  category: { type: "string" },
                  nextStep: { type: "string" },
                  uncertaintyReason: { type: "string" },
                },
                required: ["id", "title", "description", "status", "severity", "confidence", "justification", "regulationExcerpt", "planExcerpt", "reference", "category", "nextStep", "uncertaintyReason"],
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

  // Enrich results with default workflowStatus
  const results: ComplianceResult[] = (parsed.results as ComplianceResult[]).map((r) => ({
    ...r,
    workflowStatus: "nyitott" as const,
    severity: (r.severity ?? "alacsony") as ComplianceSeverity,
    confidence: typeof r.confidence === "number" ? r.confidence : 50,
  }));

  return { results, summary: parsed.summary as string };
}

// ── Router ────────────────────────────────────────────────────────────────────

export const complianceRouter = router({
  /**
   * Upload a document to S3 and return its key and URL.
   */
  uploadDocument: publicProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string().default("application/pdf"),
        base64: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const key = `compliance-docs/${nanoid()}-${input.filename}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      await auditLog({
        userId: ctx.user?.id,
        userEmail: ctx.user?.email ?? undefined,
        eventType: "document_upload",
        resourceType: "document",
        resourceId: key,
        description: `Dokumentum feltöltve: ${input.filename}`,
        metadata: { filename: input.filename, contentType: input.contentType, size: buffer.length },
      });
      return { key, url };
    }),

  /**
   * Start a new compliance analysis with queue + retry support.
   */
  startAnalysis: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        projectId: z.number().optional(),
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
            sourceId: z.number().optional(),
          })
        ).min(0).default([]),
        planDocumentNames: z.array(z.string()).optional(),
        regulationSourceIds: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allRegNames = input.regulationDocuments
        .filter((d) => !d.name.startsWith("__lib_source_"))
        .map((d) => d.name);

      const analysisId = await createAnalysis({
        title: input.title,
        status: "processing",
        projectId: input.projectId ?? null,
        userId: ctx.user?.id ?? null,
        planDocuments: (input.planDocumentNames ?? [input.planDocument.name]).map((name) => ({
          key: "",
          name,
          fileType: "pdf" as const,
        })),
        regulationDocumentNames: allRegNames,
        regulationSourceIds: input.regulationSourceIds ?? [],
      });

      await auditLog({
        userId: ctx.user?.id,
        userEmail: ctx.user?.email ?? undefined,
        eventType: "analysis_start",
        resourceType: "analysis",
        resourceId: analysisId,
        description: `Elemzés indítva: ${input.title}`,
        metadata: { title: input.title, projectId: input.projectId, regulationCount: allRegNames.length },
      });

      // Fire and forget with queue + retry
      runWithRetry(
        analysisId,
        () => processAnalysis(analysisId, input),
        async (status, error) => {
          if (status === "failed") {
            await auditLog({
              userId: ctx.user?.id,
              userEmail: ctx.user?.email ?? undefined,
              eventType: "analysis_error",
              resourceType: "analysis",
              resourceId: analysisId,
              description: `Elemzés sikertelen: ${error}`,
            });
          } else if (status === "completed") {
            await auditLog({
              userId: ctx.user?.id,
              userEmail: ctx.user?.email ?? undefined,
              eventType: "analysis_complete",
              resourceType: "analysis",
              resourceId: analysisId,
              description: `Elemzés kész: ${input.title}`,
            });
          }
        }
      ).catch((err) => {
        console.error(`[Analysis ${analysisId}] Failed after retries:`, err);
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
   * List analyses (most recent first). Optionally filtered by project.
   */
  listAnalyses: publicProcedure
    .input(z.object({ projectId: z.number().int().positive().optional() }).optional())
    .query(async ({ input }) => {
      return listAnalyses(input?.projectId ? { projectId: input.projectId } : undefined);
    }),

  /**
   * Update the workflow status of an analysis.
   */
  updateWorkflowStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      workflowStatus: z.enum(["uj", "elemzes_alatt", "ai_eloelenorizve", "ember_felulvizsgalva", "javitasra_visszakuldve", "lezart"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const { getDb: _getDb } = await import("../db");
      const db = await _getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
      const { analyses } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(analyses).set({ workflowStatus: input.workflowStatus }).where(eq(analyses.id, input.id));
      await auditLog({
        userId: ctx.user?.id,
        userEmail: ctx.user?.email ?? undefined,
        eventType: "workflow_status_change",
        resourceType: "analysis",
        resourceId: input.id,
        description: `Workflow státusz módosítva: ${input.workflowStatus}`,
      });
      return { success: true };
    }),

  /**
   * Update the workflow status of a single finding within an analysis.
   */
  updateFindingStatus: publicProcedure
    .input(z.object({
      analysisId: z.number(),
      findingId: z.string(),
      workflowStatus: z.enum(["nyitott", "ellenorzes_alatt", "elfogadva", "elutasitva", "javitva", "lezarva"]),
      reviewNote: z.string().optional(),
      assignedTo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const analysis = await getAnalysisById(input.analysisId);
      if (!analysis) throw new TRPCError({ code: "NOT_FOUND", message: "Elemzés nem található" });

      const results = (analysis.results as ComplianceResult[]) ?? [];
      const updated = results.map((r) =>
        r.id === input.findingId
          ? {
              ...r,
              workflowStatus: input.workflowStatus,
              reviewNote: input.reviewNote ?? r.reviewNote,
              assignedTo: input.assignedTo ?? r.assignedTo,
            }
          : r
      );

      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { analyses } = await import("../../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(analyses).set({ results: updated }).where(eq(analyses.id, input.analysisId));

      await auditLog({
        userId: ctx.user?.id,
        userEmail: ctx.user?.email ?? undefined,
        eventType: "finding_status_change",
        resourceType: "analysis",
        resourceId: input.analysisId,
        description: `Finding státusz módosítva: ${input.findingId} → ${input.workflowStatus}`,
      });

      return { success: true };
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
  // Step 1: Extract plan text
  await updateAnalysisStatus(analysisId, "processing", { progressStep: "Tervdokumentum feldolgozása..." });
  const planBuffer = Buffer.from(input.planDocument.base64, "base64");
  const planExtraction = await extractTextFromDocument(planBuffer, input.planDocument.name);
  const planText = planExtraction.text;

  // Step 2: Extract regulation texts
  await updateAnalysisStatus(analysisId, "processing", { progressStep: "Jogszabályok feldolgozása..." });
  const regulationTexts: string[] = [];
  const regulationNames: string[] = [];

  for (const doc of input.regulationDocuments) {
    if (doc.name.startsWith("__lib_source_")) continue;
    if (!doc.base64) continue;
    const buf = Buffer.from(doc.base64, "base64");
    const extraction = await extractTextFromDocument(buf, doc.name);
    regulationTexts.push(`=== ${doc.name} ===\n${extraction.text}`);
    regulationNames.push(doc.name);
  }

  // Fetch library regulation sources
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
          } else if (["njt", "netjogtar", "url"].includes(src.sourceType) && src.sourceUrl) {
            try {
              const { fetchRegulationText } = await import("../regulationScraper");
              const fetched = await fetchRegulationText(src.sourceType as any, src.sourceUrl);
              if (fetched.text) {
                regulationTexts.push(`=== ${src.name} ===\n${fetched.text}`);
                regulationNames.push(src.name);
              }
            } catch {
              // Skip if fetch fails
            }
          }
        }
      }
    } catch {
      // Continue without library sources
    }
  }

  if (regulationTexts.length === 0) {
    regulationTexts.push("Nincs jogszabály megadva – általános megfelelőség-ellenőrzés.");
    regulationNames.push("Általános");
  }

  const combinedRegulationText = regulationTexts.join("\n\n");

  // Step 3: AI analysis
  await updateAnalysisStatus(analysisId, "processing", { progressStep: "AI elemzés futtatása..." });
  const { results, summary } = await runComplianceAnalysis(
    planText,
    combinedRegulationText,
    input.planDocument.name,
    regulationNames
  );

  // Step 4: Save results
  await updateAnalysisStatus(analysisId, "completed", {
    results,
    summary,
    progressStep: "Kész",
  });
}
