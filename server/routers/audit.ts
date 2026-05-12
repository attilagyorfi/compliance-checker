/**
 * Audit log router — V11.3 (c)
 *
 * Listázza az `audit_logs` táblát szűrési és paginálási opciókkal.
 * Az endpoint protected — minden authentikált user lekérheti, de hosszabb
 * távon érdemes lesz admin-only-ra szigorítani.
 */

import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { auditLogs } from "../../drizzle/schema";

const eventTypeFilter = z.enum([
  "user_login", "user_logout",
  "document_upload", "document_delete", "document_view",
  "analysis_start", "analysis_complete", "analysis_error", "analysis_retry",
  "report_generate", "report_download",
  "regulation_source_add", "regulation_source_update", "regulation_source_delete", "regulation_source_sync",
  "credential_save", "credential_delete", "credential_test",
  "search_query",
  "knowledge_base_upload", "knowledge_base_delete",
  "project_create", "project_update", "project_archive", "project_export",
  "project_member_add", "project_member_remove", "project_member_change_role",
  "finding_status_change", "workflow_status_change",
]).optional();

export const auditRouter = router({
  /**
   * List audit log entries with optional filters and pagination.
   * Returns the rows + a total count for the current filter set.
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
        eventType: eventTypeFilter,
        resourceType: z.string().optional(),
        resourceId: z.string().optional(),
        userId: z.number().int().positive().optional(),
        sinceDays: z.number().int().min(1).max(365).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const conditions = [] as Array<ReturnType<typeof eq>>;
      if (input?.eventType) conditions.push(eq(auditLogs.eventType, input.eventType));
      if (input?.resourceType) conditions.push(eq(auditLogs.resourceType, input.resourceType));
      if (input?.resourceId) conditions.push(eq(auditLogs.resourceId, input.resourceId));
      if (input?.userId !== undefined) conditions.push(eq(auditLogs.userId, input.userId));
      if (input?.sinceDays !== undefined) {
        const cutoff = new Date(Date.now() - input.sinceDays * 24 * 60 * 60 * 1000);
        conditions.push(gte(auditLogs.createdAt, cutoff));
      }

      const baseQuery = db.select().from(auditLogs);
      const filtered = conditions.length === 0
        ? baseQuery
        : conditions.length === 1
          ? baseQuery.where(conditions[0]!)
          : baseQuery.where(and(...conditions));

      const items = await filtered
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      // Cheap-ish total: bounded by the filter; if no conditions, this is a full count.
      let total = items.length;
      try {
        const countQuery = db.select({ n: sql<number>`count(*)` }).from(auditLogs);
        const countFiltered = conditions.length === 0
          ? countQuery
          : conditions.length === 1
            ? countQuery.where(conditions[0]!)
            : countQuery.where(and(...conditions));
        const countRows = await countFiltered;
        total = Number(countRows[0]?.n ?? items.length);
      } catch {
        // ignore — fall back to items.length
      }

      return { items, total };
    }),

  /**
   * Aggregate event counts by eventType in the last `sinceDays` days (default 30).
   * Useful for a small dashboard widget.
   */
  summary: protectedProcedure
    .input(z.object({ sinceDays: z.number().int().min(1).max(365).default(30) }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [] as Array<{ eventType: string; count: number }>;
      const sinceDays = input?.sinceDays ?? 30;
      const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
      try {
        const rows = await db
          .select({ eventType: auditLogs.eventType, count: sql<number>`count(*)` })
          .from(auditLogs)
          .where(gte(auditLogs.createdAt, cutoff))
          .groupBy(auditLogs.eventType)
          .orderBy(desc(sql<number>`count(*)`));
        return rows.map((r) => ({ eventType: r.eventType, count: Number(r.count) }));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[audit.summary] error:", err);
        return [];
      }
    }),

  /**
   * Distinct resource types currently present in the log — feeds the filter dropdown.
   */
  resourceTypes: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [] as string[];
    try {
      const rows = await db
        .selectDistinct({ resourceType: auditLogs.resourceType })
        .from(auditLogs);
      return rows.map((r) => r.resourceType).filter((r): r is string => !!r).sort();
    } catch {
      return [];
    }
  }),
});
