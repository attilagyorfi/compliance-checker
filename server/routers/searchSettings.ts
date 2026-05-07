/**
 * User-search-settings router — V11.3 (d)
 *
 * Per-felhasználó keresési alapértelmezések (válaszhossz, működési mód,
 * keresési logika). A `search_settings` táblát használja, userId-vel
 * kulcsolva. Mindkét endpoint protected — anonim user-eknek a kliensen
 * a hardcoded defaultok érvényesek.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { searchSettings } from "../../drizzle/schema";

const answerLengthEnum = z.enum(["short", "standard", "detailed"]);
const operationModeEnum = z.enum(["fast", "accurate"]);
const searchModeEnum = z.enum(["mszt", "internal", "combined", "web", "combined_with_web"]);

const DEFAULTS = {
  answerLength: "standard" as const,
  operationMode: "accurate" as const,
  searchMode: "combined" as const,
};

export const searchSettingsRouter = router({
  /**
   * Get the current user's saved search settings, falling back to defaults
   * if no row exists yet.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { ...DEFAULTS, isCustom: false };

    const rows = await db
      .select()
      .from(searchSettings)
      .where(eq(searchSettings.userId, ctx.user.id))
      .limit(1);
    const row = rows[0];
    if (!row) return { ...DEFAULTS, isCustom: false };

    return {
      answerLength: row.answerLength,
      operationMode: row.operationMode,
      searchMode: row.searchMode,
      isCustom: true,
    };
  }),

  /**
   * Upsert the user's search settings. Any unspecified field keeps its previous
   * value (or the default if the row didn't exist).
   */
  upsert: protectedProcedure
    .input(
      z.object({
        answerLength: answerLengthEnum.optional(),
        operationMode: operationModeEnum.optional(),
        searchMode: searchModeEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

      const existingRows = await db
        .select()
        .from(searchSettings)
        .where(eq(searchSettings.userId, ctx.user.id))
        .limit(1);
      const existing = existingRows[0];

      const next = {
        answerLength: input.answerLength ?? existing?.answerLength ?? DEFAULTS.answerLength,
        operationMode: input.operationMode ?? existing?.operationMode ?? DEFAULTS.operationMode,
        searchMode: input.searchMode ?? existing?.searchMode ?? DEFAULTS.searchMode,
      };

      if (existing) {
        await db
          .update(searchSettings)
          .set(next)
          .where(eq(searchSettings.userId, ctx.user.id));
      } else {
        await db.insert(searchSettings).values({
          userId: ctx.user.id,
          ...next,
        });
      }

      return { success: true, ...next };
    }),

  /**
   * Reset settings to defaults (deletes the row).
   */
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });
    await db.delete(searchSettings).where(eq(searchSettings.userId, ctx.user.id));
    return { success: true, ...DEFAULTS, isCustom: false };
  }),
});
