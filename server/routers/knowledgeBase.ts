import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { knowledgeBaseDocuments } from "../../drizzle/schema";
import { eq, like, or, desc } from "drizzle-orm";
import { storagePut } from "../storage";
import { extractDocumentText, type ExtractionResult } from "../documentExtractor";
import { nanoid } from "nanoid";

export const knowledgeBaseRouter = router({
  // List all documents, optionally filtered by search query
  list: publicProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      if (input.search && input.search.trim()) {
        const q = `%${input.search.trim()}%`;
        return db
          .select()
          .from(knowledgeBaseDocuments)
          .where(
            or(
              like(knowledgeBaseDocuments.name, q),
              like(knowledgeBaseDocuments.originalName, q),
              like(knowledgeBaseDocuments.description, q),
              like(knowledgeBaseDocuments.tags, q),
            )
          )
          .orderBy(desc(knowledgeBaseDocuments.uploadedAt));
      }

      return db
        .select()
        .from(knowledgeBaseDocuments)
        .orderBy(desc(knowledgeBaseDocuments.uploadedAt));
    }),

  // Upload one or more documents
  upload: publicProcedure
    .input(z.object({
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
        });

        results.push({ name: doc.name, s3Key });
      }

      return { uploaded: results.length };
    }),

  // Delete a document
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Adatbázis nem elérhető");
      await db.delete(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.id, input.id));
      return { success: true };
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
