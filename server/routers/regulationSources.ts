/**
 * tRPC router for managing regulation sources.
 * Handles CRUD operations and fetching regulation text from online sources.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { regulationSources } from "../../drizzle/schema";
import { eq, desc, asc } from "drizzle-orm";
import { fetchRegulationText } from "../regulationScraper";

const disciplineEnum = z.enum([
  "altalanos", "epiteszet", "tuzvedelmi", "energetika", "statika",
  "gepeszet", "villamos", "geotechnika", "kozlekedes", "tajepiteszet", "egyeb",
]);

const sourceTypeEnum = z.enum(["njt", "netjogtar", "eurlex", "mszt", "jogtar", "epitesijog", "pdf", "url"]);

export const regulationSourcesRouter = router({
  /**
   * List all regulation sources.
   */
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    return db.select().from(regulationSources).orderBy(asc(regulationSources.discipline), asc(regulationSources.name));
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
   * Delete a regulation source.
   */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      await db.delete(regulationSources).where(eq(regulationSources.id, input.id));
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

      // Update the cached content
      await db.update(regulationSources).set({
        content: result.text.slice(0, 65000), // MySQL TEXT limit
        contentFetchedAt: result.fetchedAt,
      }).where(eq(regulationSources.id, input.id));

      return {
        success: !result.warning,
        characterCount: result.text.length,
        warning: result.warning,
        fetchedAt: result.fetchedAt,
      };
    }),
});
