import { boolean, int, mysqlEnum, mysqlTable, text, mediumtext, timestamp, varchar, json } from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** admin = full access, reviewer = read-only, user = internal user */
  role: mysqlEnum("role", ["user", "admin", "reviewer"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["active", "archived", "deleted"]).default("active").notNull(),
  workflowStatus: mysqlEnum("workflowStatus", [
    "uj",
    "elemzes_alatt",
    "ai_eloelenorizve",
    "ember_felulvizsgalva",
    "javitasra_visszakuldve",
    "lezart",
  ]).default("uj").notNull(),
  ownerId: int("ownerId").notNull(),
  discipline: mysqlEnum("discipline", [
    "altalanos", "epiteszet", "tuzvedelmi", "energetika",
    "statika", "gepeszet", "villamos", "geotechnika",
    "kozlekedes", "tajepiteszet", "egyeb",
  ]).default("altalanos").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Project members ──────────────────────────────────────────────────────────

export const projectMembers = mysqlTable("project_members", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "member", "reviewer"]).default("member").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;

// ─── Audit logs ───────────────────────────────────────────────────────────────

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userEmail: varchar("userEmail", { length: 320 }),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  resourceType: varchar("resourceType", { length: 64 }),
  resourceId: varchar("resourceId", { length: 255 }),
  description: text("description"),
  metadata: json("metadata"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── Compliance analysis sessions ────────────────────────────────────────────

export const analyses = mysqlTable("analyses", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  projectId: int("projectId"),
  userId: int("userId"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "error"])
    .default("pending")
    .notNull(),
  workflowStatus: mysqlEnum("workflowStatus", [
    "uj",
    "elemzes_alatt",
    "ai_eloelenorizve",
    "ember_felulvizsgalva",
    "javitasra_visszakuldve",
    "lezart",
  ]).default("uj"),
  /** Processing progress steps for SSE */
  progressStep: varchar("progressStep", { length: 128 }),
  retryCount: int("retryCount").default(0),
  planDocuments: json("planDocuments").$type<DocumentMeta[]>().default([]),
  regulationSourceIds: json("regulationSourceIds").$type<number[]>().default([]),
  regulationDocumentKeys: json("regulationDocumentKeys").$type<string[]>().default([]),
  regulationDocumentNames: json("regulationDocumentNames").$type<string[]>().default([]),
  results: json("results").$type<ComplianceResult[]>(),
  summary: text("summary"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;

// ─── Regulation sources library ───────────────────────────────────────────────

export const regulationSources = mysqlTable("regulation_sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  shortCode: varchar("shortCode", { length: 64 }),
  discipline: mysqlEnum("discipline", [
    "altalanos", "epiteszet", "tuzvedelmi", "energetika",
    "statika", "gepeszet", "villamos", "geotechnika",
    "kozlekedes", "tajepiteszet", "egyeb",
  ]).default("altalanos").notNull(),
  sourceType: mysqlEnum("sourceType", [
    "njt", "netjogtar", "eurlex", "mszt", "jogtar", "epitesijog", "pdf", "url",
  ]).default("njt").notNull(),
  sourceUrl: text("sourceUrl"),
  content: mediumtext("content"),
  contentFetchedAt: timestamp("contentFetchedAt"),
  /** When this source was last successfully synced */
  lastSyncAt: timestamp("lastSyncAt"),
  /** Sync status */
  syncStatus: mysqlEnum("syncStatus", ["ok", "error", "pending", "never"]).default("never"),
  /** Version or snapshot identifier */
  version: varchar("version", { length: 128 }),
  /** Last sync error message */
  lastSyncError: text("lastSyncError"),
  s3Key: varchar("s3Key", { length: 512 }),
  isActive: boolean("isActive").default(true).notNull(),
  /** Soft-delete timestamp (V11.7). Listing queries default to filtering on `IS NULL`. */
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RegulationSource = typeof regulationSources.$inferSelect;
export type InsertRegulationSource = typeof regulationSources.$inferInsert;

// ─── Platform credentials ─────────────────────────────────────────────────────

export const platformCredentials = mysqlTable("platform_credentials", {
  id: int("id").autoincrement().primaryKey(),
  platform: mysqlEnum("platform", ["mszt", "jogtar", "epitesijog", "eurlex"]).notNull(),
  displayName: varchar("displayName", { length: 255 }),
  username: varchar("username", { length: 320 }),
  encryptedPassword: text("encryptedPassword"),
  status: mysqlEnum("status", ["untested", "connected", "failed"]).default("untested").notNull(),
  lastConnectedAt: timestamp("lastConnectedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformCredential = typeof platformCredentials.$inferSelect;
export type InsertPlatformCredential = typeof platformCredentials.$inferInsert;

// ─── Shared types ─────────────────────────────────────────────────────────────

export type DocumentMeta = {
  key: string;
  name: string;
  fileType: DocumentFileType;
  discipline?: string;
  size?: number;
  /** Whether this document was processed via OCR */
  ocrUsed?: boolean;
  /** Document quality warning if applicable */
  qualityWarning?: string;
};

export type DocumentFileType = "pdf" | "docx" | "xlsx" | "dwg" | "dxf" | "ifc" | "rtf" | "jpg" | "png" | "other";

export type ComplianceStatus = "megfelel" | "reszben_megfelel" | "bizonytalan" | "nem_felel_meg";
export type ComplianceSeverity = "kritikus" | "kozepes" | "alacsony";
export type FindingWorkflowStatus = "nyitott" | "ellenorzes_alatt" | "elfogadva" | "elutasitva" | "javitva" | "lezarva";

export type ComplianceResult = {
  id: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  severity: ComplianceSeverity;
  confidence: number; // 0–100
  justification: string;
  /** Exact excerpt from the regulation/standard */
  regulationExcerpt?: string;
  /** Exact excerpt from the plan document */
  planExcerpt?: string;
  reference: string;
  category: string;
  discipline?: string;
  /** Suggested next action */
  nextStep?: string;
  /** Reason for uncertainty if status is bizonytalan */
  uncertaintyReason?: string;
  /** Whether OCR quality may have affected this finding */
  ocrQualityAffected?: boolean;
  /** Finding workflow status (for human review) */
  workflowStatus?: FindingWorkflowStatus;
  /** Assigned reviewer */
  assignedTo?: string;
  /** Human reviewer notes */
  reviewNote?: string;
};

// ─── Search queries ───────────────────────────────────────────────────────────

export const searchQueries = mysqlTable("search_queries", {
  id: int("id").autoincrement().primaryKey(),
  question: text("question").notNull(),
  rewrittenQuestion: text("rewritten_question"),
  searchMode: mysqlEnum("search_mode", ["mszt", "internal", "combined", "web", "combined_with_web"]).default("combined").notNull(),
  answerLength: mysqlEnum("answer_length", ["short", "standard", "detailed"]).default("standard").notNull(),
  operationMode: mysqlEnum("operation_mode", ["fast", "accurate"]).default("accurate").notNull(),
  answer: text("answer"),
  extendedAnswer: text("extended_answer"),
  confidence: mysqlEnum("confidence", ["low", "medium", "high"]),
  sources: json("sources").$type<SearchSource[]>(),
  hasSufficientSources: boolean("has_sufficient_sources").default(true).notNull(),
  selfCheckPassed: boolean("self_check_passed").default(true).notNull(),
  selfCheckNotes: text("self_check_notes"),
  userId: int("user_id"),
  projectId: int("project_id"),
  projectName: varchar("project_name", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SearchQuery = typeof searchQueries.$inferSelect;
export type InsertSearchQuery = typeof searchQueries.$inferInsert;

// ─── Search settings ──────────────────────────────────────────────────────────

export const searchSettings = mysqlTable("search_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"),
  answerLength: mysqlEnum("answer_length", ["short", "standard", "detailed"]).default("standard").notNull(),
  operationMode: mysqlEnum("operation_mode", ["fast", "accurate"]).default("accurate").notNull(),
  searchMode: mysqlEnum("search_mode", ["mszt", "internal", "combined", "web", "combined_with_web"]).default("combined").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SearchSetting = typeof searchSettings.$inferSelect;
export type InsertSearchSetting = typeof searchSettings.$inferInsert;

// ─── Search source type ───────────────────────────────────────────────────────

export type SearchSource = {
  documentName: string;
  page?: string;
  chapter?: string;
  url?: string;
  excerpt: string;
  relevanceScore?: number;
  sourceType?: "web" | "library" | "mszt" | "njt" | "netjogtar" | "eurlex";
};

// ─── Knowledge base documents ─────────────────────────────────────────────────

export const knowledgeBaseDocuments = mysqlTable("knowledge_base_documents", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  originalName: varchar("originalName", { length: 512 }).notNull(),
  fileType: varchar("fileType", { length: 32 }).notNull(),
  fileSize: int("fileSize").notNull(),
  s3Url: text("s3Url").notNull(),
  s3Key: varchar("s3Key", { length: 512 }).notNull(),
  extractedText: text("extractedText"),
  description: text("description"),
  tags: text("tags"),
  projectId: int("projectId"),
  /** Soft-delete timestamp (V11.7). */
  deletedAt: timestamp("deletedAt"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferSelect;
export type InsertKnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferInsert;

// ─── Chunk embeddings (semantic search — V12) ─────────────────────────────────
// Polymorphic table for chunk-level embeddings. `sourceType` distinguishes
// regulation_sources rows from knowledge_base_documents rows.

export const chunkEmbeddings = mysqlTable("chunk_embeddings", {
  id: int("id").autoincrement().primaryKey(),
  sourceType: mysqlEnum("source_type", ["regulation", "knowledge_base"]).notNull(),
  sourceId: int("source_id").notNull(),
  chunkIndex: int("chunk_index").notNull(),
  text: text("text").notNull(),
  embedding: json("embedding").$type<number[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChunkEmbedding = typeof chunkEmbeddings.$inferSelect;
export type InsertChunkEmbedding = typeof chunkEmbeddings.$inferInsert;
