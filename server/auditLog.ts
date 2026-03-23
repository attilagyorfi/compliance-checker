/**
 * Audit log helper.
 * Writes structured event records to the audit_logs table.
 * All writes are fire-and-forget – never throw to the caller.
 */
import { getDb } from "./db";
import { auditLogs } from "../drizzle/schema";

export type AuditEventType =
  | "user_login"
  | "user_logout"
  | "document_upload"
  | "document_delete"
  | "document_view"
  | "analysis_start"
  | "analysis_complete"
  | "analysis_error"
  | "analysis_retry"
  | "report_generate"
  | "report_download"
  | "regulation_source_add"
  | "regulation_source_update"
  | "regulation_source_delete"
  | "regulation_source_sync"
  | "credential_save"
  | "credential_delete"
  | "credential_test"
  | "search_query"
  | "knowledge_base_upload"
  | "knowledge_base_delete"
  | "project_create"
  | "project_update"
  | "project_archive"
  | "finding_status_change"
  | "workflow_status_change";

export type AuditResourceType =
  | "analysis"
  | "document"
  | "regulation_source"
  | "platform_credential"
  | "search_query"
  | "knowledge_base_document"
  | "project"
  | "user"
  | "report";

export interface AuditLogEntry {
  userId?: number;
  userEmail?: string;
  eventType: AuditEventType;
  resourceType?: AuditResourceType;
  resourceId?: string | number;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Write an audit log entry. Never throws.
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      userEmail: entry.userEmail ?? null,
      eventType: entry.eventType,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId != null ? String(entry.resourceId) : null,
      description: entry.description ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    // Never propagate audit log failures
    console.warn("[AuditLog] Failed to write entry:", err);
  }
}

/**
 * Extract IP address from an Express request.
 */
export function getIpFromRequest(req: { headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string | undefined {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip?.trim();
  }
  return req.socket?.remoteAddress;
}
