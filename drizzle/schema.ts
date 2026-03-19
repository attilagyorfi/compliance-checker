import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Compliance analysis sessions ────────────────────────────────────────────

export const analyses = mysqlTable("analyses", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "error"])
    .default("pending")
    .notNull(),
  // Plan documents (multiple)
  planDocuments: json("planDocuments").$type<DocumentMeta[]>().default([]),
  // Regulation sources used (IDs from regulation_sources table or inline)
  regulationSourceIds: json("regulationSourceIds").$type<number[]>().default([]),
  // Inline uploaded regulation docs (legacy / ad-hoc)
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
  /** Human-readable name, e.g. "TÉKA – 280/2024. Korm. rendelet" */
  name: varchar("name", { length: 512 }).notNull(),
  /** Short identifier, e.g. "TEKA_2024", "OTSZ_2014" */
  shortCode: varchar("shortCode", { length: 64 }),
  /** Discipline this regulation applies to */
  discipline: mysqlEnum("discipline", [
    "altalanos",
    "epiteszet",
    "tuzvedelmi",
    "energetika",
    "statika",
    "gepeszet",
    "villamos",
    "geotechnika",
    "kozlekedes",
    "tajepiteszet",
    "egyeb",
  ]).default("altalanos").notNull(),
  /** Source type */
  sourceType: mysqlEnum("sourceType", [
    "njt",        // Nemzeti Jogszabálytár (free, scrape)
    "netjogtar",  // net.jogtar.hu (free, scrape)
    "eurlex",     // EUR-Lex (free, API)
    "mszt",       // MSZT szabványtár (paid, login required)
    "jogtar",     // Jogtár Premium (paid, login required)
    "epitesijog", // Építésijog.hu (paid, login required)
    "pdf",        // Manually uploaded PDF
    "url",        // Generic URL
  ]).default("njt").notNull(),
  /** URL to fetch the regulation from */
  sourceUrl: text("sourceUrl"),
  /** Cached text content of the regulation */
  content: text("content"),
  /** When the content was last fetched */
  contentFetchedAt: timestamp("contentFetchedAt"),
  /** S3 key if stored as PDF */
  s3Key: varchar("s3Key", { length: 512 }),
  /** Is this regulation active/enabled */
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RegulationSource = typeof regulationSources.$inferSelect;
export type InsertRegulationSource = typeof regulationSources.$inferInsert;

// ─── Platform credentials ─────────────────────────────────────────────────────

export const platformCredentials = mysqlTable("platform_credentials", {
  id: int("id").autoincrement().primaryKey(),
  /** Which platform these credentials are for */
  platform: mysqlEnum("platform", ["mszt", "jogtar", "epitesijog", "eurlex"]).notNull(),
  /** Display name */
  displayName: varchar("displayName", { length: 255 }),
  /** Username / email */
  username: varchar("username", { length: 320 }),
  /** Encrypted password (AES-256) */
  encryptedPassword: text("encryptedPassword"),
  /** Connection status */
  status: mysqlEnum("status", ["untested", "connected", "failed"]).default("untested").notNull(),
  /** Last successful connection */
  lastConnectedAt: timestamp("lastConnectedAt"),
  /** Last error message */
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformCredential = typeof platformCredentials.$inferSelect;
export type InsertPlatformCredential = typeof platformCredentials.$inferInsert;

// ─── Shared types ─────────────────────────────────────────────────────────────

export type DocumentMeta = {
  key: string;         // S3 key
  name: string;        // Original filename
  fileType: DocumentFileType;
  discipline?: string; // Detected or user-assigned discipline
  size?: number;       // File size in bytes
};

export type DocumentFileType = "pdf" | "docx" | "xlsx" | "dwg" | "dxf" | "ifc" | "rtf" | "jpg" | "png" | "other";

export type ComplianceStatus = "megfelel" | "bizonytalan" | "nem_felel_meg";

export type ComplianceResult = {
  id: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  justification: string;
  reference: string;
  category: string;
  discipline?: string;
};
