import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { knowledgeBaseDocuments, chunkEmbeddings } from "../../drizzle/schema";
import { and, eq, inArray, isNull, like, or, desc, sql } from "drizzle-orm";
import { storagePut } from "../storage";
import { extractDocumentText, type ExtractionResult } from "../documentExtractor";
import { chunkAndEmbed } from "../embeddings";
import { nanoid } from "nanoid";

export const knowledgeBaseRouter = router({
  // List all documents, optionally filtered by search query, project, and
  // (V11.7) soft-delete status. Default: only non-deleted rows.
  list: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      projectId: z.number().int().positive().optional(),
      includeDeleted: z.boolean().default(false),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const filters = [];
      if (input.search && input.search.trim()) {
        const q = `%${input.search.trim()}%`;
        filters.push(
          or(
            like(knowledgeBaseDocuments.name, q),
            like(knowledgeBaseDocuments.originalName, q),
            like(knowledgeBaseDocuments.description, q),
            like(knowledgeBaseDocuments.tags, q),
          )
        );
      }
      if (input.projectId !== undefined) {
        filters.push(eq(knowledgeBaseDocuments.projectId, input.projectId));
      }
      if (!input.includeDeleted) {
        filters.push(isNull(knowledgeBaseDocuments.deletedAt));
      }

      const baseQuery = db.select().from(knowledgeBaseDocuments);
      const filtered = filters.length > 0
        ? baseQuery.where(filters.length === 1 ? filters[0] : and(...filters))
        : baseQuery;

      try {
        return await filtered.orderBy(desc(knowledgeBaseDocuments.uploadedAt));
      } catch (err) {
        // Fallback if the deletedAt column isn't deployed yet — drop the
        // soft-delete filter and re-run.
        console.warn("[knowledgeBase.list] deletedAt column missing? Falling back:", err);
        const nonDeletedFilters = filters.filter((_, i) =>
          // We added the deletedAt filter last, so drop the last filter on retry
          i !== filters.length - 1 || input.includeDeleted
        );
        const fallback = nonDeletedFilters.length > 0
          ? db.select().from(knowledgeBaseDocuments).where(nonDeletedFilters.length === 1 ? nonDeletedFilters[0] : and(...nonDeletedFilters))
          : db.select().from(knowledgeBaseDocuments);
        return fallback.orderBy(desc(knowledgeBaseDocuments.uploadedAt));
      }
    }),

  // Upload one or more documents
  upload: publicProcedure
    .input(z.object({
      projectId: z.number().int().positive().optional(),
      documents: z.array(z.object({
        base64: z.string(),
        originalName: z.string(),
        fileType: z.string(),
        fileSize: z.number(),
        name: z.string(),
        description: z.string().optional(),
        tags: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Adatbázis nem elérhető");

      const results = [];

      for (const doc of input.documents) {
        // Decode base64 to buffer
        const buffer = Buffer.from(doc.base64, "base64");

        // Upload to S3
        const suffix = nanoid(8);
        const s3Key = `knowledge-base/${Date.now()}-${suffix}.${doc.fileType}`;
        const mimeMap: Record<string, string> = {
          pdf: "application/pdf",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          doc: "application/msword",
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          xls: "application/vnd.ms-excel",
          dwg: "application/acad",
          dxf: "application/dxf",
          ifc: "application/x-step",
          rtf: "application/rtf",
        };
        const mime = mimeMap[doc.fileType.toLowerCase()] ?? "application/octet-stream";
        const { url: s3Url } = await storagePut(s3Key, buffer, mime);

        // Extract text
        let extractedText: string | null = null;
        try {
          const result: ExtractionResult = await extractDocumentText(buffer, doc.fileType);
          extractedText = result.text ?? null;
        } catch (_e) {
          // Text extraction failure is non-fatal
        }

        // Insert into DB
        await db.insert(knowledgeBaseDocuments).values({
          name: doc.name || doc.originalName,
          originalName: doc.originalName,
          fileType: doc.fileType.toLowerCase(),
          fileSize: doc.fileSize,
          s3Url,
          s3Key,
          extractedText,
          description: doc.description ?? null,
          tags: doc.tags ?? null,
          projectId: input.projectId ?? null,
        });

        results.push({ name: doc.name, s3Key });
      }

      return { uploaded: results.length };
    }),

  // Soft-delete a document (V11.7). Cascades chunk_embeddings cleanup so
  // semantic search doesn't return phantom results from deleted docs — on
  // restore, the user must regenerate embeddings.
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Adatbázis nem elérhető");
      try {
        await db
          .update(knowledgeBaseDocuments)
          .set({ deletedAt: new Date() })
          .where(eq(knowledgeBaseDocuments.id, input.id));
      } catch (err) {
        console.warn("[knowledgeBase.delete] soft-delete path failed, falling back to hard delete:", err);
        await db.delete(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.id, input.id));
      }
      await db
        .delete(chunkEmbeddings)
        .where(and(eq(chunkEmbeddings.sourceType, "knowledge_base"), eq(chunkEmbeddings.sourceId, input.id)));
      return { success: true };
    }),

  // Bulk soft-delete (V11.7) — atomic batch over multiple docs.
  deleteMany: publicProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });

      const existing = await db
        .select({ id: knowledgeBaseDocuments.id })
        .from(knowledgeBaseDocuments)
        .where(inArray(knowledgeBaseDocuments.id, input.ids));
      const existingIds = existing.map((r) => r.id);
      if (existingIds.length === 0) {
        return { deletedCount: 0, requestedCount: input.ids.length };
      }

      try {
        await db
          .update(knowledgeBaseDocuments)
          .set({ deletedAt: new Date() })
          .where(inArray(knowledgeBaseDocuments.id, existingIds));
      } catch (err) {
        console.warn("[knowledgeBase.deleteMany] soft-delete fallback to hard:", err);
        await db.delete(knowledgeBaseDocuments).where(inArray(knowledgeBaseDocuments.id, existingIds));
      }
      await db
        .delete(chunkEmbeddings)
        .where(
          and(
            eq(chunkEmbeddings.sourceType, "knowledge_base"),
            inArray(chunkEmbeddings.sourceId, existingIds),
          ),
        );

      return { deletedCount: existingIds.length, requestedCount: input.ids.length };
    }),

  /**
   * Restore a soft-deleted document. Embeddings need to be regenerated separately.
   */
  restore: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
      await db
        .update(knowledgeBaseDocuments)
        .set({ deletedAt: null })
        .where(eq(knowledgeBaseDocuments.id, input.id));
      return { success: true };
    }),

  /**
   * Permanent (hard) delete — kept for an admin "empty trash" flow.
   */
  permanentDelete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });
      await db.delete(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.id, input.id));
      await db
        .delete(chunkEmbeddings)
        .where(and(eq(chunkEmbeddings.sourceType, "knowledge_base"), eq(chunkEmbeddings.sourceId, input.id)));
      return { success: true };
    }),

  /**
   * Per-document chunk-embedding counts, mirroring regulationSources.getEmbeddingCounts.
   */
  getEmbeddingCounts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [] as Array<{ sourceId: number; chunkCount: number }>;
    try {
      const rows = await db
        .select({
          sourceId: chunkEmbeddings.sourceId,
          chunkCount: sql<number>`count(*)`,
        })
        .from(chunkEmbeddings)
        .where(eq(chunkEmbeddings.sourceType, "knowledge_base"))
        .groupBy(chunkEmbeddings.sourceId);
      return rows.map((r) => ({ sourceId: r.sourceId, chunkCount: Number(r.chunkCount) }));
    } catch (err) {
      console.error("[knowledgeBase] getEmbeddingCounts skipped:", err);
      return [];
    }
  }),

  /**
   * Generate (or regenerate) chunk embeddings for a Knowledge Base document.
   * Mirrors regulationSources.regenerateEmbeddings — same graceful fallback
   * if the embedding API is unavailable.
   */
  regenerateEmbeddings: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető" });

      const rows = await db.select().from(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.id, input.id)).limit(1);
      const doc = rows[0];
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Tudástár dokumentum nem található" });
      if (!doc.extractedText || doc.extractedText.trim().length === 0) {
        return { chunkCount: 0, embeddingApiUnavailable: false, message: "A dokumentumnak nincs kinyert szövege." };
      }

      const embedded = await chunkAndEmbed(doc.extractedText);
      if (embedded.length === 0) {
        return { chunkCount: 0, embeddingApiUnavailable: true, message: "Az embedding API nem érhető el, vagy nincs használható chunk." };
      }

      await db
        .delete(chunkEmbeddings)
        .where(and(eq(chunkEmbeddings.sourceType, "knowledge_base"), eq(chunkEmbeddings.sourceId, input.id)));
      await db.insert(chunkEmbeddings).values(
        embedded.map((c) => ({
          sourceType: "knowledge_base" as const,
          sourceId: input.id,
          chunkIndex: c.chunkIndex,
          text: c.text.slice(0, 65000),
          embedding: c.embedding,
        }))
      );

      return { chunkCount: embedded.length, embeddingApiUnavailable: false, message: null };
    }),

  // Get all extracted texts for internal search (used by standardsSearch)
  getTextsForSearch: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const docs = await db
        .select({
          id: knowledgeBaseDocuments.id,
          name: knowledgeBaseDocuments.name,
          originalName: knowledgeBaseDocuments.originalName,
          extractedText: knowledgeBaseDocuments.extractedText,
          tags: knowledgeBaseDocuments.tags,
        })
        .from(knowledgeBaseDocuments)
        .orderBy(desc(knowledgeBaseDocuments.uploadedAt));

      // Simple keyword relevance filter
      const q = input.query.toLowerCase();
      const keywords = q.split(/\s+/).filter(k => k.length > 2);

      return docs
        .filter(doc => {
          if (!doc.extractedText) return false;
          const text = doc.extractedText.toLowerCase();
          return keywords.some(k => text.includes(k));
        })
        .map(doc => ({
          id: doc.id,
          name: doc.name || doc.originalName,
          excerpt: doc.extractedText
            ? doc.extractedText.slice(0, 500)
            : "",
          relevanceScore: keywords.filter(k =>
            (doc.extractedText ?? "").toLowerCase().includes(k)
          ).length / Math.max(keywords.length, 1),
        }));
    }),
});
