import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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

// Compliance analysis sessions
export const analyses = mysqlTable("analyses", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "error"])
    .default("pending")
    .notNull(),
  planDocumentKey: varchar("planDocumentKey", { length: 512 }),
  planDocumentName: varchar("planDocumentName", { length: 255 }),
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

export type ComplianceStatus = "megfelel" | "bizonytalan" | "nem_felel_meg";

export type ComplianceResult = {
  id: string;
  title: string;
  description: string;
  status: ComplianceStatus;
  justification: string;
  reference: string;
  category: string;
};