/**
 * Admin router — V11.9 (d)
 *
 * Csak `role: "admin"` user-ek érik el (a _core/trpc.ts adminProcedure
 * middleware-ja gondoskodik a FORBIDDEN hibáról a többieknek). Workspace-
 * szintű áttekintést és karbantartási műveleteket biztosít.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  users, projects, projectMembers, analyses,
  knowledgeBaseDocuments, regulationSources, searchQueries, auditLogs,
} from "../../drizzle/schema";

const userRoleEnum = z.enum(["user", "admin", "reviewer"]);

export const adminRouter = router({
  /**
   * High-level system stats for the admin dashboard top widget.
   */
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    try {
      const [userCount] = await db.select({ n: sql<number>`count(*)` }).from(users);
      const [projectCount] = await db.select({ n: sql<number>`count(*)` }).from(projects).where(eq(projects.status, "active"));
      const [analysisCount] = await db.select({ n: sql<number>`count(*)` }).from(analyses);
      const [kbCount] = await db
        .select({ n: sql<number>`count(*)` })
        .from(knowledgeBaseDocuments);
      const [regCount] = await db
        .select({ n: sql<number>`count(*)` })
        .from(regulationSources);
      const [searchCount] = await db.select({ n: sql<number>`count(*)` }).from(searchQueries);
      const [auditCount] = await db.select({ n: sql<number>`count(*)` }).from(auditLogs);

      // Trash counts — best-effort, fallback to 0 if column missing
      let kbTrash = 0;
      let regTrash = 0;
      try {
        const [r] = await db
          .select({ n: sql<number>`count(*)` })
          .from(knowledgeBaseDocuments)
          .where(isNotNull(knowledgeBaseDocuments.deletedAt));
        kbTrash = Number(r?.n ?? 0);
      } catch { /* column may not exist yet */ }
      try {
        const [r] = await db
          .select({ n: sql<number>`count(*)` })
          .from(regulationSources)
          .where(isNotNull(regulationSources.deletedAt));
        regTrash = Number(r?.n ?? 0);
      } catch { /* column may not exist yet */ }

      return {
        users: Number(userCount?.n ?? 0),
        activeProjects: Number(projectCount?.n ?? 0),
        analyses: Number(analysisCount?.n ?? 0),
        knowledgeBaseDocs: Number(kbCount?.n ?? 0),
        regulationSources: Number(regCount?.n ?? 0),
        searchQueries: Number(searchCount?.n ?? 0),
        auditEvents: Number(auditCount?.n ?? 0),
        trash: { kb: kbTrash, regulations: regTrash },
      };
    } catch (err) {
      console.error("[admin.stats] error:", err);
      return null;
    }
  }),

  /**
   * List all users (workspace-wide). Returns minimal profile + role.
   */
  listUsers: adminProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          loginMethod: users.loginMethod,
          createdAt: users.createdAt,
          lastSignedIn: users.lastSignedIn,
        })
        .from(users)
        .orderBy(desc(users.lastSignedIn));
      if (input?.search?.trim()) {
        const q = input.search.trim().toLowerCase();
        return rows.filter(
          (u) =>
            (u.name?.toLowerCase().includes(q) ?? false) ||
            (u.email?.toLowerCase().includes(q) ?? false),
        );
      }
      return rows;
    }),

  /**
   * Change a user's role. Admin-only. Cannot demote yourself if you'd be
   * the last admin remaining (protects against accidental lock-out).
   */
  changeUserRole: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      role: userRoleEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

      if (input.userId === ctx.user.id && input.role !== "admin") {
        const adminRows = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, "admin"));
        if (adminRows.length <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Te vagy az utolsó admin — előbb adj admin szerepkört egy másik felhasználónak.",
          });
        }
      }

      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  /**
   * Workspace-wide projects (regardless of membership). Useful for the admin
   * who needs to inspect every project + see its owner.
   */
  listAllProjects: adminProcedure
    .input(z.object({ includeDeleted: z.boolean().default(false) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const includeDeleted = input?.includeDeleted ?? false;
      const baseQuery = db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          status: projects.status,
          workflowStatus: projects.workflowStatus,
          discipline: projects.discipline,
          ownerId: projects.ownerId,
          ownerName: users.name,
          ownerEmail: users.email,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
          memberCount: sql<number>`(SELECT COUNT(*) FROM ${projectMembers} WHERE ${projectMembers.projectId} = ${projects.id})`,
        })
        .from(projects)
        .leftJoin(users, eq(projects.ownerId, users.id));
      const rows = includeDeleted
        ? await baseQuery.orderBy(desc(projects.createdAt))
        : await baseQuery.where(and(eq(projects.status, "active"))).orderBy(desc(projects.createdAt));
      return rows.map((r) => ({ ...r, memberCount: Number(r.memberCount) }));
    }),

  /**
   * Empty trash — permanently deletes ALL soft-deleted regulationSources and
   * knowledgeBaseDocuments, plus their cached embeddings. Use with care.
   */
  emptyTrash: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

    let kbDeleted = 0;
    let regDeleted = 0;
    try {
      const kbToDelete = await db
        .select({ id: knowledgeBaseDocuments.id })
        .from(knowledgeBaseDocuments)
        .where(isNotNull(knowledgeBaseDocuments.deletedAt));
      const kbIds = kbToDelete.map((r) => r.id);
      if (kbIds.length > 0) {
        await db.delete(knowledgeBaseDocuments).where(isNotNull(knowledgeBaseDocuments.deletedAt));
        kbDeleted = kbIds.length;
      }
    } catch (err) {
      console.warn("[admin.emptyTrash] kb step failed:", err);
    }
    try {
      const regToDelete = await db
        .select({ id: regulationSources.id })
        .from(regulationSources)
        .where(isNotNull(regulationSources.deletedAt));
      const regIds = regToDelete.map((r) => r.id);
      if (regIds.length > 0) {
        await db.delete(regulationSources).where(isNotNull(regulationSources.deletedAt));
        regDeleted = regIds.length;
      }
    } catch (err) {
      console.warn("[admin.emptyTrash] reg step failed:", err);
    }
    return { kbDeleted, regDeleted };
  }),
});
