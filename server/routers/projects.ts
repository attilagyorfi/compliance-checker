/**
 * Projects router — CRUD for the `projects` table.
 *
 * V10.A1 scope: list / get / create / update / soft-delete projects. The
 * `projectId` columns on analyses, knowledge_base_documents and search_queries
 * are not yet wired into create/list flows — that comes in A3. RBAC via
 * project_members comes in A4.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  projects, projectMembers, users,
  analyses, knowledgeBaseDocuments, searchQueries,
} from "../../drizzle/schema";
import { requireOwnerForProject, requireMembership } from "./projectMembers";
import { auditLog } from "../auditLog";

const disciplineEnum = z.enum([
  "altalanos", "epiteszet", "tuzvedelmi", "energetika",
  "statika", "gepeszet", "villamos", "geotechnika",
  "kozlekedes", "tajepiteszet", "egyeb",
]);

const statusEnum = z.enum(["active", "archived", "deleted"]);

const workflowStatusEnum = z.enum([
  "uj", "elemzes_alatt", "ai_eloelenorizve",
  "ember_felulvizsgalva", "javitasra_visszakuldve", "lezart",
]);

export const projectsRouter = router({
  /**
   * List all non-deleted projects, newest first.
   */
  list: publicProcedure
    .input(
      z.object({
        includeDeleted: z.boolean().default(false),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const includeDeleted = input?.includeDeleted ?? false;
      const query = db.select().from(projects);
      const rows = includeDeleted
        ? await query.orderBy(desc(projects.createdAt))
        : await query.where(ne(projects.status, "deleted")).orderBy(desc(projects.createdAt));
      return rows;
    }),

  /**
   * Get a single project by id.
   */
  getById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });
      const rows = await db.select().from(projects).where(eq(projects.id, input.id)).limit(1);
      const project = rows[0];
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projekt nem található." });
      return project;
    }),

  /**
   * Create a new project. The current authenticated user becomes the owner.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(10_000).optional(),
        discipline: disciplineEnum.default("altalanos"),
        workflowStatus: workflowStatusEnum.default("uj"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });
      const inserted = await db.insert(projects).values({
        name: input.name,
        description: input.description ?? null,
        discipline: input.discipline,
        workflowStatus: input.workflowStatus,
        ownerId: ctx.user.id,
      });
      const insertId = (inserted as unknown as { insertId?: number }).insertId;
      // Bootstrap membership: the creator becomes the first owner.
      if (insertId) {
        await db.insert(projectMembers).values({
          projectId: insertId,
          userId: ctx.user.id,
          role: "owner",
        });
      }
      return { id: insertId ?? null };
    }),

  /**
   * Update an existing project. Any combination of fields may be provided.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(10_000).nullable().optional(),
        status: statusEnum.optional(),
        workflowStatus: workflowStatusEnum.optional(),
        discipline: disciplineEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });
      await requireOwnerForProject(db, input.id, ctx.user.id);
      const { id, ...patch } = input;
      const cleaned = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined)
      );
      if (Object.keys(cleaned).length === 0) {
        return { success: true };
      }
      await db.update(projects).set(cleaned).where(eq(projects.id, id));
      return { success: true };
    }),

  /**
   * Soft-delete a project (sets status = 'deleted'). Owner-only. The row is
   * preserved so historical analyses, KB documents and searches that reference
   * it still resolve, but it is hidden from the default list.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });
      await requireOwnerForProject(db, input.id, ctx.user.id);
      await db
        .update(projects)
        .set({ status: "deleted" })
        .where(and(eq(projects.id, input.id), ne(projects.status, "deleted")));
      return { success: true };
    }),

  /**
   * Export all per-project data as a single JSON snapshot. Members-only access.
   * Use case: handing the project state to another tool (or backup before
   * archiving). The file content of S3-uploaded Tudástár documents is NOT
   * included — only metadata + extractedText. The export is audit-logged.
   */
  export: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

      const projectRows = await db.select().from(projects).where(eq(projects.id, input.id)).limit(1);
      const project = projectRows[0];
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projekt nem található." });

      await requireMembership(db, input.id, ctx.user.id);

      const memberRows = await db
        .select({
          userId: projectMembers.userId,
          role: projectMembers.role,
          joinedAt: projectMembers.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(projectMembers)
        .leftJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, input.id));

      const projectAnalyses = await db
        .select()
        .from(analyses)
        .where(eq(analyses.projectId, input.id))
        .orderBy(desc(analyses.createdAt));

      const projectKb = await db
        .select()
        .from(knowledgeBaseDocuments)
        .where(eq(knowledgeBaseDocuments.projectId, input.id))
        .orderBy(desc(knowledgeBaseDocuments.uploadedAt));

      const projectSearches = await db
        .select()
        .from(searchQueries)
        .where(eq(searchQueries.projectId, input.id))
        .orderBy(desc(searchQueries.createdAt));

      const exportedAt = new Date();
      await auditLog({
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? undefined,
        eventType: "project_export",
        resourceType: "project",
        resourceId: input.id,
        description: `Projekt exportálva: ${project.name}`,
        metadata: {
          projectId: input.id,
          analysesCount: projectAnalyses.length,
          knowledgeBaseCount: projectKb.length,
          searchQueriesCount: projectSearches.length,
        },
      });

      return {
        format: "compliance-checker-project-export-v1",
        exportedAt,
        exportedBy: { id: ctx.user.id, email: ctx.user.email ?? null, name: ctx.user.name ?? null },
        project,
        members: memberRows,
        analyses: projectAnalyses,
        knowledgeBaseDocuments: projectKb,
        searchQueries: projectSearches,
      };
    }),
});
