/**
 * tRPC router for managing regulation sources.
 * Handles CRUD operations and fetching regulation text from online sources.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { sql, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { regulationSources, chunkEmbeddings } from "../../drizzle/schema";
import { and, eq, desc, asc } from "drizzle-orm";
import { fetchRegulationText } from "../regulationScraper";
import { chunkAndEmbed } from "../embeddings";

const disciplineEnum = z.enum([
  "altalanos", "epiteszet", "tuzvedelmi", "energetika", "statika",
  "gepeszet", "villamos", "geotechnika", "kozlekedes", "tajepiteszet", "egyeb",
]);

const sourceTypeEnum = z.enum(["njt", "netjogtar", "eurlex", "mszt", "jogtar", "epitesijog", "pdf", "url"]);

export const regulationSourcesRouter = router({
  /**
   * List regulation sources. Soft-deleted ones are excluded by default;
   * pass `includeDeleted: true` to include them (e.g. for a "Restore" UI).
   */
  list: publicProcedure
    .input(z.object({ includeDeleted: z.boolean().default(false) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      const includeDeleted = input?.includeDeleted ?? false;
      const query = db.select().from(regulationSources);
      try {
        const rows = includeDeleted
          ? await query.orderBy(asc(regulationSources.discipline), asc(regulationSources.name))
          : await query
              .where(isNull(regulationSources.deletedAt))
              .orderBy(asc(regulationSources.discipline), asc(regulationSources.name));
        return rows;
      } catch (err) {
        // Fallback for environments where `pnpm db:push` hasn't yet added the
        // `deletedAt` column. The unfiltered query keeps the page usable.
        console.warn("[regulationSources.list] deletedAt column missing? Falling back to unfiltered:", err);
        return db.select().from(regulationSources).orderBy(asc(regulationSources.discipline), asc(regulationSources.name));
      }
    }),

  /**
   * Per-source chunk-embedding counts. Used by RegulationLibraryPage to show
   * a "X chunk embedding" badge next to each source. Returns an empty array
   * if the chunk_embeddings table doesn't exist yet (db:push not run on this
   * environment) so the UI can render gracefully without semantic-search data.
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
        .where(eq(chunkEmbeddings.sourceType, "regulation"))
        .groupBy(chunkEmbeddings.sourceId);
      return rows.map((r) => ({ sourceId: r.sourceId, chunkCount: Number(r.chunkCount) }));
    } catch (err) {
      console.error("[regulationSources] getEmbeddingCounts skipped:", err);
      return [];
    }
  }),

  /**
   * Get a single regulation source by ID.
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      const result = await db.select().from(regulationSources).where(eq(regulationSources.id, input.id)).limit(1);
      if (!result[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Jogszabály forrás nem található" });
      return result[0];
    }),

  /**
   * Create a new regulation source.
   */
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(512),
        shortCode: z.string().max(64).optional(),
        discipline: disciplineEnum,
        sourceType: sourceTypeEnum,
        sourceUrl: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      const result = await db.insert(regulationSources).values({
        name: input.name,
        shortCode: input.shortCode ?? null,
        discipline: input.discipline,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl || null,
        isActive: true,
      });
      return { id: (result[0] as any).insertId as number };
    }),

  /**
   * Update a regulation source.
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(512).optional(),
        shortCode: z.string().max(64).optional(),
        discipline: disciplineEnum.optional(),
        sourceType: sourceTypeEnum.optional(),
        sourceUrl: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      const { id, ...rest } = input;
      await db.update(regulationSources).set(rest).where(eq(regulationSources.id, id));
      return { success: true };
    }),

  /**
   * Soft-delete a regulation source (sets deletedAt = now()). The row is
   * preserved (restorable), but listing excludes it by default. Cascades
   * chunk_embeddings cleanup so semantic search doesn't return phantom
   * results — on restore, the user must regenerate embeddings.
   */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      try {
        await db
          .update(regulationSources)
          .set({ deletedAt: new Date() })
          .where(eq(regulationSources.id, input.id));
      } catch (err) {
        // Fallback if the deletedAt column isn't deployed yet — do hard delete
        // to keep the UI usable. After db:push the new soft-delete path takes over.
        console.warn("[regulationSources.delete] soft-delete path failed, falling back to hard delete:", err);
        await db.delete(regulationSources).where(eq(regulationSources.id, input.id));
      }
      await db
        .delete(chunkEmbeddings)
        .where(and(eq(chunkEmbeddings.sourceType, "regulation"), eq(chunkEmbeddings.sourceId, input.id)));
      return { success: true };
    }),

  /**
   * Restore a soft-deleted regulation source. The user must regenerate
   * embeddings afterwards if they want semantic search coverage.
   */
  restore: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      await db
        .update(regulationSources)
        .set({ deletedAt: null })
        .where(eq(regulationSources.id, input.id));
      return { success: true };
    }),

  /**
   * Permanently delete a regulation source (physical row removal). Use with
   * care — there's no recovery. Intended for an admin "empty trash" flow.
   */
  permanentDelete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      await db.delete(regulationSources).where(eq(regulationSources.id, input.id));
      await db
        .delete(chunkEmbeddings)
        .where(and(eq(chunkEmbeddings.sourceType, "regulation"), eq(chunkEmbeddings.sourceId, input.id)));
      return { success: true };
    }),

  /**
   * Fetch and cache the regulation text from the source URL.
   * For paid platforms, credentials must be provided separately.
   */
  fetchContent: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const rows = await db.select().from(regulationSources).where(eq(regulationSources.id, input.id)).limit(1);
      const source = rows[0];
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Jogszabály forrás nem található" });

      if (!source.sourceUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nincs URL megadva ehhez a forráshoz" });
      }

      // For paid platforms, check if credentials exist
      let credentials: { username: string; password: string } | undefined;
      if (["mszt", "jogtar", "epitesijog"].includes(source.sourceType)) {
        const { platformCredentials } = await import("../../drizzle/schema");
        const { decryptPassword } = await import("../regulationScraper");
        const credRows = await db
          .select()
          .from(platformCredentials)
          .where(eq(platformCredentials.platform, source.sourceType as any))
          .limit(1);
        const cred = credRows[0];
        if (cred?.username && cred?.encryptedPassword) {
          credentials = {
            username: cred.username,
            password: decryptPassword(cred.encryptedPassword),
          };
        }
      }

      const result = await fetchRegulationText(source.sourceType as any, source.sourceUrl, credentials);

      // Update the cached content + sync status / lastSyncAt for staleness tracking
      const succeeded = !result.warning && result.text.length > 0;
      await db.update(regulationSources).set({
        content: result.text.slice(0, 16_000_000), // mediumtext limit
        contentFetchedAt: result.fetchedAt,
        lastSyncAt: result.fetchedAt,
        syncStatus: succeeded ? "ok" : "error",
        lastSyncError: succeeded ? null : (result.warning ?? null),
      }).where(eq(regulationSources.id, input.id));

      return {
        success: succeeded,
        characterCount: result.text.length,
        warning: result.warning,
        fetchedAt: result.fetchedAt,
      };
    }),

  /**
   * Refresh all sources whose lastSyncAt is older than `olderThanDays` (default 30)
   * or null. Sequential, best-effort: failures are logged but the loop continues.
   * Designed to be called from a Manus scheduled task or a manual "Frissítés mind"
   * UI button. NJT/netjogtar/eurlex/url sources don't need credentials; the rest
   * are skipped if no credential is configured.
   */
  refreshAllStale: publicProcedure
    .input(z.object({ olderThanDays: z.number().int().min(0).max(365).default(30) }).optional())
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const olderThanDays = input?.olderThanDays ?? 30;
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const all = await db.select().from(regulationSources);
      const stale = all.filter((s) => {
        if (!s.sourceUrl) return false;
        if (!s.isActive) return false;
        const last = s.lastSyncAt ?? s.contentFetchedAt;
        return last == null || last < cutoff;
      });

      const { platformCredentials } = await import("../../drizzle/schema");
      const { decryptPassword } = await import("../regulationScraper");

      let refreshed = 0;
      let skipped = 0;
      let failed = 0;
      const errors: Array<{ id: number; name: string; error: string }> = [];

      for (const source of stale) {
        try {
          let credentials: { username: string; password: string } | undefined;
          if (["mszt", "jogtar", "epitesijog"].includes(source.sourceType)) {
            const credRows = await db
              .select()
              .from(platformCredentials)
              .where(eq(platformCredentials.platform, source.sourceType as any))
              .limit(1);
            const cred = credRows[0];
            if (!cred?.username || !cred?.encryptedPassword) {
              skipped++;
              continue;
            }
            credentials = { username: cred.username, password: decryptPassword(cred.encryptedPassword) };
          }
          const result = await fetchRegulationText(source.sourceType as any, source.sourceUrl!, credentials);
          const succeeded = !result.warning && result.text.length > 0;
          await db.update(regulationSources).set({
            content: result.text.slice(0, 16_000_000),
            contentFetchedAt: result.fetchedAt,
            lastSyncAt: result.fetchedAt,
            syncStatus: succeeded ? "ok" : "error",
            lastSyncError: succeeded ? null : (result.warning ?? null),
          }).where(eq(regulationSources.id, source.id));
          if (succeeded) refreshed++;
          else { failed++; errors.push({ id: source.id, name: source.name, error: result.warning ?? "ismeretlen" }); }
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ id: source.id, name: source.name, error: msg });
          await db.update(regulationSources).set({
            syncStatus: "error",
            lastSyncError: msg,
          }).where(eq(regulationSources.id, source.id));
        }
      }

      return { staleCount: stale.length, refreshed, skipped, failed, errors };
    }),

  /**
   * Generate (or regenerate) chunk embeddings for a regulation source.
   * Returns the number of chunks embedded; returns `embeddingApiUnavailable: true`
   * if the embedding API isn't reachable so the UI can surface a hint.
   */
  regenerateEmbeddings: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const rows = await db.select().from(regulationSources).where(eq(regulationSources.id, input.id)).limit(1);
      const source = rows[0];
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Jogszabály forrás nem található" });
      if (!source.content || source.content.trim().length === 0) {
        return { chunkCount: 0, embeddingApiUnavailable: false, message: "A forrásnak nincs letöltött szövege." };
      }

      const embedded = await chunkAndEmbed(source.content);
      if (embedded.length === 0) {
        return { chunkCount: 0, embeddingApiUnavailable: true, message: "Az embedding API nem érhető el, vagy nincs használható chunk." };
      }

      // Wipe previous embeddings for this source, then bulk insert new ones.
      await db
        .delete(chunkEmbeddings)
        .where(and(eq(chunkEmbeddings.sourceType, "regulation"), eq(chunkEmbeddings.sourceId, input.id)));
      await db.insert(chunkEmbeddings).values(
        embedded.map((c) => ({
          sourceType: "regulation" as const,
          sourceId: input.id,
          chunkIndex: c.chunkIndex,
          text: c.text.slice(0, 65000),
          embedding: c.embedding,
        }))
      );

      return { chunkCount: embedded.length, embeddingApiUnavailable: false, message: null };
    }),
});
