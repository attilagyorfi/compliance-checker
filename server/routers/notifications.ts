/**
 * Notifications router — V11.11 (f)
 *
 * In-app értesítések listázása és olvasott-státusz kezelése. Mind protected,
 * minden user csak a saját notification-jeit látja.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";

export const notificationsRouter = router({
  /**
   * List notifications for the current user. Default: all, newest first.
   * Optional `unreadOnly` for the dropdown.
   */
  list: protectedProcedure
    .input(z.object({
      unreadOnly: z.boolean().default(false),
      limit: z.number().int().min(1).max(100).default(30),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const limit = input?.limit ?? 30;
      const unreadOnly = input?.unreadOnly ?? false;
      try {
        const query = db.select().from(notifications);
        const filtered = unreadOnly
          ? query.where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)))
          : query.where(eq(notifications.userId, ctx.user.id));
        return filtered.orderBy(desc(notifications.createdAt)).limit(limit);
      } catch (err) {
        console.error("[notifications.list] error:", err);
        return [];
      }
    }),

  /**
   * Get the unread count for the user (powers the bell badge).
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { count: 0 };
    try {
      const rows = await db
        .select({ n: sql<number>`count(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)));
      return { count: Number(rows[0]?.n ?? 0) };
    } catch {
      return { count: 0 };
    }
  }),

  /**
   * Mark a single notification as read. Only the owner can mark their own.
   */
  markRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

  /**
   * Mark all current-user notifications as read.
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)));
    return { success: true };
  }),

  /**
   * Delete a single notification (clear from the list).
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });
      await db
        .delete(notifications)
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),
});
