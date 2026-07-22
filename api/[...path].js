var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/env.ts
function getLlmProvider() {
  if (ENV.openaiApiKey) return "openai";
  if (ENV.forgeApiKey && ENV.forgeApiUrl) return "forge";
  return null;
}
function getLlmChatConfig() {
  const provider = getLlmProvider();
  if (provider === "openai") {
    const base = ENV.openaiBaseUrl.replace(/\/+$/, "");
    return { url: `${base}/v1/chat/completions`, apiKey: ENV.openaiApiKey, model: ENV.llmModel };
  }
  if (provider === "forge") {
    const base = ENV.forgeApiUrl.replace(/\/+$/, "");
    return { url: `${base}/v1/chat/completions`, apiKey: ENV.forgeApiKey, model: ENV.llmModel };
  }
  return null;
}
function getLlmEmbeddingsConfig() {
  const provider = getLlmProvider();
  if (provider === "openai") {
    const base = ENV.openaiBaseUrl.replace(/\/+$/, "");
    return { url: `${base}/v1/embeddings`, apiKey: ENV.openaiApiKey, model: ENV.embeddingModel };
  }
  if (provider === "forge") {
    const base = ENV.forgeApiUrl.replace(/\/+$/, "");
    return { url: `${base}/v1/embeddings`, apiKey: ENV.forgeApiKey, model: ENV.embeddingModel };
  }
  return null;
}
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      // App-szintű alapok
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      isProduction: process.env.NODE_ENV === "production",
      // ── OAuth (legacy Manus + jövőbeli better-auth) ────────────────────────────
      appId: process.env.VITE_APP_ID ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      // ── LLM provider ────────────────────────────────────────────────────────────
      // Új primary: OpenAI direkt API-kulcs.
      openaiApiKey: process.env.OPENAI_API_KEY ?? "",
      openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com",
      llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
      embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
      // Legacy Manus forge (még támogatott deploy-okra). Ha ez be van állítva ÉS az
      // openaiApiKey üres, a kód a forge-ot használja.
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
    };
  }
});

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  accounts: () => accounts,
  analyses: () => analyses,
  auditLogs: () => auditLogs,
  chunkEmbeddings: () => chunkEmbeddings,
  knowledgeBaseDocuments: () => knowledgeBaseDocuments,
  notifications: () => notifications,
  platformCredentials: () => platformCredentials,
  projectMembers: () => projectMembers,
  projects: () => projects,
  regulationSources: () => regulationSources,
  searchQueries: () => searchQueries,
  searchSettings: () => searchSettings,
  sessions: () => sessions,
  users: () => users,
  verifications: () => verifications
});
import { boolean, int, mysqlEnum, mysqlTable, text, mediumtext, timestamp, varchar, json } from "drizzle-orm/mysql-core";
var users, sessions, accounts, verifications, projects, projectMembers, auditLogs, analyses, regulationSources, platformCredentials, searchQueries, searchSettings, knowledgeBaseDocuments, chunkEmbeddings, notifications;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      // openId megőrizve a régi Manus-felhasználók migrációjához. Új better-auth
      // user-eknél lehet üres / null.
      openId: varchar("openId", { length: 64 }).unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      /** Better-auth-kötelező: van-e megerősített e-mail (magic-link kattintás után true). */
      emailVerified: boolean("emailVerified").default(false).notNull(),
      /** Better-auth-opcionális: profilkép URL. */
      image: varchar("image", { length: 512 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      /** admin = full access, reviewer = read-only, user = internal user */
      role: mysqlEnum("role", ["user", "admin", "reviewer"]).default("user").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    sessions = mysqlTable("session", {
      id: int("id").autoincrement().primaryKey(),
      expiresAt: timestamp("expiresAt").notNull(),
      token: varchar("token", { length: 255 }).notNull().unique(),
      ipAddress: varchar("ipAddress", { length: 64 }),
      userAgent: text("userAgent"),
      userId: int("userId").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    accounts = mysqlTable("account", {
      id: int("id").autoincrement().primaryKey(),
      accountId: varchar("accountId", { length: 255 }).notNull(),
      providerId: varchar("providerId", { length: 64 }).notNull(),
      userId: int("userId").notNull(),
      accessToken: text("accessToken"),
      refreshToken: text("refreshToken"),
      idToken: text("idToken"),
      accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
      refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
      scope: text("scope"),
      password: text("password"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    verifications = mysqlTable("verification", {
      id: int("id").autoincrement().primaryKey(),
      identifier: varchar("identifier", { length: 320 }).notNull(),
      value: text("value").notNull(),
      expiresAt: timestamp("expiresAt").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    projects = mysqlTable("projects", {
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
        "lezart"
      ]).default("uj").notNull(),
      ownerId: int("ownerId").notNull(),
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
        "egyeb"
      ]).default("altalanos").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    projectMembers = mysqlTable("project_members", {
      id: int("id").autoincrement().primaryKey(),
      projectId: int("projectId").notNull(),
      userId: int("userId").notNull(),
      role: mysqlEnum("role", ["owner", "member", "reviewer"]).default("member").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    auditLogs = mysqlTable("audit_logs", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId"),
      userEmail: varchar("userEmail", { length: 320 }),
      eventType: varchar("eventType", { length: 64 }).notNull(),
      resourceType: varchar("resourceType", { length: 64 }),
      resourceId: varchar("resourceId", { length: 255 }),
      description: text("description"),
      metadata: json("metadata"),
      ipAddress: varchar("ipAddress", { length: 64 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    analyses = mysqlTable("analyses", {
      id: int("id").autoincrement().primaryKey(),
      title: varchar("title", { length: 255 }).notNull(),
      projectId: int("projectId"),
      userId: int("userId"),
      status: mysqlEnum("status", ["pending", "processing", "completed", "error"]).default("pending").notNull(),
      workflowStatus: mysqlEnum("workflowStatus", [
        "uj",
        "elemzes_alatt",
        "ai_eloelenorizve",
        "ember_felulvizsgalva",
        "javitasra_visszakuldve",
        "lezart"
      ]).default("uj"),
      /** Processing progress steps for SSE */
      progressStep: varchar("progressStep", { length: 128 }),
      retryCount: int("retryCount").default(0),
      planDocuments: json("planDocuments").$type().default([]),
      regulationSourceIds: json("regulationSourceIds").$type().default([]),
      regulationDocumentKeys: json("regulationDocumentKeys").$type().default([]),
      regulationDocumentNames: json("regulationDocumentNames").$type().default([]),
      results: json("results").$type(),
      summary: text("summary"),
      errorMessage: text("errorMessage"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    regulationSources = mysqlTable("regulation_sources", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 512 }).notNull(),
      shortCode: varchar("shortCode", { length: 64 }),
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
        "egyeb"
      ]).default("altalanos").notNull(),
      sourceType: mysqlEnum("sourceType", [
        "njt",
        "netjogtar",
        "eurlex",
        "mszt",
        "jogtar",
        "epitesijog",
        "pdf",
        "url"
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    platformCredentials = mysqlTable("platform_credentials", {
      id: int("id").autoincrement().primaryKey(),
      platform: mysqlEnum("platform", ["mszt", "jogtar", "epitesijog", "eurlex"]).notNull(),
      displayName: varchar("displayName", { length: 255 }),
      username: varchar("username", { length: 320 }),
      encryptedPassword: text("encryptedPassword"),
      status: mysqlEnum("status", ["untested", "connected", "failed"]).default("untested").notNull(),
      lastConnectedAt: timestamp("lastConnectedAt"),
      lastError: text("lastError"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    searchQueries = mysqlTable("search_queries", {
      id: int("id").autoincrement().primaryKey(),
      question: text("question").notNull(),
      rewrittenQuestion: text("rewritten_question"),
      searchMode: mysqlEnum("search_mode", ["mszt", "internal", "combined", "web", "combined_with_web"]).default("combined").notNull(),
      answerLength: mysqlEnum("answer_length", ["short", "standard", "detailed"]).default("standard").notNull(),
      operationMode: mysqlEnum("operation_mode", ["fast", "accurate"]).default("accurate").notNull(),
      answer: text("answer"),
      extendedAnswer: text("extended_answer"),
      confidence: mysqlEnum("confidence", ["low", "medium", "high"]),
      sources: json("sources").$type(),
      hasSufficientSources: boolean("has_sufficient_sources").default(true).notNull(),
      selfCheckPassed: boolean("self_check_passed").default(true).notNull(),
      selfCheckNotes: text("self_check_notes"),
      userId: int("user_id"),
      projectId: int("project_id"),
      projectName: varchar("project_name", { length: 255 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    searchSettings = mysqlTable("search_settings", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("user_id"),
      answerLength: mysqlEnum("answer_length", ["short", "standard", "detailed"]).default("standard").notNull(),
      operationMode: mysqlEnum("operation_mode", ["fast", "accurate"]).default("accurate").notNull(),
      searchMode: mysqlEnum("search_mode", ["mszt", "internal", "combined", "web", "combined_with_web"]).default("combined").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    knowledgeBaseDocuments = mysqlTable("knowledge_base_documents", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    chunkEmbeddings = mysqlTable("chunk_embeddings", {
      id: int("id").autoincrement().primaryKey(),
      sourceType: mysqlEnum("source_type", ["regulation", "knowledge_base"]).notNull(),
      sourceId: int("source_id").notNull(),
      chunkIndex: int("chunk_index").notNull(),
      text: text("text").notNull(),
      embedding: json("embedding").$type().notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull()
    });
    notifications = mysqlTable("notifications", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull(),
      eventType: varchar("eventType", { length: 64 }).notNull(),
      title: varchar("title", { length: 255 }).notNull(),
      body: text("body"),
      link: varchar("link", { length: 512 }),
      isRead: boolean("isRead").default(false).notNull(),
      /** Mikor küldött ki erről email — null = még nem (vagy nincs SMTP). */
      emailSentAt: timestamp("emailSentAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  createAnalysis: () => createAnalysis,
  getAnalysisById: () => getAnalysisById,
  getDb: () => getDb,
  getUserByOpenId: () => getUserByOpenId,
  listAnalyses: () => listAnalyses,
  updateAnalysisStatus: () => updateAnalysisStatus,
  upsertUser: () => upsertUser
});
import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
function needsTls(url) {
  if (/[?&]ssl=/.test(url)) return false;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = process.env.DATABASE_URL;
      if (needsTls(url)) {
        const mysql = await import("mysql2");
        const pool = mysql.default.createPool({
          uri: url,
          ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true }
        });
        _db = drizzle(pool);
      } else {
        _db = drizzle(url);
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createAnalysis(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(analyses).values(data);
  return result[0].insertId;
}
async function getAnalysisById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
  return result[0];
}
async function listAnalyses(filter) {
  const db = await getDb();
  if (!db) return [];
  if (filter?.projectId !== void 0) {
    return db.select().from(analyses).where(eq(analyses.projectId, filter.projectId)).orderBy(desc(analyses.createdAt)).limit(50);
  }
  return db.select().from(analyses).orderBy(desc(analyses.createdAt)).limit(50);
}
async function updateAnalysisStatus(id, status, extra) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(analyses).set({ status, ...extra }).where(eq(analyses.id, id));
}
var _db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    _db = null;
  }
});

// server/documentExtractor.ts
var documentExtractor_exports = {};
__export(documentExtractor_exports, {
  detectDiscipline: () => detectDiscipline,
  detectFileType: () => detectFileType,
  extractDocumentText: () => extractDocumentText,
  extractFromDocx: () => extractFromDocx,
  extractFromDwgDxf: () => extractFromDwgDxf,
  extractFromIfc: () => extractFromIfc,
  extractFromPdf: () => extractFromPdf,
  extractFromRtf: () => extractFromRtf,
  extractFromXlsx: () => extractFromXlsx,
  fixHungarianMojibake: () => fixHungarianMojibake
});
function detectFileType(filename, mimeType) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeType?.toLowerCase() ?? "";
  if (ext === "pdf" || mime.includes("pdf")) return "pdf";
  if (ext === "docx" || mime.includes("wordprocessingml") || mime.includes("msword")) return "docx";
  if (ext === "doc") return "docx";
  if (ext === "xlsx" || ext === "xls" || mime.includes("spreadsheetml") || mime.includes("excel")) return "xlsx";
  if (ext === "dwg") return "dwg";
  if (ext === "dxf") return "dxf";
  if (ext === "ifc") return "ifc";
  if (ext === "rtf") return "rtf";
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return "jpg";
  return "other";
}
function detectDiscipline(filename, textSample) {
  const lower = (filename + " " + (textSample ?? "")).toLowerCase();
  if (/tűzv|otsz|tvmi|tűzjelz|sprinkler|tűzoltó|tűzgát/.test(lower)) return "tuzvedelmi";
  if (/statik|tartószerkezet|vasbeton|acélszerkezet|eurocode|alapozás|geotechnik/.test(lower)) return "statika";
  if (/energetik|hőátbocsátás|u-érték|ep-érték|tanúsítvány|tnm|hőszigete/.test(lower)) return "energetika";
  if (/gépészet|fűtés|szellőzés|vízvezeték|csatorna|hvac|klíma/.test(lower)) return "gepeszet";
  if (/villamos|elektromos|erősáram|gyengeáram|mérőhely/.test(lower)) return "villamos";
  if (/közlekedés|parkoló|útcsatlakozás|forgalom/.test(lower)) return "kozlekedes";
  if (/tájépítész|zöldfelület|tereprendezés|növény/.test(lower)) return "tajepiteszet";
  if (/geotechnik|talajmechanik|fúrás|rétegsor/.test(lower)) return "geotechnika";
  if (/építészet|alaprajz|homlokzat|metszet|helyszínrajz/.test(lower)) return "epiteszet";
  return "altalanos";
}
function fixHungarianMojibake(text2) {
  if (!text2) return text2;
  return text2.replace(HU_MOJIBAKE_RE, (c) => HU_MOJIBAKE_MAP[c] ?? c);
}
async function extractFromPdf(buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return fixHungarianMojibake(result.text || "");
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    console.warn("[DocumentExtractor] PDF extraction failed:", err);
    return buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, "\n").slice(0, 5e4);
  }
}
async function extractFromDocx(buffer) {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (err) {
    console.warn("[DocumentExtractor] DOCX extraction failed:", err);
    return "";
  }
}
async function extractFromXlsx(buffer) {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet);
      lines.push(`=== Munkalap: ${sheetName} ===`);
      lines.push(csv.slice(0, 1e4));
    }
    return lines.join("\n\n");
  } catch (err) {
    console.warn("[DocumentExtractor] XLSX extraction failed:", err);
    return "";
  }
}
async function extractFromDwgDxf(buffer, fileType) {
  try {
    const content = buffer.toString("utf8");
    if (fileType === "dxf") {
      const lines = content.split("\n");
      const textValues = [];
      for (let i = 0; i < lines.length - 1; i++) {
        const code = lines[i]?.trim();
        const value = lines[i + 1]?.trim();
        if ((code === "1" || code === "3") && value && value.length > 1) {
          textValues.push(value);
        }
      }
      return textValues.join("\n").slice(0, 3e4);
    } else {
      const printable = buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t]/g, "\0").split("\0").filter((s) => s.trim().length >= 4).join("\n");
      return printable.slice(0, 3e4);
    }
  } catch (err) {
    console.warn("[DocumentExtractor] DWG/DXF extraction failed:", err);
    return "";
  }
}
async function extractFromIfc(buffer) {
  try {
    const content = buffer.toString("utf8");
    const lines = content.split("\n");
    const extracted = [];
    const headerLines = lines.slice(0, 20).join("\n");
    extracted.push("=== IFC Fejl\xE9c ===");
    extracted.push(headerLines);
    const entityPatterns = [
      /IFCPROJECT\s*\([^)]*'([^']+)'/gi,
      /IFCBUILDING\s*\([^)]*'([^']+)'/gi,
      /IFCBUILDINGSTOREY\s*\([^)]*'([^']+)'/gi,
      /IFCSPACE\s*\([^)]*'([^']+)'/gi,
      /IFCPROPERTYSINGLEVALUE\s*\('([^']+)'/gi
    ];
    extracted.push("\n=== IFC Entit\xE1sok ===");
    for (const pattern of entityPatterns) {
      const matches = Array.from(content.matchAll(pattern));
      for (const match of matches.slice(0, 50)) {
        if (match[1]) extracted.push(match[1]);
      }
    }
    return extracted.join("\n").slice(0, 3e4);
  } catch (err) {
    console.warn("[DocumentExtractor] IFC extraction failed:", err);
    return "";
  }
}
async function extractFromRtf(buffer) {
  try {
    const content = buffer.toString("latin1");
    const stripped = content.replace(/\\[a-z]+[-]?\d*\s?/gi, " ").replace(/[{}\\]/g, " ").replace(/\s{2,}/g, " ").trim();
    return stripped.slice(0, 3e4);
  } catch (err) {
    console.warn("[DocumentExtractor] RTF extraction failed:", err);
    return "";
  }
}
async function extractDocumentText(buffer, filename, mimeType) {
  const fileType = detectFileType(filename, mimeType);
  let text2 = "";
  let warning;
  switch (fileType) {
    case "pdf":
      text2 = await extractFromPdf(buffer);
      break;
    case "docx":
      text2 = await extractFromDocx(buffer);
      break;
    case "xlsx":
      text2 = await extractFromXlsx(buffer);
      break;
    case "dwg":
    case "dxf":
      text2 = await extractFromDwgDxf(buffer, fileType);
      break;
    case "ifc":
      text2 = await extractFromIfc(buffer);
      break;
    case "rtf":
      text2 = await extractFromRtf(buffer);
      break;
    case "jpg":
    case "png":
      text2 = `[K\xE9pf\xE1jl: ${filename} \u2013 sz\xF6veges tartalom nem el\xE9rhet\u0151]`;
      warning = "K\xE9pf\xE1jlb\xF3l sz\xF6veg nem nyerhet\u0151 ki automatikusan.";
      break;
    default:
      text2 = buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, "\n").slice(0, 2e4);
      warning = "Ismeretlen f\xE1jlt\xEDpus \u2013 \xE1ltal\xE1nos sz\xF6vegkinyer\xE9s alkalmazva.";
  }
  const discipline = detectDiscipline(filename, text2.slice(0, 2e3));
  return {
    text: text2.trim(),
    fileType,
    discipline,
    characterCount: text2.length,
    warning
  };
}
var HU_MOJIBAKE_MAP, HU_MOJIBAKE_RE;
var init_documentExtractor = __esm({
  "server/documentExtractor.ts"() {
    "use strict";
    HU_MOJIBAKE_MAP = {
      "\xB7": "\xE1",
      // ·
      "\xC8": "\xE9",
      // È
      "\xDB": "\xF3",
      // Û
      "\u02C6": "\xF6",
      // ˆ
      "\xCC": "\xED",
      // Ì
      "\u02D9": "\xFA",
      // ˙
      "\xB8": "\xFC",
      // ¸
      "\xA1": "\xC1"
      // ¡
    };
    HU_MOJIBAKE_RE = /[·ÈÛˆÌ˙¸¡]/g;
  }
});

// server/regulationScraper.ts
var regulationScraper_exports = {};
__export(regulationScraper_exports, {
  MSZT_SESSION_TTL_MS: () => MSZT_SESSION_TTL_MS,
  cookieHeaderFromResponse: () => cookieHeaderFromResponse,
  decryptPassword: () => decryptPassword,
  encryptPassword: () => encryptPassword,
  fetchFromNetJogtar: () => fetchFromNetJogtar,
  fetchFromNjt: () => fetchFromNjt,
  fetchPdfFromUrl: () => fetchPdfFromUrl,
  fetchRegulationText: () => fetchRegulationText,
  getMsztSession: () => getMsztSession,
  invalidateMsztSession: () => invalidateMsztSession,
  isMsztLiveSearchEnabled: () => isMsztLiveSearchEnabled,
  loginToEpitesijog: () => loginToEpitesijog,
  loginToJogtar: () => loginToJogtar,
  loginToMszt: () => loginToMszt,
  mergeCookies: () => mergeCookies,
  searchMsztLive: () => searchMsztLive,
  withSessionCache: () => withSessionCache
});
import * as cheerio from "cheerio";
import * as crypto from "crypto";
async function fetchFromNjt(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8"
    }
  });
  if (!response.ok) {
    throw new Error(`NJT fetch failed: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  return extractNjtText(html);
}
function extractNjtText(html) {
  const $ = cheerio.load(html);
  $("nav, header, footer, script, style, .menu, .sidebar, .breadcrumb, .print-header").remove();
  $(".cookie-notice, .modal, .overlay, .popup").remove();
  const mainContent = $(".jogszabaly-tartalom, #tartalom, .regulation-body, main, article").first();
  let text2;
  if (mainContent.length > 0) {
    text2 = mainContent.text();
  } else {
    $("body").find("nav, header, footer, script, style").remove();
    text2 = $("body").text();
  }
  return text2.replace(/\t/g, " ").replace(/[ ]{3,}/g, "  ").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, 2e5);
}
async function fetchFromNetJogtar(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8"
    }
  });
  if (!response.ok) {
    throw new Error(`net.jogtar.hu fetch failed: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  return extractNetJogtarText(html);
}
function extractNetJogtarText(html) {
  const $ = cheerio.load(html);
  $("nav, header, footer, script, style, .navigation, .sidebar, .ads").remove();
  $(".cookie-bar, .modal, .toolbar").remove();
  const mainContent = $(".jogszabaly, .law-content, #content, .content-body, main").first();
  let text2;
  if (mainContent.length > 0) {
    text2 = mainContent.text();
  } else {
    $("body").find("nav, header, footer, script, style").remove();
    text2 = $("body").text();
  }
  return text2.replace(/\t/g, " ").replace(/[ ]{3,}/g, "  ").replace(/\n{4,}/g, "\n\n\n").trim().slice(0, 2e5);
}
async function fetchPdfFromUrl(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)"
    }
  });
  if (!response.ok) {
    throw new Error(`PDF fetch failed: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
function cookieHeaderFromResponse(headers) {
  const getSetCookie = headers.getSetCookie?.bind(headers);
  let rawCookies = [];
  if (typeof getSetCookie === "function") {
    rawCookies = getSetCookie();
  } else {
    const single = headers.get("set-cookie");
    if (single) {
      rawCookies = single.split(/,\s*(?=[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/);
    }
  }
  return rawCookies.map((c) => {
    const semi = c.indexOf(";");
    return (semi === -1 ? c : c.slice(0, semi)).trim();
  }).filter((c) => c.includes("=")).join("; ");
}
function mergeCookies(...cookieStrings) {
  const map = /* @__PURE__ */ new Map();
  for (const cookieStr of cookieStrings) {
    if (!cookieStr) continue;
    for (const part of cookieStr.split(/;\s*/)) {
      if (!part) continue;
      const eq12 = part.indexOf("=");
      if (eq12 === -1) continue;
      const name = part.slice(0, eq12).trim();
      if (name) map.set(name, part.slice(eq12 + 1).trim());
    }
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}
async function loginToMszt(username, password) {
  const BASE = "http://szabvanykonyvtar.mszt.hu";
  const TIMEOUT_MS = 15e3;
  try {
    const loginPageRes = await fetch(`${BASE}/login`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8"
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!loginPageRes.ok) {
      return { success: false, error: `Login oldal bet\xF6lt\xE9se sikertelen: HTTP ${loginPageRes.status}` };
    }
    const loginHtml = await loginPageRes.text();
    const $ = cheerio.load(loginHtml);
    const csrfToken = $('input[name="_csrf_token"]').val();
    const setCookieHeader = loginPageRes.headers.get("set-cookie") ?? "";
    const phpSessMatch = setCookieHeader.match(/PHPSESSID=([^;]+)/);
    const phpSessId = phpSessMatch ? `PHPSESSID=${phpSessMatch[1]}` : "";
    if (!csrfToken) {
      return { success: false, error: "CSRF token nem tal\xE1lhat\xF3 a bejelentkez\xE9si oldalon. Az MSZT oldal strukt\xFAr\xE1ja megv\xE1ltozott." };
    }
    const formData = new URLSearchParams();
    formData.append("_username", username);
    formData.append("_password", password);
    formData.append("_csrf_token", csrfToken);
    formData.append("_target_path", "search");
    formData.append("login", "Bejelentkez\xE9s");
    const loginRes = await fetch(`${BASE}/login_check`, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": phpSessId,
        "Referer": `${BASE}/login`,
        "Origin": BASE
      },
      body: formData.toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const newSessionCookies = cookieHeaderFromResponse(loginRes.headers);
    const location = loginRes.headers.get("location") ?? "";
    const isSuccess = loginRes.status === 302 && !location.includes("/login");
    if (isSuccess) {
      return { success: true, sessionCookies: mergeCookies(phpSessId, newSessionCookies) };
    } else {
      try {
        const redirectedRes = await fetch(location || `${BASE}/login`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Cookie": phpSessId
          },
          signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        const redirectedHtml = await redirectedRes.text();
        if (redirectedHtml.includes("m\xE1r bejelentkezett") || redirectedHtml.includes("Sajn\xE1ljuk")) {
          return { success: false, error: "Ez a fi\xF3k m\xE1r be van jelentkezve egy m\xE1sik munkamenetben. Az MSZT szerver 20 percenk\xE9nt automatikusan kijelentkeztet. K\xE9rj\xFCk, v\xE1rjon 20 percet, majd pr\xF3b\xE1lja \xFAjra." };
        }
      } catch {
      }
      const errorMsg = location.includes("/login") ? "Hib\xE1s felhaszn\xE1l\xF3n\xE9v vagy jelsz\xF3." : `Bejelentkez\xE9s sikertelen (HTTP ${loginRes.status}).`;
      return { success: false, error: errorMsg };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let friendlyMsg = msg;
    if (msg.includes("timeout") || msg.includes("TimeoutError")) {
      friendlyMsg = "Kapcsolat id\u0151t\xFAll\xE9p\xE9s \u2013 az MSZT szerver nem v\xE1laszolt 15 m\xE1sodpercen bel\xFCl.";
    } else if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      friendlyMsg = "H\xE1l\xF3zati hiba \u2013 nem siker\xFClt kapcsol\xF3dni az MSZT szerverhez. Ellen\u0151rizze az internetkapcsolatot.";
    }
    return { success: false, error: `Kapcsol\xF3d\xE1si hiba: ${friendlyMsg}` };
  }
}
async function loginToJogtar(username, password) {
  try {
    const loginPageRes = await fetch("https://uj.jogtar.hu/login", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    const loginHtml = loginPageRes.ok ? await loginPageRes.text() : "";
    const $ = cheerio.load(loginHtml);
    const csrfToken = $('input[name="_token"], meta[name="csrf-token"]').attr("content") ?? $('input[name="_token"]').val();
    const initialCookies = cookieHeaderFromResponse(loginPageRes.headers);
    const formData = new URLSearchParams();
    formData.append("email", username);
    formData.append("password", password);
    if (csrfToken) formData.append("_token", csrfToken);
    const loginRes = await fetch("https://uj.jogtar.hu/login", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": initialCookies,
        "Referer": "https://uj.jogtar.hu/login"
      },
      body: formData.toString(),
      redirect: "manual"
    });
    const newSessionCookies = cookieHeaderFromResponse(loginRes.headers);
    const isSuccess = loginRes.status === 302 || newSessionCookies.includes("session");
    if (isSuccess) {
      return { success: true, sessionCookies: mergeCookies(initialCookies, newSessionCookies) };
    } else {
      return { success: false, error: "Bejelentkez\xE9s sikertelen \u2013 ellen\u0151rizze a felhaszn\xE1l\xF3nevet \xE9s jelsz\xF3t." };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
async function loginToEpitesijog(username, password) {
  try {
    const loginPageRes = await fetch("https://epitesijog.hu/belepes", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    const loginHtml = loginPageRes.ok ? await loginPageRes.text() : "";
    const $ = cheerio.load(loginHtml);
    const csrfToken = $('input[name="_token"]').val();
    const initialCookies = cookieHeaderFromResponse(loginPageRes.headers);
    const formData = new URLSearchParams();
    formData.append("email", username);
    formData.append("password", password);
    if (csrfToken) formData.append("_token", csrfToken);
    const loginRes = await fetch("https://epitesijog.hu/belepes", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": initialCookies,
        "Referer": "https://epitesijog.hu/belepes"
      },
      body: formData.toString(),
      redirect: "manual"
    });
    const newSessionCookies = cookieHeaderFromResponse(loginRes.headers);
    const isSuccess = loginRes.status === 302 || newSessionCookies.includes("session");
    if (isSuccess) {
      return { success: true, sessionCookies: mergeCookies(initialCookies, newSessionCookies) };
    } else {
      return { success: false, error: "Bejelentkez\xE9s sikertelen \u2013 ellen\u0151rizze a felhaszn\xE1l\xF3nevet \xE9s jelsz\xF3t." };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}
async function withSessionCache(cache, ttlMs, username, password, loginFn) {
  const now = Date.now();
  const passwordHash = hashPassword(password);
  const cached = cache.get(username);
  if (cached && cached.expiresAt > now && cached.passwordHash === passwordHash) {
    return { success: true, sessionCookies: cached.sessionCookies };
  }
  const result = await loginFn(username, password);
  if (result.success && result.sessionCookies) {
    cache.set(username, {
      sessionCookies: result.sessionCookies,
      expiresAt: now + ttlMs,
      passwordHash
    });
  } else {
    cache.delete(username);
  }
  return result;
}
function getMsztSession(username, password) {
  return withSessionCache(msztSessionCache, MSZT_SESSION_TTL_MS, username, password, loginToMszt);
}
function invalidateMsztSession(username) {
  if (username) msztSessionCache.delete(username);
  else msztSessionCache.clear();
}
function isMsztLiveSearchEnabled() {
  return (process.env.ENABLE_LIVE_MSZT_SEARCH ?? "").toLowerCase() === "true";
}
async function searchMsztLive(query, credentials, topK = 5) {
  if (!isMsztLiveSearchEnabled()) return [];
  if (!query.trim()) return [];
  const BASE = "http://szabvanykonyvtar.mszt.hu";
  const TIMEOUT_MS = 15e3;
  try {
    const session = await getMsztSession(credentials.username, credentials.password);
    if (!session.success || !session.sessionCookies) return [];
    const searchUrl = `${BASE}/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
        "Cookie": session.sessionCookies,
        "Referer": `${BASE}/search`
      },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) {
      console.warn(`[MSZT live search] HTTP ${res.status}`);
      return [];
    }
    const html = await res.text();
    if (html.includes("_username") && html.includes("_password") && html.includes("_csrf_token")) {
      invalidateMsztSession(credentials.username);
      return [];
    }
    const $ = cheerio.load(html);
    const selectorCandidates = [
      ".search-result",
      ".standard-item",
      ".result-item",
      ".szabvany-item",
      ".search-results .item",
      "article",
      "tr.result"
    ];
    let hits = [];
    for (const sel of selectorCandidates) {
      const elements = $(sel);
      if (elements.length === 0) continue;
      hits = elements.toArray().slice(0, topK).map((el) => {
        const $el = $(el);
        const linkEl = $el.find("a").first();
        const link = linkEl.attr("href");
        const url = link ? link.startsWith("http") ? link : `${BASE}${link.startsWith("/") ? "" : "/"}${link}` : void 0;
        const name = (linkEl.text() || $el.find("h1,h2,h3,h4,.title").first().text() || $el.text().slice(0, 200)).trim();
        const excerpt = $el.text().replace(/\s+/g, " ").trim().slice(0, 600);
        return {
          documentName: name || "MSZT tal\xE1lat",
          url,
          excerpt
        };
      }).filter((h) => h.documentName.length > 0 && h.excerpt.length > 20);
      if (hits.length > 0) break;
    }
    return hits;
  } catch (err) {
    console.warn("[MSZT live search] error:", err instanceof Error ? err.message : err);
    return [];
  }
}
async function fetchRegulationText(sourceType, url, credentials) {
  const fetchedAt = /* @__PURE__ */ new Date();
  switch (sourceType) {
    case "njt":
      return { text: await fetchFromNjt(url), fetchedAt };
    case "netjogtar":
      return { text: await fetchFromNetJogtar(url), fetchedAt };
    case "url":
      if (url.toLowerCase().endsWith(".pdf")) {
        const buf = await fetchPdfFromUrl(url);
        const { extractFromPdf: extractFromPdf2 } = await Promise.resolve().then(() => (init_documentExtractor(), documentExtractor_exports));
        return { text: await extractFromPdf2(buf), fetchedAt };
      } else {
        return { text: await fetchFromNjt(url), fetchedAt };
      }
    case "mszt":
    case "jogtar":
    case "epitesijog":
      if (!credentials) {
        return {
          text: "",
          fetchedAt,
          warning: `A ${sourceType.toUpperCase()} platformhoz bejelentkez\xE9si adatok sz\xFCks\xE9gesek. K\xE9rj\xFCk, adja meg a hiteles\xEDt\u0151 adatokat a Be\xE1ll\xEDt\xE1sok / Platform-kapcsolatok men\xFCpontban.`
        };
      }
      let loginResult;
      if (sourceType === "mszt") loginResult = await getMsztSession(credentials.username, credentials.password);
      else if (sourceType === "jogtar") loginResult = await loginToJogtar(credentials.username, credentials.password);
      else loginResult = await loginToEpitesijog(credentials.username, credentials.password);
      if (!loginResult.success) {
        return {
          text: "",
          fetchedAt,
          warning: `Bejelentkez\xE9s sikertelen: ${loginResult.error}`
        };
      }
      try {
        const contentRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
            "Cookie": loginResult.sessionCookies ?? ""
          }
        });
        const html = await contentRes.text();
        const $ = cheerio.load(html);
        $("nav, header, footer, script, style").remove();
        const text2 = $("body").text().replace(/\s{3,}/g, "\n").trim().slice(0, 2e5);
        return { text: text2, fetchedAt };
      } catch (err) {
        return {
          text: "",
          fetchedAt,
          warning: `Tartalom let\xF6lt\xE9se sikertelen: ${err instanceof Error ? err.message : String(err)}`
        };
      }
    case "eurlex":
      return { text: await fetchFromNjt(url), fetchedAt };
    // HTML scraping works for EUR-Lex too
    case "pdf":
      return {
        text: "",
        fetchedAt,
        warning: "PDF forr\xE1s eset\xE9n t\xF6ltse fel a f\xE1jlt manu\xE1lisan."
      };
    default:
      return { text: "", fetchedAt, warning: "Ismeretlen forr\xE1st\xEDpus." };
  }
}
function getEncryptionKey() {
  const secret = process.env.JWT_SECRET ?? "compliance-checker-key-2024";
  return crypto.scryptSync(secret, SCRYPT_SALT, 32);
}
function encryptPassword(plaintext) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("base64") + ":" + encrypted.toString("base64");
}
function decryptPassword(encrypted) {
  if (!encrypted.includes(":")) {
    return decryptLegacyXor(encrypted);
  }
  const sep = encrypted.indexOf(":");
  const iv = Buffer.from(encrypted.slice(0, sep), "base64");
  const data = Buffer.from(encrypted.slice(sep + 1), "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
function decryptLegacyXor(encrypted) {
  const ENCRYPTION_KEY = process.env.JWT_SECRET ?? "compliance-checker-key-2024";
  const key = Buffer.from(ENCRYPTION_KEY);
  const data = Buffer.from(encrypted, "base64");
  const decrypted = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i] ^ key[i % key.length];
  }
  return decrypted.toString("utf8");
}
var MSZT_SESSION_TTL_MS, msztSessionCache, SCRYPT_SALT;
var init_regulationScraper = __esm({
  "server/regulationScraper.ts"() {
    "use strict";
    MSZT_SESSION_TTL_MS = 15 * 60 * 1e3;
    msztSessionCache = /* @__PURE__ */ new Map();
    SCRYPT_SALT = "compliance-checker-aes-salt-v1";
  }
});

// server/_core/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/routers/compliance.ts
import { z } from "zod";

// shared/const.ts
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/routers/compliance.ts
import { TRPCError as TRPCError2 } from "@trpc/server";

// server/_core/llm.ts
init_env();
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  const cfg = getLlmChatConfig();
  if (!cfg) {
    throw new Error(
      "Nincs LLM-provider konfigur\xE1lva. \xC1ll\xEDtsd be az OPENAI_API_KEY env-v\xE1ltoz\xF3t (vagy legacy: BUILT_IN_FORGE_API_KEY + BUILT_IN_FORGE_API_URL)."
    );
  }
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: cfg.model,
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const maxTokensEnv = Number(process.env.LLM_MAX_TOKENS);
  payload.max_completion_tokens = Number.isFinite(maxTokensEnv) && maxTokensEnv > 0 ? maxTokensEnv : 8192;
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed (${cfg.model}): ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/storage.ts
init_env();
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
function pickProvider() {
  if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET) {
    return "r2";
  }
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return "forge";
  }
  return null;
}
var _r2Client = null;
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const bucket = process.env.R2_BUCKET ?? "";
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim() || null;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 storage missing config. Required env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET."
    );
  }
  if (!_r2Client) {
    _r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey }
    });
  }
  return { client: _r2Client, bucket, publicBaseUrl };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
async function r2Put(relKey, data, contentType) {
  const { client, bucket, publicBaseUrl } = getR2Client();
  const key = normalizeKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType
  }));
  const url = publicBaseUrl ? `${publicBaseUrl.replace(/\/+$/, "")}/${key}` : await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 24 * 60 * 60 });
  return { key, url };
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
async function forgePut(relKey, data, contentType) {
  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const apiKey = ENV.forgeApiKey;
  const key = normalizeKey(relKey);
  const uploadUrl = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  uploadUrl.searchParams.set("path", key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
  }
  const url = (await response.json()).url;
  return { key, url };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const provider = pickProvider();
  if (provider === "r2") return r2Put(relKey, data, contentType);
  if (provider === "forge") return forgePut(relKey, data, contentType);
  throw new Error(
    "Storage nincs konfigur\xE1lva. \xDAj deploy: R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_BUCKET. Legacy: BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY."
  );
}

// server/routers/compliance.ts
init_db();
import { nanoid } from "nanoid";

// server/relevanceChunker.ts
function tokenise(text2) {
  return text2.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((t2) => t2.length > 2);
}
function buildTF(tokens) {
  const tf = /* @__PURE__ */ new Map();
  for (const t2 of tokens) {
    tf.set(t2, (tf.get(t2) ?? 0) + 1);
  }
  return tf;
}
function overlapScore(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, countA] of Array.from(a.entries())) {
    normA += countA * countA;
    const countB = b.get(term) ?? 0;
    dot += countA * countB;
  }
  for (const [, countB] of Array.from(b.entries())) {
    normB += countB * countB;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
function chunkText(text2, chunkSize = 3e3, overlap = 300) {
  const chunks = [];
  let start = 0;
  while (start < text2.length) {
    chunks.push(text2.slice(start, start + chunkSize));
    start += chunkSize - overlap;
    if (start + overlap >= text2.length) break;
  }
  if (chunks.length === 0 || text2.length > (chunks[chunks.length - 1]?.length ?? 0)) {
    const lastStart = Math.max(0, text2.length - chunkSize);
    const lastChunk = text2.slice(lastStart);
    if (!chunks.includes(lastChunk)) chunks.push(lastChunk);
  }
  return chunks;
}
function selectRelevantChunks(planText, regulationText, topK = 5, chunkSize = 3e3, overlap = 300) {
  const planTokens = tokenise(planText.slice(0, 8e3));
  const planTF = buildTF(planTokens);
  const chunks = chunkText(regulationText, chunkSize, overlap);
  const scored = chunks.map((text2, chunkIndex) => {
    const tokens = tokenise(text2);
    const tf = buildTF(tokens);
    const score = overlapScore(planTF, tf);
    return { text: text2, score, chunkIndex };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
function buildRelevantExcerpt(planText, regulationText, topK = 5, chunkSize = 3e3, overlap = 300) {
  const relevant = selectRelevantChunks(planText, regulationText, topK, chunkSize, overlap);
  relevant.sort((a, b) => a.chunkIndex - b.chunkIndex);
  return relevant.map((c) => c.text).join("\n\n---\n\n");
}

// server/auditLog.ts
init_db();
init_schema();
async function auditLog(entry) {
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
      ipAddress: entry.ipAddress ?? null
    });
  } catch (err) {
    console.warn("[AuditLog] Failed to write entry:", err);
  }
}

// server/analysisQueue.ts
var MAX_RETRIES = 3;
var BASE_DELAY_MS = 2e3;
var jobs = /* @__PURE__ */ new Map();
function enqueueAnalysis(analysisId) {
  const existing = jobs.get(analysisId);
  if (existing && (existing.status === "pending" || existing.status === "running")) {
    return existing;
  }
  const job = {
    id: analysisId,
    status: "pending",
    retryCount: 0
  };
  jobs.set(analysisId, job);
  return job;
}
async function runWithRetry(analysisId, processor, onStatusChange) {
  const job = jobs.get(analysisId) ?? enqueueAnalysis(analysisId);
  job.status = "running";
  job.startedAt = /* @__PURE__ */ new Date();
  onStatusChange?.("running");
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await processor();
      job.status = "completed";
      job.completedAt = /* @__PURE__ */ new Date();
      onStatusChange?.("completed");
      return;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      job.lastError = errorMsg;
      job.retryCount = attempt + 1;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[Queue] Analysis ${analysisId} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms: ${errorMsg}`
        );
        await sleep(delay);
      } else {
        job.status = "failed";
        job.completedAt = /* @__PURE__ */ new Date();
        onStatusChange?.("failed", errorMsg);
        throw err;
      }
    }
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// server/notifications.ts
init_db();
init_schema();
async function createNotification(input) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(notifications).values({
      userId: input.userId,
      eventType: input.eventType,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null
    });
    if (input.email) {
      void sendEmail({
        to: input.email,
        subject: `[Compliance Checker] ${input.title}`,
        body: input.body ?? input.title,
        link: input.link
      }).catch((err) => {
        console.warn("[notifications.sendEmail] failed:", err);
      });
    }
  } catch (err) {
    console.warn("[notifications.create] error:", err);
  }
}
async function sendEmail(payload) {
  if (!process.env.SMTP_HOST) {
    return;
  }
  console.info("[notifications.sendEmail] would send:", payload.to, payload.subject);
}

// server/routers/compliance.ts
function isLikelyScanned(text2, fileSize) {
  const textDensity = text2.length / Math.max(fileSize, 1);
  return textDensity < 0.01 && text2.length < 500;
}
async function ocrPdf(buffer) {
  try {
    const Tesseract = __require("tesseract.js");
    const { data } = await Tesseract.recognize(buffer, "hun+eng", {
      logger: () => {
      }
      // suppress progress logs
    });
    return { text: data.text, used: true };
  } catch {
    return { text: "", used: false };
  }
}
async function extractTextFromPdf(buffer) {
  try {
    const { extractFromPdf: extractFromPdf2 } = await Promise.resolve().then(() => (init_documentExtractor(), documentExtractor_exports));
    const text2 = await extractFromPdf2(buffer);
    if (isLikelyScanned(text2, buffer.length)) {
      const ocr = await ocrPdf(buffer);
      if (ocr.used && ocr.text.length > text2.length) {
        return {
          text: ocr.text,
          ocrUsed: true,
          qualityWarning: "A dokumentum szkennelt PDF-nek t\u0171nik. Az OCR feldolgoz\xE1s pontoss\xE1ga korl\xE1tozott lehet."
        };
      }
      return {
        text: text2 || ocr.text,
        ocrUsed: ocr.used,
        qualityWarning: text2.length < 200 ? "A dokumentumb\xF3l kev\xE9s sz\xF6veg nyerhet\u0151 ki. Az elemz\xE9s pontoss\xE1ga korl\xE1tozott lehet." : void 0
      };
    }
    return { text: text2, ocrUsed: false };
  } catch {
    return {
      text: buffer.toString("latin1").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s{3,}/g, "\n").slice(0, 5e4),
      ocrUsed: false,
      qualityWarning: "PDF feldolgoz\xE1si hiba \u2013 sz\xF6veg r\xE9szlegesen kinyerve."
    };
  }
}
async function extractTextFromDocument(buffer, filename) {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (["pdf"].includes(ext)) {
    return extractTextFromPdf(buffer);
  }
  try {
    const { extractDocumentText: extractDocumentText2 } = await Promise.resolve().then(() => (init_documentExtractor(), documentExtractor_exports));
    const result = await extractDocumentText2(buffer, filename);
    return { text: result.text, ocrUsed: false };
  } catch {
    return { text: buffer.toString("utf8").slice(0, 5e4), ocrUsed: false };
  }
}
async function runComplianceAnalysis(planText, regulationText, planName, regulationNames) {
  const planExcerpt = planText.slice(0, 6e3);
  const regulationExcerpt = buildRelevantExcerpt(planText, regulationText, 5, 3500, 350);
  const systemPrompt = `Te egy tapasztalt m\xE9rn\xF6ki tervmegfelel\u0151s\xE9g-ellen\u0151rz\u0151 AI rendszer vagy.
Feladatod: \xF6sszehasonl\xEDtani egy tervdokumentumot a vonatkoz\xF3 jogszab\xE1lyokkal/szabv\xE1nyokkal,
\xE9s struktur\xE1lt, bizony\xEDt\xE9k-alap\xFA megfelel\u0151s\xE9gi \xE9rt\xE9kel\xE9st adni.

Minden ellen\u0151rz\xE9si ponthoz add meg:
- id: egyedi azonos\xEDt\xF3 (pl. "finding-001")
- title: r\xF6vid, egy\xE9rtelm\u0171 c\xEDm (max 80 karakter)
- description: mit vizsg\xE1lt\xE1l (1-2 mondat)
- status: "megfelel", "reszben_megfelel", "bizonytalan", vagy "nem_felel_meg"
- severity: "kritikus", "kozepes", vagy "alacsony" (csak ha status nem "megfelel")
- confidence: 0-100 k\xF6z\xF6tti eg\xE9sz sz\xE1m (mennyire biztos az \xE9rt\xE9kel\xE9s)
- justification: r\xE9szletes indokl\xE1s (2-4 mondat)
- regulationExcerpt: sz\xF3 szerinti id\xE9zet a jogszab\xE1lyb\xF3l/szabv\xE1nyb\xF3l (max 200 karakter)
- planExcerpt: sz\xF3 szerinti id\xE9zet a tervdokumentumb\xF3l (max 200 karakter), ha relev\xE1ns
- reference: konkr\xE9t szab\xE1lyhivatkoz\xE1s (pl. "MSZ EN 1990:2005 3.1 fejezet")
- category: kateg\xF3ria (pl. "Teherb\xEDr\xE1s", "T\u0171zv\xE9delem", "Anyagmin\u0151s\xE9g", "Geometria", "Dokument\xE1ci\xF3")
- nextStep: aj\xE1nlott k\xF6vetkez\u0151 l\xE9p\xE9s (1 mondat), ha status nem "megfelel"
- uncertaintyReason: a bizonytalans\xE1g oka (1 mondat), ha status "bizonytalan"

Legy\xE9l prec\xEDz, szakmai \xE9s objekt\xEDv. Ha az inform\xE1ci\xF3 nem elegend\u0151, jel\xF6ld "bizonytalan"-k\xE9nt.
Minimum 5, maximum 15 ellen\u0151rz\xE9si pontot adj meg.`;
  const userPrompt = `TERVDOKUMENTUM (${planName}):
${planExcerpt}

JOGSZAB\xC1LYOK/SZABV\xC1NYOK (${regulationNames.join(", ")}):
${regulationExcerpt}

V\xE9gezd el a megfelel\u0151s\xE9g-ellen\u0151rz\xE9st \xE9s adj struktur\xE1lt JSON v\xE1laszt.`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "compliance_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  status: { type: "string", enum: ["megfelel", "reszben_megfelel", "bizonytalan", "nem_felel_meg"] },
                  severity: { type: "string", enum: ["kritikus", "kozepes", "alacsony"] },
                  confidence: { type: "integer" },
                  justification: { type: "string" },
                  regulationExcerpt: { type: "string" },
                  planExcerpt: { type: "string" },
                  reference: { type: "string" },
                  category: { type: "string" },
                  nextStep: { type: "string" },
                  uncertaintyReason: { type: "string" }
                },
                required: ["id", "title", "description", "status", "severity", "confidence", "justification", "regulationExcerpt", "planExcerpt", "reference", "category", "nextStep", "uncertaintyReason"],
                additionalProperties: false
              }
            },
            summary: { type: "string" }
          },
          required: ["results", "summary"],
          additionalProperties: false
        }
      }
    }
  });
  const rawContent = response.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error("LLM did not return a response");
  const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
  const parsed = JSON.parse(content);
  const results = parsed.results.map((r) => ({
    ...r,
    workflowStatus: "nyitott",
    severity: r.severity ?? "alacsony",
    confidence: typeof r.confidence === "number" ? r.confidence : 50
  }));
  return { results, summary: parsed.summary };
}
var complianceRouter = router({
  /**
   * Upload a document to S3 and return its key and URL.
   */
  uploadDocument: publicProcedure.input(
    z.object({
      filename: z.string(),
      contentType: z.string().default("application/pdf"),
      base64: z.string()
    })
  ).mutation(async ({ input, ctx }) => {
    const buffer = Buffer.from(input.base64, "base64");
    const key = `compliance-docs/${nanoid()}-${input.filename}`;
    const { url } = await storagePut(key, buffer, input.contentType);
    await auditLog({
      userId: ctx.user?.id,
      userEmail: ctx.user?.email ?? void 0,
      eventType: "document_upload",
      resourceType: "document",
      resourceId: key,
      description: `Dokumentum felt\xF6ltve: ${input.filename}`,
      metadata: { filename: input.filename, contentType: input.contentType, size: buffer.length }
    });
    return { key, url };
  }),
  /**
   * Start a new compliance analysis with queue + retry support.
   */
  startAnalysis: publicProcedure.input(
    z.object({
      title: z.string().min(1).max(255),
      projectId: z.number().optional(),
      planDocument: z.object({
        key: z.string(),
        name: z.string(),
        base64: z.string()
      }),
      regulationDocuments: z.array(
        z.object({
          key: z.string().optional(),
          name: z.string(),
          base64: z.string(),
          sourceId: z.number().optional()
        })
      ).min(0).default([]),
      planDocumentNames: z.array(z.string()).optional(),
      regulationSourceIds: z.array(z.number()).optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const allRegNames = input.regulationDocuments.filter((d) => !d.name.startsWith("__lib_source_")).map((d) => d.name);
    const analysisId = await createAnalysis({
      title: input.title,
      status: "processing",
      projectId: input.projectId ?? null,
      userId: ctx.user?.id ?? null,
      planDocuments: (input.planDocumentNames ?? [input.planDocument.name]).map((name) => ({
        key: "",
        name,
        fileType: "pdf"
      })),
      regulationDocumentNames: allRegNames,
      regulationSourceIds: input.regulationSourceIds ?? []
    });
    await auditLog({
      userId: ctx.user?.id,
      userEmail: ctx.user?.email ?? void 0,
      eventType: "analysis_start",
      resourceType: "analysis",
      resourceId: analysisId,
      description: `Elemz\xE9s ind\xEDtva: ${input.title}`,
      metadata: { title: input.title, projectId: input.projectId, regulationCount: allRegNames.length }
    });
    runWithRetry(
      analysisId,
      () => processAnalysis(analysisId, input),
      async (status, error) => {
        if (status === "failed") {
          await auditLog({
            userId: ctx.user?.id,
            userEmail: ctx.user?.email ?? void 0,
            eventType: "analysis_error",
            resourceType: "analysis",
            resourceId: analysisId,
            description: `Elemz\xE9s sikertelen: ${error}`
          });
          if (ctx.user?.id) {
            await createNotification({
              userId: ctx.user.id,
              eventType: "analysis_error",
              title: `Elemz\xE9s sikertelen: ${input.title}`,
              body: error ? `Hiba: ${error}` : "Az elemz\xE9s feldolgoz\xE1sa hib\xE1val v\xE9gz\u0151d\xF6tt.",
              link: `/result/${analysisId}`,
              email: ctx.user.email ?? void 0
            });
          }
        } else if (status === "completed") {
          await auditLog({
            userId: ctx.user?.id,
            userEmail: ctx.user?.email ?? void 0,
            eventType: "analysis_complete",
            resourceType: "analysis",
            resourceId: analysisId,
            description: `Elemz\xE9s k\xE9sz: ${input.title}`
          });
          if (ctx.user?.id) {
            await createNotification({
              userId: ctx.user.id,
              eventType: "analysis_complete",
              title: `Elemz\xE9sed elk\xE9sz\xFClt: ${input.title}`,
              body: "Az AI-megfelel\u0151s\xE9g-ellen\u0151rz\xE9s lefutott. Kattints a riport megtekint\xE9s\xE9hez.",
              link: `/result/${analysisId}`,
              email: ctx.user.email ?? void 0
            });
          }
        }
      }
    ).catch((err) => {
      console.error(`[Analysis ${analysisId}] Failed after retries:`, err);
      updateAnalysisStatus(analysisId, "error", {
        errorMessage: err instanceof Error ? err.message : String(err)
      });
    });
    return { analysisId };
  }),
  /**
   * Get the status and results of an analysis.
   */
  getAnalysis: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const analysis = await getAnalysisById(input.id);
    if (!analysis) {
      throw new TRPCError2({ code: "NOT_FOUND", message: "Elemz\xE9s nem tal\xE1lhat\xF3" });
    }
    return analysis;
  }),
  /**
   * List analyses (most recent first). Optionally filtered by project.
   */
  listAnalyses: publicProcedure.input(z.object({ projectId: z.number().int().positive().optional() }).optional()).query(async ({ input }) => {
    return listAnalyses(input?.projectId ? { projectId: input.projectId } : void 0);
  }),
  /**
   * Update the workflow status of an analysis.
   */
  updateWorkflowStatus: publicProcedure.input(z.object({
    id: z.number(),
    workflowStatus: z.enum(["uj", "elemzes_alatt", "ai_eloelenorizve", "ember_felulvizsgalva", "javitasra_visszakuldve", "lezart"])
  })).mutation(async ({ input, ctx }) => {
    const { getDb: _getDb } = await Promise.resolve().then(() => (init_db(), db_exports));
    const db = await _getDb();
    if (!db) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151" });
    const { analyses: analyses2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq12 } = await import("drizzle-orm");
    await db.update(analyses2).set({ workflowStatus: input.workflowStatus }).where(eq12(analyses2.id, input.id));
    await auditLog({
      userId: ctx.user?.id,
      userEmail: ctx.user?.email ?? void 0,
      eventType: "workflow_status_change",
      resourceType: "analysis",
      resourceId: input.id,
      description: `Workflow st\xE1tusz m\xF3dos\xEDtva: ${input.workflowStatus}`
    });
    return { success: true };
  }),
  /**
   * Update the workflow status of a single finding within an analysis.
   */
  updateFindingStatus: publicProcedure.input(z.object({
    analysisId: z.number(),
    findingId: z.string(),
    workflowStatus: z.enum(["nyitott", "ellenorzes_alatt", "elfogadva", "elutasitva", "javitva", "lezarva"]),
    reviewNote: z.string().optional(),
    assignedTo: z.string().optional()
  })).mutation(async ({ input, ctx }) => {
    const analysis = await getAnalysisById(input.analysisId);
    if (!analysis) throw new TRPCError2({ code: "NOT_FOUND", message: "Elemz\xE9s nem tal\xE1lhat\xF3" });
    const results = analysis.results ?? [];
    const updated = results.map(
      (r) => r.id === input.findingId ? {
        ...r,
        workflowStatus: input.workflowStatus,
        reviewNote: input.reviewNote ?? r.reviewNote,
        assignedTo: input.assignedTo ?? r.assignedTo
      } : r
    );
    const db = await (await Promise.resolve().then(() => (init_db(), db_exports))).getDb();
    if (!db) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR" });
    const { analyses: analyses2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq12 } = await import("drizzle-orm");
    await db.update(analyses2).set({ results: updated }).where(eq12(analyses2.id, input.analysisId));
    await auditLog({
      userId: ctx.user?.id,
      userEmail: ctx.user?.email ?? void 0,
      eventType: "finding_status_change",
      resourceType: "analysis",
      resourceId: input.analysisId,
      description: `Finding st\xE1tusz m\xF3dos\xEDtva: ${input.findingId} \u2192 ${input.workflowStatus}`
    });
    return { success: true };
  })
});
async function processAnalysis(analysisId, input) {
  await updateAnalysisStatus(analysisId, "processing", { progressStep: "Tervdokumentum feldolgoz\xE1sa..." });
  const planBuffer = Buffer.from(input.planDocument.base64, "base64");
  const planExtraction = await extractTextFromDocument(planBuffer, input.planDocument.name);
  const planText = planExtraction.text;
  await updateAnalysisStatus(analysisId, "processing", { progressStep: "Jogszab\xE1lyok feldolgoz\xE1sa..." });
  const regulationTexts = [];
  const regulationNames = [];
  for (const doc of input.regulationDocuments) {
    if (doc.name.startsWith("__lib_source_")) continue;
    if (!doc.base64) continue;
    const buf = Buffer.from(doc.base64, "base64");
    const extraction = await extractTextFromDocument(buf, doc.name);
    regulationTexts.push(`=== ${doc.name} ===
${extraction.text}`);
    regulationNames.push(doc.name);
  }
  if (input.regulationSourceIds && input.regulationSourceIds.length > 0) {
    try {
      const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const { regulationSources: regulationSources2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { inArray: inArray3 } = await import("drizzle-orm");
      const db = await getDb2();
      if (db) {
        const sources = await db.select().from(regulationSources2).where(inArray3(regulationSources2.id, input.regulationSourceIds));
        for (const src of sources) {
          if (src.content) {
            regulationTexts.push(`=== ${src.name} ===
${src.content}`);
            regulationNames.push(src.name);
          } else if (["njt", "netjogtar", "url"].includes(src.sourceType) && src.sourceUrl) {
            try {
              const { fetchRegulationText: fetchRegulationText2 } = await Promise.resolve().then(() => (init_regulationScraper(), regulationScraper_exports));
              const fetched = await fetchRegulationText2(src.sourceType, src.sourceUrl);
              if (fetched.text) {
                regulationTexts.push(`=== ${src.name} ===
${fetched.text}`);
                regulationNames.push(src.name);
              }
            } catch {
            }
          }
        }
      }
    } catch {
    }
  }
  if (regulationTexts.length === 0) {
    regulationTexts.push("Nincs jogszab\xE1ly megadva \u2013 \xE1ltal\xE1nos megfelel\u0151s\xE9g-ellen\u0151rz\xE9s.");
    regulationNames.push("\xC1ltal\xE1nos");
  }
  const combinedRegulationText = regulationTexts.join("\n\n");
  await updateAnalysisStatus(analysisId, "processing", { progressStep: "AI elemz\xE9s futtat\xE1sa..." });
  const { results, summary } = await runComplianceAnalysis(
    planText,
    combinedRegulationText,
    input.planDocument.name,
    regulationNames
  );
  await updateAnalysisStatus(analysisId, "completed", {
    results,
    summary,
    progressStep: "K\xE9sz"
  });
}

// server/routers/pdfExport.ts
import { z as z2 } from "zod";
init_db();
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/pdfReport.ts
import PDFDocument from "pdfkit";
var BRAND_STEEL = "#7CA9D3";
var BRAND_DARK = "#161718";
var STATUS_COLORS = {
  megfelel: { text: "#16a34a", bg: "#f0fdf4" },
  bizonytalan: { text: "#ca8a04", bg: "#fefce8" },
  nem_felel_meg: { text: "#dc2626", bg: "#fef2f2" },
  reszben_megfelel: { text: "#ea580c", bg: "#fff7ed" }
};
var STATUS_LABELS = {
  megfelel: "MEGFELEL",
  bizonytalan: "BIZONYTALAN",
  nem_felel_meg: "NEM FELEL MEG",
  reszben_megfelel: "R\xC9SZBEN MEGFELEL"
};
function generatePdfReport(analysis) {
  return new Promise((resolve, reject) => {
    const results = analysis.results || [];
    const pass = results.filter((r) => r.status === "megfelel").length;
    const uncertain = results.filter((r) => r.status === "bizonytalan").length;
    const fail = results.filter((r) => r.status === "nem_felel_meg").length;
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `Megfelel\u0151s\xE9gi Riport \u2013 ${analysis.title}`,
        Author: "M M\xE9rn\xF6ki Iroda Kft.",
        Subject: "Tervmegfelel\u0151s\xE9g-ellen\u0151rz\xE9s"
      }
    });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
    const pageWidth = doc.page.width - 120;
    doc.rect(0, 0, doc.page.width, 80).fill(BRAND_DARK);
    doc.fillColor("white").fontSize(18).font("Helvetica-Bold").text("M M\xE9rn\xF6ki Iroda Kft.", 60, 22);
    doc.fillColor(BRAND_STEEL).fontSize(9).font("Helvetica").text("TERVMEGFELEL\u0150S\xC9G-ELLEN\u0150RZ\u0150 RENDSZER", 60, 46, { characterSpacing: 1.5 });
    doc.fillColor("white").fontSize(8).text(
      (/* @__PURE__ */ new Date()).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" }),
      0,
      32,
      { align: "right", width: doc.page.width - 60 }
    );
    doc.moveDown(3);
    doc.fillColor(BRAND_DARK).fontSize(20).font("Helvetica-Bold").text("MEGFELEL\u0150S\xC9GI RIPORT", 60, 110);
    doc.rect(60, 135, 60, 3).fill(BRAND_STEEL);
    doc.moveDown(0.5);
    doc.fillColor("#374151").fontSize(13).font("Helvetica-Bold").text(analysis.title, 60, 148);
    doc.fillColor("#6b7280").fontSize(9).font("Helvetica").text(
      `Tervdokumentum: ${analysis.planDocuments?.[0]?.name || "\u2013"}   \xB7   Elemz\xE9s d\xE1tuma: ${new Date(analysis.createdAt).toLocaleDateString("hu-HU")}`,
      60,
      170
    );
    doc.moveDown(2);
    const statsY = 200;
    const boxW = (pageWidth - 20) / 3;
    const statsData = [
      { label: "Megfelel", value: pass, color: "#16a34a" },
      { label: "Bizonytalan", value: uncertain, color: "#ca8a04" },
      { label: "Nem felel meg", value: fail, color: "#dc2626" }
    ];
    statsData.forEach(({ label, value, color }, i) => {
      const x = 60 + i * (boxW + 10);
      doc.rect(x, statsY, boxW, 60).fillAndStroke("#f9fafb", "#e5e7eb");
      doc.fillColor(color).fontSize(28).font("Helvetica-Bold").text(String(value), x, statsY + 8, { width: boxW, align: "center" });
      doc.fillColor(color).fontSize(9).font("Helvetica").text(label.toUpperCase(), x, statsY + 40, { width: boxW, align: "center" });
    });
    doc.moveDown(1);
    if (analysis.summary) {
      const summaryY = statsY + 80;
      doc.rect(60, summaryY, pageWidth, 1).fill(BRAND_STEEL);
      doc.fillColor(BRAND_DARK).fontSize(10).font("Helvetica-Bold").text("\xD6SSZEFOGLAL\xD3 \xC9RT\xC9KEL\xC9S", 60, summaryY + 10);
      doc.fillColor("#374151").fontSize(9.5).font("Helvetica").text(analysis.summary, 60, summaryY + 26, { width: pageWidth, lineGap: 3 });
      doc.y = summaryY + 26 + doc.heightOfString(analysis.summary, { width: pageWidth }) + 20;
    } else {
      doc.y = statsY + 80;
    }
    doc.rect(60, doc.y, pageWidth, 1).fill(BRAND_STEEL);
    doc.y += 12;
    doc.fillColor(BRAND_DARK).fontSize(10).font("Helvetica-Bold").text("ELLEN\u0150RZ\xC9SI PONTOK", 60, doc.y);
    doc.y += 18;
    results.forEach((result, idx) => {
      const cfg = STATUS_COLORS[result.status];
      const label = STATUS_LABELS[result.status];
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
        doc.y = 60;
      }
      const cardY = doc.y;
      doc.fontSize(10);
      const titleHeight = doc.heightOfString(result.title, { width: pageWidth - 100 });
      doc.fontSize(8.5);
      const descHeight = doc.heightOfString(result.description, { width: pageWidth - 20 });
      const justHeight = doc.heightOfString(result.justification, { width: pageWidth - 20 });
      const cardHeight = titleHeight + descHeight + justHeight + 80;
      doc.rect(60, cardY, pageWidth, cardHeight).fillAndStroke("white", "#e5e7eb");
      const barColor = result.status === "megfelel" ? "#16a34a" : result.status === "bizonytalan" ? "#ca8a04" : "#dc2626";
      doc.rect(60, cardY, 4, cardHeight).fill(barColor);
      const badgeX = doc.page.width - 60 - 90;
      doc.rect(badgeX, cardY + 10, 90, 18).fill(cfg.text);
      doc.fillColor("white").fontSize(7.5).font("Helvetica-Bold").text(label, badgeX, cardY + 14, { width: 90, align: "center", characterSpacing: 0.3 });
      doc.fillColor(BRAND_DARK).fontSize(10).font("Helvetica-Bold").text(result.title, 72, cardY + 12, { width: pageWidth - 110 });
      doc.fillColor("#6b7280").fontSize(8.5).font("Helvetica").text(result.description, 72, cardY + 14 + titleHeight + 4, { width: pageWidth - 20 });
      const sepY = cardY + 14 + titleHeight + 4 + descHeight + 8;
      doc.rect(72, sepY, pageWidth - 20, 0.5).fill("#e5e7eb");
      doc.fillColor("#9ca3af").fontSize(7.5).font("Helvetica-Bold").text("INDOKL\xC1S", 72, sepY + 8, { characterSpacing: 0.8 });
      doc.fillColor("#374151").fontSize(8.5).font("Helvetica").text(result.justification, 72, sepY + 20, { width: pageWidth - 20 });
      const refY = sepY + 20 + justHeight + 6;
      doc.fillColor("#9ca3af").fontSize(7.5).font("Helvetica-Bold").text("HIVATKOZ\xC1S: ", 72, refY, { continued: true, characterSpacing: 0.8 });
      doc.fillColor(BRAND_STEEL).fontSize(8).font("Helvetica").text(result.reference, { characterSpacing: 0 });
      doc.y = cardY + cardHeight + 8;
    });
    const footerY = doc.page.height - 50;
    doc.rect(0, footerY, doc.page.width, 50).fill(BRAND_DARK);
    doc.fillColor("#9ca3af").fontSize(8).font("Helvetica").text(
      `M M\xE9rn\xF6ki Iroda Kft. \xB7 Tervmegfelel\u0151s\xE9g-ellen\u0151rz\u0151 Pilot \xB7 ${(/* @__PURE__ */ new Date()).toLocaleDateString("hu-HU")}`,
      60,
      footerY + 18,
      { align: "center", width: doc.page.width - 120 }
    );
    doc.end();
  });
}

// server/routers/pdfExport.ts
var pdfExportRouter = router({
  exportPdf: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input, ctx }) => {
    const analysis = await getAnalysisById(input.id);
    if (!analysis) {
      throw new TRPCError3({ code: "NOT_FOUND", message: "Elemz\xE9s nem tal\xE1lhat\xF3" });
    }
    if (analysis.status !== "completed") {
      throw new TRPCError3({ code: "BAD_REQUEST", message: "Az elemz\xE9s m\xE9g nem fejez\u0151d\xF6tt be" });
    }
    const pdfBuffer = await generatePdfReport(analysis);
    const base64 = pdfBuffer.toString("base64");
    const filename = `megfelelesi-riport-${analysis.id}-${Date.now()}.pdf`;
    return { base64, filename };
  })
});

// server/routers/regulationSources.ts
import { z as z3 } from "zod";
init_db();
init_schema();
init_regulationScraper();
import { TRPCError as TRPCError4 } from "@trpc/server";
import { sql, isNull } from "drizzle-orm";
import { and, eq as eq2, asc, inArray } from "drizzle-orm";

// server/embeddings.ts
init_env();
var EMBEDDING_CHUNK_SIZE = 800;
var EMBEDDING_CHUNK_OVERLAP = 100;
var embeddingApiAvailable = null;
async function callEmbeddingApi(input) {
  const cfg = getLlmEmbeddingsConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({ model: cfg.model, input }),
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) {
      return null;
    }
    const json2 = await res.json();
    const vec = json2.data?.[0]?.embedding;
    return Array.isArray(vec) && vec.length > 0 ? vec : null;
  } catch {
    return null;
  }
}
async function callEmbeddingApiBatch(inputs, attempt = 1) {
  const cfg = getLlmEmbeddingsConfig();
  if (!cfg) return inputs.map(() => null);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, input: inputs }),
      signal: AbortSignal.timeout(6e4)
    });
    if (!res.ok) throw new Error(`embed ${res.status}`);
    const json2 = await res.json();
    const byIndex = /* @__PURE__ */ new Map();
    for (const d of json2.data ?? []) {
      if (typeof d.index === "number" && Array.isArray(d.embedding) && d.embedding.length > 0) {
        byIndex.set(d.index, d.embedding);
      }
    }
    return inputs.map((_, i) => byIndex.get(i) ?? null);
  } catch {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1e3 * 2 ** (attempt - 1)));
      return callEmbeddingApiBatch(inputs, attempt + 1);
    }
    return inputs.map(() => null);
  }
}
async function getEmbedding(text2) {
  if (embeddingApiAvailable === false) return null;
  const trimmed = text2.trim();
  if (trimmed.length === 0) return null;
  const vec = await callEmbeddingApi(trimmed);
  if (vec) {
    embeddingApiAvailable = true;
    return vec;
  }
  embeddingApiAvailable = false;
  return null;
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
async function chunkAndEmbed(text2, chunkSize = EMBEDDING_CHUNK_SIZE, overlap = EMBEDDING_CHUNK_OVERLAP) {
  if (embeddingApiAvailable === false) return [];
  const chunks = chunkText(text2, chunkSize, overlap).filter((c) => c.trim().length > 0);
  if (chunks.length === 0) return [];
  const BATCH = 50;
  const result = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vecs = await callEmbeddingApiBatch(slice);
    slice.forEach((chunk, j) => {
      const vec = vecs[j];
      if (vec) result.push({ chunkIndex: i + j, text: chunk, embedding: vec });
    });
  }
  embeddingApiAvailable = result.length > 0;
  return result;
}

// server/routers/regulationSources.ts
var disciplineEnum = z3.enum([
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
  "egyeb"
]);
var sourceTypeEnum = z3.enum(["njt", "netjogtar", "eurlex", "mszt", "jogtar", "epitesijog", "pdf", "url"]);
var regulationSourcesRouter = router({
  /**
   * List regulation sources. Soft-deleted ones are excluded by default;
   * pass `includeDeleted: true` to include them (e.g. for a "Restore" UI).
   */
  list: publicProcedure.input(z3.object({ includeDeleted: z3.boolean().default(false) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const includeDeleted = input?.includeDeleted ?? false;
    const query = db.select().from(regulationSources);
    try {
      const rows = includeDeleted ? await query.orderBy(asc(regulationSources.discipline), asc(regulationSources.name)) : await query.where(isNull(regulationSources.deletedAt)).orderBy(asc(regulationSources.discipline), asc(regulationSources.name));
      return rows;
    } catch (err) {
      console.warn("[regulationSources.list] deletedAt column missing? Falling back to unfiltered:", err);
      return db.select().from(regulationSources).orderBy(asc(regulationSources.discipline), asc(regulationSources.name));
    }
  }),
  /**
   * Per-source chunk-embedding counts. Used by RegulationLibraryPage to show
   * a "X chunk embedding" badge next to each source. Returns an empty array
   * if the chunk_embeddings table doesn't exist yet (db:push not run on this
   * environment) so the UI can render gracefully without semantic-search data.
   */
  getEmbeddingCounts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    try {
      const rows = await db.select({
        sourceId: chunkEmbeddings.sourceId,
        chunkCount: sql`count(*)`
      }).from(chunkEmbeddings).where(eq2(chunkEmbeddings.sourceType, "regulation")).groupBy(chunkEmbeddings.sourceId);
      return rows.map((r) => ({ sourceId: r.sourceId, chunkCount: Number(r.chunkCount) }));
    } catch (err) {
      console.error("[regulationSources] getEmbeddingCounts skipped:", err);
      return [];
    }
  }),
  /**
   * Get a single regulation source by ID.
   */
  getById: publicProcedure.input(z3.object({ id: z3.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const result = await db.select().from(regulationSources).where(eq2(regulationSources.id, input.id)).limit(1);
    if (!result[0]) throw new TRPCError4({ code: "NOT_FOUND", message: "Jogszab\xE1ly forr\xE1s nem tal\xE1lhat\xF3" });
    return result[0];
  }),
  /**
   * Create a new regulation source.
   */
  create: publicProcedure.input(
    z3.object({
      name: z3.string().min(1).max(512),
      shortCode: z3.string().max(64).optional(),
      discipline: disciplineEnum,
      sourceType: sourceTypeEnum,
      sourceUrl: z3.string().url().optional().or(z3.literal(""))
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const result = await db.insert(regulationSources).values({
      name: input.name,
      shortCode: input.shortCode ?? null,
      discipline: input.discipline,
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl || null,
      isActive: true
    });
    return { id: result[0].insertId };
  }),
  /**
   * PDF feltöltése egy lépésben: szöveg-kinyerés (ékezet-javítással) → forrás
   * létrehozása → AUTOMATIKUS chunk-embedding generálás. Nincs külön gomb.
   *
   * A fájlt base64-ként kapja (az Express body-limit 50mb). A discipline-t a
   * fájlnévből + szövegből detektáljuk, a sourceType "pdf".
   */
  createFromPdf: publicProcedure.input(
    z3.object({
      filename: z3.string().min(1),
      dataBase64: z3.string().min(1)
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const { extractFromPdf: extractFromPdf2, detectDiscipline: detectDiscipline2 } = await Promise.resolve().then(() => (init_documentExtractor(), documentExtractor_exports));
    const buffer = Buffer.from(input.dataBase64, "base64");
    if (buffer.length === 0) {
      return { ok: false, message: "\xDCres vagy \xE9rv\xE9nytelen f\xE1jl." };
    }
    const text2 = await extractFromPdf2(buffer);
    if (!text2 || text2.trim().length < 50) {
      return { ok: false, message: "A PDF-b\u0151l nem siker\xFClt \xE9rdemi sz\xF6veget kinyerni (lehet, hogy szkennelt, k\xE9p alap\xFA dokumentum)." };
    }
    const name = input.filename.replace(/\.pdf$/i, "").trim().slice(0, 512) || "Felt\xF6lt\xF6tt dokumentum";
    const existing = await db.select({ id: regulationSources.id }).from(regulationSources).where(and(eq2(regulationSources.name, name), isNull(regulationSources.deletedAt))).limit(1);
    if (existing.length > 0) {
      return { ok: false, message: `M\xE1r l\xE9tezik ilyen nev\u0171 forr\xE1s: \u201E${name}\u201D.` };
    }
    const shortCode = (name.match(/MSZ\s*E?N?\s*[\d.\-]+/i)?.[0] ?? "").trim().slice(0, 64) || null;
    const discipline = detectDiscipline2(name, text2.slice(0, 2e3));
    const now = /* @__PURE__ */ new Date();
    const result = await db.insert(regulationSources).values({
      name,
      shortCode,
      discipline,
      sourceType: "pdf",
      content: text2.slice(0, 16e6),
      contentFetchedAt: now,
      lastSyncAt: now,
      syncStatus: "ok",
      isActive: true
    });
    const sourceId = result[0].insertId;
    const embedded = await chunkAndEmbed(text2);
    if (embedded.length > 0) {
      await db.insert(chunkEmbeddings).values(
        embedded.map((c) => ({
          sourceType: "regulation",
          sourceId,
          chunkIndex: c.chunkIndex,
          text: c.text.slice(0, 65e3),
          embedding: c.embedding
        }))
      );
    }
    return {
      ok: true,
      sourceId,
      name,
      characterCount: text2.length,
      chunkCount: embedded.length,
      embeddingApiUnavailable: embedded.length === 0
    };
  }),
  /**
   * Update a regulation source.
   */
  update: publicProcedure.input(
    z3.object({
      id: z3.number(),
      name: z3.string().min(1).max(512).optional(),
      shortCode: z3.string().max(64).optional(),
      discipline: disciplineEnum.optional(),
      sourceType: sourceTypeEnum.optional(),
      sourceUrl: z3.string().optional(),
      isActive: z3.boolean().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const { id, ...rest } = input;
    await db.update(regulationSources).set(rest).where(eq2(regulationSources.id, id));
    return { success: true };
  }),
  /**
   * Soft-delete a regulation source (sets deletedAt = now()). The row is
   * preserved (restorable), but listing excludes it by default. Cascades
   * chunk_embeddings cleanup so semantic search doesn't return phantom
   * results — on restore, the user must regenerate embeddings.
   */
  delete: publicProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    try {
      await db.update(regulationSources).set({ deletedAt: /* @__PURE__ */ new Date() }).where(eq2(regulationSources.id, input.id));
    } catch (err) {
      console.warn("[regulationSources.delete] soft-delete path failed, falling back to hard delete:", err);
      await db.delete(regulationSources).where(eq2(regulationSources.id, input.id));
    }
    await db.delete(chunkEmbeddings).where(and(eq2(chunkEmbeddings.sourceType, "regulation"), eq2(chunkEmbeddings.sourceId, input.id)));
    return { success: true };
  }),
  /**
   * Restore a soft-deleted regulation source. The user must regenerate
   * embeddings afterwards if they want semantic search coverage.
   */
  restore: publicProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    await db.update(regulationSources).set({ deletedAt: null }).where(eq2(regulationSources.id, input.id));
    return { success: true };
  }),
  /**
   * Bulk soft-delete (V11.8) — same semantics as `delete`, atomic over many ids.
   * Cascades chunk_embeddings cleanup.
   */
  deleteMany: publicProcedure.input(z3.object({ ids: z3.array(z3.number().int().positive()).min(1).max(500) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const existing = await db.select({ id: regulationSources.id }).from(regulationSources).where(inArray(regulationSources.id, input.ids));
    const existingIds = existing.map((r) => r.id);
    if (existingIds.length === 0) {
      return { deletedCount: 0, requestedCount: input.ids.length };
    }
    try {
      await db.update(regulationSources).set({ deletedAt: /* @__PURE__ */ new Date() }).where(inArray(regulationSources.id, existingIds));
    } catch (err) {
      console.warn("[regulationSources.deleteMany] soft-delete fallback to hard:", err);
      await db.delete(regulationSources).where(inArray(regulationSources.id, existingIds));
    }
    await db.delete(chunkEmbeddings).where(
      and(
        eq2(chunkEmbeddings.sourceType, "regulation"),
        inArray(chunkEmbeddings.sourceId, existingIds)
      )
    );
    return { deletedCount: existingIds.length, requestedCount: input.ids.length };
  }),
  /**
   * Bulk restore (V11.8) — sets deletedAt = null for every id in the batch.
   */
  restoreMany: publicProcedure.input(z3.object({ ids: z3.array(z3.number().int().positive()).min(1).max(500) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    await db.update(regulationSources).set({ deletedAt: null }).where(inArray(regulationSources.id, input.ids));
    return { restoredCount: input.ids.length };
  }),
  /**
   * Permanently delete a regulation source (physical row removal). Use with
   * care — there's no recovery. Intended for an admin "empty trash" flow.
   */
  permanentDelete: publicProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    await db.delete(regulationSources).where(eq2(regulationSources.id, input.id));
    await db.delete(chunkEmbeddings).where(and(eq2(chunkEmbeddings.sourceType, "regulation"), eq2(chunkEmbeddings.sourceId, input.id)));
    return { success: true };
  }),
  /**
   * Fetch and cache the regulation text from the source URL.
   * For paid platforms, credentials must be provided separately.
   */
  fetchContent: publicProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const rows = await db.select().from(regulationSources).where(eq2(regulationSources.id, input.id)).limit(1);
    const source = rows[0];
    if (!source) throw new TRPCError4({ code: "NOT_FOUND", message: "Jogszab\xE1ly forr\xE1s nem tal\xE1lhat\xF3" });
    if (!source.sourceUrl) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "Nincs URL megadva ehhez a forr\xE1shoz" });
    }
    let credentials;
    if (["mszt", "jogtar", "epitesijog"].includes(source.sourceType)) {
      const { platformCredentials: platformCredentials2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { decryptPassword: decryptPassword2 } = await Promise.resolve().then(() => (init_regulationScraper(), regulationScraper_exports));
      const credRows = await db.select().from(platformCredentials2).where(eq2(platformCredentials2.platform, source.sourceType)).limit(1);
      const cred = credRows[0];
      if (cred?.username && cred?.encryptedPassword) {
        credentials = {
          username: cred.username,
          password: decryptPassword2(cred.encryptedPassword)
        };
      }
    }
    const result = await fetchRegulationText(source.sourceType, source.sourceUrl, credentials);
    const succeeded = !result.warning && result.text.length > 0;
    await db.update(regulationSources).set({
      content: result.text.slice(0, 16e6),
      // mediumtext limit
      contentFetchedAt: result.fetchedAt,
      lastSyncAt: result.fetchedAt,
      syncStatus: succeeded ? "ok" : "error",
      lastSyncError: succeeded ? null : result.warning ?? null
    }).where(eq2(regulationSources.id, input.id));
    return {
      success: succeeded,
      characterCount: result.text.length,
      warning: result.warning,
      fetchedAt: result.fetchedAt
    };
  }),
  /**
   * Refresh all sources whose lastSyncAt is older than `olderThanDays` (default 30)
   * or null. Sequential, best-effort: failures are logged but the loop continues.
   * Designed to be called from a Manus scheduled task or a manual "Frissítés mind"
   * UI button. NJT/netjogtar/eurlex/url sources don't need credentials; the rest
   * are skipped if no credential is configured.
   */
  refreshAllStale: publicProcedure.input(z3.object({ olderThanDays: z3.number().int().min(0).max(365).default(30) }).optional()).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const olderThanDays = input?.olderThanDays ?? 30;
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1e3);
    const all = await db.select().from(regulationSources);
    const stale = all.filter((s) => {
      if (!s.sourceUrl) return false;
      if (!s.isActive) return false;
      const last = s.lastSyncAt ?? s.contentFetchedAt;
      return last == null || last < cutoff;
    });
    const { platformCredentials: platformCredentials2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { decryptPassword: decryptPassword2 } = await Promise.resolve().then(() => (init_regulationScraper(), regulationScraper_exports));
    let refreshed = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];
    for (const source of stale) {
      try {
        let credentials;
        if (["mszt", "jogtar", "epitesijog"].includes(source.sourceType)) {
          const credRows = await db.select().from(platformCredentials2).where(eq2(platformCredentials2.platform, source.sourceType)).limit(1);
          const cred = credRows[0];
          if (!cred?.username || !cred?.encryptedPassword) {
            skipped++;
            continue;
          }
          credentials = { username: cred.username, password: decryptPassword2(cred.encryptedPassword) };
        }
        const result = await fetchRegulationText(source.sourceType, source.sourceUrl, credentials);
        const succeeded = !result.warning && result.text.length > 0;
        await db.update(regulationSources).set({
          content: result.text.slice(0, 16e6),
          contentFetchedAt: result.fetchedAt,
          lastSyncAt: result.fetchedAt,
          syncStatus: succeeded ? "ok" : "error",
          lastSyncError: succeeded ? null : result.warning ?? null
        }).where(eq2(regulationSources.id, source.id));
        if (succeeded) refreshed++;
        else {
          failed++;
          errors.push({ id: source.id, name: source.name, error: result.warning ?? "ismeretlen" });
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ id: source.id, name: source.name, error: msg });
        await db.update(regulationSources).set({
          syncStatus: "error",
          lastSyncError: msg
        }).where(eq2(regulationSources.id, source.id));
      }
    }
    return { staleCount: stale.length, refreshed, skipped, failed, errors };
  }),
  /**
   * Generate (or regenerate) chunk embeddings for a regulation source.
   * Returns the number of chunks embedded; returns `embeddingApiUnavailable: true`
   * if the embedding API isn't reachable so the UI can surface a hint.
   */
  regenerateEmbeddings: publicProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const rows = await db.select().from(regulationSources).where(eq2(regulationSources.id, input.id)).limit(1);
    const source = rows[0];
    if (!source) throw new TRPCError4({ code: "NOT_FOUND", message: "Jogszab\xE1ly forr\xE1s nem tal\xE1lhat\xF3" });
    if (!source.content || source.content.trim().length === 0) {
      return { chunkCount: 0, embeddingApiUnavailable: false, message: "A forr\xE1snak nincs let\xF6lt\xF6tt sz\xF6vege." };
    }
    const embedded = await chunkAndEmbed(source.content);
    if (embedded.length === 0) {
      return { chunkCount: 0, embeddingApiUnavailable: true, message: "Az embedding API nem \xE9rhet\u0151 el, vagy nincs haszn\xE1lhat\xF3 chunk." };
    }
    await db.delete(chunkEmbeddings).where(and(eq2(chunkEmbeddings.sourceType, "regulation"), eq2(chunkEmbeddings.sourceId, input.id)));
    await db.insert(chunkEmbeddings).values(
      embedded.map((c) => ({
        sourceType: "regulation",
        sourceId: input.id,
        chunkIndex: c.chunkIndex,
        text: c.text.slice(0, 65e3),
        embedding: c.embedding
      }))
    );
    return { chunkCount: embedded.length, embeddingApiUnavailable: false, message: null };
  })
});

// server/routers/platformCredentials.ts
import { z as z4 } from "zod";
init_db();
init_schema();
init_regulationScraper();
import { TRPCError as TRPCError5 } from "@trpc/server";
import { eq as eq3 } from "drizzle-orm";
var platformEnum = z4.enum(["mszt", "jogtar", "epitesijog", "eurlex"]);
var PLATFORM_INFO = {
  mszt: {
    name: "MSZT Online Szabv\xE1nyt\xE1r",
    url: "https://szabvanykonyvtar.mszt.hu",
    description: "Magyar Szabv\xE1ny\xFCgyi Test\xFClet \u2013 MSZ szabv\xE1nyok (Eurocode, stb.)",
    loginUrl: "https://szabvanykonyvtar.mszt.hu/login",
    isFree: false
  },
  jogtar: {
    name: "Jogt\xE1r Premium",
    url: "https://uj.jogtar.hu",
    description: "Wolters Kluwer \u2013 Komment\xE1lt jogszab\xE1lyok, indokl\xE1sok",
    loginUrl: "https://uj.jogtar.hu/login",
    isFree: false
  },
  epitesijog: {
    name: "\xC9p\xEDt\xE9sijog.hu",
    url: "https://epitesijog.hu",
    description: "Komment\xE1lt \xE9p\xEDt\xE9si jog, hat\xF3s\xE1gi elj\xE1r\xE1sok",
    loginUrl: "https://epitesijog.hu/belepes",
    isFree: false
  },
  eurlex: {
    name: "EUR-Lex",
    url: "https://eur-lex.europa.eu",
    description: "Eur\xF3pai Uni\xF3 jogszab\xE1lyai \u2013 ingyenes hozz\xE1f\xE9r\xE9s",
    loginUrl: "https://eur-lex.europa.eu",
    isFree: true
  }
};
var platformCredentialsRouter = router({
  /**
   * Get info about all platforms (without passwords).
   */
  listPlatforms: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const storedCreds = await db.select().from(platformCredentials);
    return Object.entries(PLATFORM_INFO).map(([key, info]) => {
      const stored = storedCreds.find((c) => c.platform === key);
      return {
        platform: key,
        ...info,
        isConfigured: !!stored?.username,
        username: stored?.username ?? null,
        status: stored?.status ?? "untested",
        lastConnectedAt: stored?.lastConnectedAt ?? null,
        lastError: stored?.lastError ?? null,
        credentialId: stored?.id ?? null
      };
    });
  }),
  /**
   * Save or update credentials for a platform.
   * Password is encrypted before storage.
   */
  saveCredentials: publicProcedure.input(
    z4.object({
      platform: platformEnum,
      username: z4.string().min(1),
      password: z4.string().min(1),
      displayName: z4.string().optional()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const encryptedPassword = encryptPassword(input.password);
    const existing = await db.select().from(platformCredentials).where(eq3(platformCredentials.platform, input.platform)).limit(1);
    if (existing[0]) {
      await db.update(platformCredentials).set({
        username: input.username,
        encryptedPassword,
        displayName: input.displayName ?? null,
        status: "untested",
        lastError: null
      }).where(eq3(platformCredentials.platform, input.platform));
    } else {
      await db.insert(platformCredentials).values({
        platform: input.platform,
        username: input.username,
        encryptedPassword,
        displayName: input.displayName ?? null,
        status: "untested"
      });
    }
    return { success: true };
  }),
  /**
   * Delete credentials for a platform.
   */
  deleteCredentials: publicProcedure.input(z4.object({ platform: platformEnum })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    await db.delete(platformCredentials).where(eq3(platformCredentials.platform, input.platform));
    return { success: true };
  }),
  /**
   * Test the connection to a platform using stored credentials.
   */
  testConnection: publicProcedure.input(z4.object({ platform: platformEnum })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
    const rows = await db.select().from(platformCredentials).where(eq3(platformCredentials.platform, input.platform)).limit(1);
    const cred = rows[0];
    if (!cred?.username || !cred?.encryptedPassword) {
      throw new TRPCError5({ code: "BAD_REQUEST", message: "Nincsenek mentett hiteles\xEDt\u0151 adatok ehhez a platformhoz." });
    }
    const { decryptPassword: decryptPassword2 } = await Promise.resolve().then(() => (init_regulationScraper(), regulationScraper_exports));
    const password = decryptPassword2(cred.encryptedPassword);
    let loginResult;
    if (input.platform === "mszt") {
      loginResult = await loginToMszt(cred.username, password);
    } else if (input.platform === "jogtar") {
      loginResult = await loginToJogtar(cred.username, password);
    } else if (input.platform === "epitesijog") {
      loginResult = await loginToEpitesijog(cred.username, password);
    } else {
      loginResult = { success: true };
    }
    await db.update(platformCredentials).set({
      status: loginResult.success ? "connected" : "failed",
      lastConnectedAt: loginResult.success ? /* @__PURE__ */ new Date() : void 0,
      lastError: loginResult.success ? null : loginResult.error ?? "Ismeretlen hiba"
    }).where(eq3(platformCredentials.platform, input.platform));
    return {
      success: loginResult.success,
      error: loginResult.success ? void 0 : loginResult.error
    };
  })
});

// server/routers/standardsSearch.ts
import { z as z5 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
init_db();
init_schema();
import { and as and2, desc as desc3, eq as eq4, like, or, sql as sql2 } from "drizzle-orm";

// server/webSearch.ts
import * as cheerio2 from "cheerio";
var DDG_URL = "https://html.duckduckgo.com/html/";
var MAX_RESULTS = 6;
var FETCH_TIMEOUT_MS = 8e3;
var MAX_CONTENT_CHARS = 3e3;
var TRUSTED_DOMAINS = [
  "njt.hu",
  "net.jogtar.hu",
  "epitesijog.hu",
  "mszt.hu",
  "e-epites.hu",
  "mmk.hu",
  "katasztrofavedelem.hu",
  "mnb.hu",
  "eur-lex.europa.eu",
  "eurocodes.jrc.ec.europa.eu",
  "iso.org",
  "cen.eu"
];
async function searchDuckDuckGo(query) {
  const params = new URLSearchParams({ q: query, kl: "hu-hu" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${DDG_URL}?${params}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      console.warn(`[WebSearch] DuckDuckGo returned ${response.status}`);
      return [];
    }
    const html = await response.text();
    return parseDuckDuckGoResults(html);
  } catch (err) {
    clearTimeout(timeout);
    console.error("[WebSearch] DuckDuckGo fetch error:", err);
    return [];
  }
}
function parseDuckDuckGoResults(html) {
  const $ = cheerio2.load(html);
  const results = [];
  $(".result").each((_, el) => {
    const titleEl = $(el).find(".result__title a");
    const snippetEl = $(el).find(".result__snippet");
    const hrefRaw = titleEl.attr("href") ?? "";
    let url = "";
    try {
      if (hrefRaw.startsWith("/l/")) {
        const u = new URL("https://duckduckgo.com" + hrefRaw);
        url = decodeURIComponent(u.searchParams.get("uddg") ?? "");
      } else if (hrefRaw.startsWith("http")) {
        url = hrefRaw;
      }
    } catch {
      url = hrefRaw;
    }
    const title = titleEl.text().trim();
    const snippet = snippetEl.text().trim();
    if (url && title) {
      results.push({ title, url, snippet });
    }
  });
  return results.slice(0, MAX_RESULTS * 2);
}
async function fetchPageText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0; +https://mmernoki.hu)",
        Accept: "text/html,application/xhtml+xml,text/plain",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/pdf") || contentType.includes("image/") || contentType.includes("application/zip")) {
      return "";
    }
    const html = await response.text();
    return extractTextFromHtml(html, url);
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[WebSearch] Failed to fetch ${url}:`, err.message);
    return "";
  }
}
function extractTextFromHtml(html, _url) {
  const $ = cheerio2.load(html);
  $("script, style, nav, header, footer, .nav, .header, .footer, .menu, .sidebar, .advertisement, .cookie, .gdpr").remove();
  const mainSelectors = ["main", "article", ".content", "#content", ".main-content", "#main", ".article-body", ".entry-content"];
  let text2 = "";
  for (const sel of mainSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      text2 = el.text();
      break;
    }
  }
  if (!text2) {
    text2 = $("body").text();
  }
  return text2.replace(/\t/g, " ").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_CONTENT_CHARS);
}
function scoreResult(result, keywords) {
  let score = 0;
  try {
    const domain = new URL(result.url).hostname.replace("www.", "");
    if (TRUSTED_DOMAINS.some((d) => domain.includes(d))) {
      score += 3;
    }
  } catch {
  }
  const combined = `${result.title} ${result.snippet}`.toLowerCase();
  for (const kw of keywords) {
    if (combined.includes(kw.toLowerCase())) score += 1;
  }
  return score;
}
async function webSearchStandards(query, fetchContent = true) {
  const engineeringQuery = `${query} szabv\xE1ny OR jogszab\xE1ly OR rendelet OR MSZ OR EN OR ISO`;
  console.log(`[WebSearch] Searching: "${engineeringQuery}"`);
  const rawResults = await searchDuckDuckGo(engineeringQuery);
  if (rawResults.length === 0) {
    console.warn("[WebSearch] No results from DuckDuckGo");
    return [];
  }
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = rawResults.map((r) => ({ ...r, score: scoreResult(r, keywords) })).sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
  const sources = [];
  for (const result of scored) {
    let excerpt = result.snippet;
    if (fetchContent && result.url) {
      const fullText = await fetchPageText(result.url);
      if (fullText && fullText.length > 100) {
        const textLower = fullText.toLowerCase();
        let bestPos = 0;
        let bestScore = 0;
        for (const kw of keywords) {
          const pos = textLower.indexOf(kw);
          if (pos !== -1) {
            const localScore = keywords.filter((k) => textLower.includes(k)).length;
            if (localScore > bestScore) {
              bestScore = localScore;
              bestPos = pos;
            }
          }
        }
        const start = Math.max(0, bestPos - 150);
        const end = Math.min(fullText.length, bestPos + 600);
        const extracted = fullText.slice(start, end).replace(/\s+/g, " ").trim();
        if (extracted.length > 80) {
          excerpt = extracted;
        }
      }
    }
    sources.push({
      documentName: result.title,
      url: result.url,
      excerpt: excerpt || result.snippet,
      relevanceScore: result.score / (keywords.length + 3),
      // normalize
      sourceType: "web"
    });
  }
  return sources;
}
async function fetchUrlSources(urls, query) {
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const sources = [];
  for (const url of urls.slice(0, MAX_RESULTS)) {
    try {
      const fullText = await fetchPageText(url);
      if (!fullText || fullText.length < 50) continue;
      const textLower = fullText.toLowerCase();
      let bestPos = 0;
      let bestScore = 0;
      for (const kw of keywords) {
        const pos = textLower.indexOf(kw);
        if (pos !== -1) {
          const localScore = keywords.filter((k) => textLower.includes(k)).length;
          if (localScore > bestScore) {
            bestScore = localScore;
            bestPos = pos;
          }
        }
      }
      const start = Math.max(0, bestPos - 150);
      const end = Math.min(fullText.length, bestPos + 600);
      const excerpt = fullText.slice(start, end).replace(/\s+/g, " ").trim();
      let title = url;
      try {
        const u = new URL(url);
        title = u.hostname.replace("www.", "") + u.pathname;
      } catch {
      }
      sources.push({
        documentName: title,
        url,
        excerpt: excerpt || fullText.slice(0, 500),
        relevanceScore: Math.min(1, (bestScore + 1) / (keywords.length + 1)),
        sourceType: "web"
      });
    } catch (err) {
      console.warn(`[WebSearch] Failed to fetch URL ${url}:`, err.message);
    }
  }
  return sources;
}

// server/routers/standardsSearch.ts
init_regulationScraper();
init_schema();
async function rewriteQuery(question) {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Te egy magyar m\xE9rn\xF6ki szabv\xE1ny-keres\u0151 rendszer k\xE9rd\xE9s-\xE1t\xEDr\xF3 modulja vagy.
A felhaszn\xE1l\xF3 k\xE9rd\xE9s\xE9t alak\xEDtsd \xE1t egy prec\xEDz, technikai keres\xE9si lek\xE9rdez\xE9ss\xE9.
Adj vissza egyetlen sort: a pontos\xEDtott, technikai k\xE9rd\xE9st magyarul.
Ne adj magyar\xE1zatot, csak a pontos\xEDtott k\xE9rd\xE9st.`
        },
        {
          role: "user",
          content: `Eredeti k\xE9rd\xE9s: "${question}"

Pontos\xEDtott technikai k\xE9rd\xE9s:`
        }
      ]
    });
    const rawRewritten = response.choices?.[0]?.message?.content;
    const rewritten = typeof rawRewritten === "string" ? rawRewritten.trim() : "";
    return rewritten && rewritten.length > 5 ? rewritten : question;
  } catch {
    return question;
  }
}
async function keywordSearch(query, mode) {
  const db = await getDb();
  if (!db) return [];
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 6);
  if (keywords.length === 0) return [];
  try {
    const conditions = keywords.map(
      (kw) => or(
        like(regulationSources.name, `%${kw}%`),
        like(regulationSources.content, `%${kw}%`)
      )
    );
    let sources = await db.select().from(regulationSources).where(or(...conditions)).limit(20);
    if (mode === "web") {
      return [];
    }
    const results = [];
    for (const src of sources) {
      if (!src.content) continue;
      const contentLower = src.content.toLowerCase();
      let bestPos = -1;
      let bestScore = 0;
      for (const kw of keywords) {
        const pos = contentLower.indexOf(kw);
        if (pos !== -1) {
          const score = keywords.filter((k) => contentLower.includes(k)).length;
          if (score > bestScore) {
            bestScore = score;
            bestPos = pos;
          }
        }
      }
      if (bestPos === -1) continue;
      const start = Math.max(0, bestPos - 200);
      const end = Math.min(src.content.length, bestPos + 600);
      const excerpt = src.content.slice(start, end).replace(/\s+/g, " ").trim();
      results.push({
        documentName: src.name,
        url: src.sourceUrl ?? void 0,
        excerpt,
        relevanceScore: bestScore / keywords.length
      });
    }
    return results.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)).slice(0, 8);
  } catch (err) {
    console.error("[StandardsSearch] Keyword search error:", err);
    return [];
  }
}
var vectorSearchAvailable = null;
async function vectorSearchTopK(db, queryEmbedding, limit) {
  if (vectorSearchAvailable === false) return null;
  try {
    const literal = `[${queryEmbedding.join(",")}]`;
    const res = await db.execute(sql2`
      SELECT id, source_type AS sourceType, source_id AS sourceId,
             chunk_index AS chunkIndex, text,
             1 - VEC_COSINE_DISTANCE(embedding_vec, ${literal}) AS score
      FROM chunk_embeddings
      WHERE embedding_vec IS NOT NULL AND source_type = 'regulation'
      ORDER BY VEC_COSINE_DISTANCE(embedding_vec, ${literal})
      LIMIT ${limit}
    `);
    const raw = Array.isArray(res) ? res[0] : res;
    const rows = Array.isArray(raw) ? raw : [];
    if (rows.length === 0) {
      return null;
    }
    vectorSearchAvailable = true;
    return rows.map((r) => ({
      row: {
        id: Number(r.id),
        sourceType: String(r.sourceType),
        sourceId: Number(r.sourceId),
        chunkIndex: Number(r.chunkIndex),
        text: String(r.text ?? ""),
        embedding: []
        // a vektor maga már nem kell a rangsoroláshoz
      },
      score: Number(r.score)
    })).filter((r) => Number.isFinite(r.score) && r.score > 0.1);
  } catch {
    vectorSearchAvailable = false;
    return null;
  }
}
async function semanticSearch(query, mode, topK = 8) {
  const db = await getDb();
  if (!db) return [];
  const queryEmbedding = await getEmbedding(query);
  if (!queryEmbedding) return [];
  const includeRegulations = mode !== "web";
  const includeKnowledgeBase = false;
  let scored = await vectorSearchTopK(db, queryEmbedding, topK * 2);
  if (scored === null) {
    let rows = [];
    try {
      rows = await db.select({
        id: chunkEmbeddings.id,
        sourceType: chunkEmbeddings.sourceType,
        sourceId: chunkEmbeddings.sourceId,
        chunkIndex: chunkEmbeddings.chunkIndex,
        text: chunkEmbeddings.text,
        embedding: chunkEmbeddings.embedding
      }).from(chunkEmbeddings);
    } catch (err) {
      console.error("[StandardsSearch] semantic search skipped (chunk_embeddings table missing?):", err);
      return [];
    }
    if (rows.length === 0) return [];
    const jsScored = [];
    for (const row of rows) {
      if (row.sourceType === "regulation" && !includeRegulations) continue;
      if (row.sourceType === "knowledge_base" && !includeKnowledgeBase) continue;
      if (!Array.isArray(row.embedding) || row.embedding.length === 0) continue;
      const score = cosineSimilarity(queryEmbedding, row.embedding);
      if (score > 0.1) jsScored.push({ row, score });
    }
    scored = jsScored;
  }
  if (scored.length === 0) return [];
  let filteredScored = scored;
  if (mode === "mszt") {
    const regIds2 = Array.from(new Set(scored.filter((s) => s.row.sourceType === "regulation").map((s) => s.row.sourceId)));
    if (regIds2.length === 0) return [];
    const msztRegs = await db.select({ id: regulationSources.id }).from(regulationSources).where(eq4(regulationSources.sourceType, "mszt"));
    const msztIds = new Set(msztRegs.map((r) => r.id));
    filteredScored = scored.filter((s) => s.row.sourceType === "regulation" && msztIds.has(s.row.sourceId));
  }
  filteredScored.sort((a, b) => b.score - a.score);
  const top = filteredScored.slice(0, topK);
  const regIds = Array.from(new Set(top.filter((s) => s.row.sourceType === "regulation").map((s) => s.row.sourceId)));
  const kbIds = Array.from(new Set(top.filter((s) => s.row.sourceType === "knowledge_base").map((s) => s.row.sourceId)));
  const regNameById = /* @__PURE__ */ new Map();
  if (regIds.length > 0) {
    const regs = await db.select({ id: regulationSources.id, name: regulationSources.name, sourceUrl: regulationSources.sourceUrl }).from(regulationSources);
    for (const r of regs) {
      if (regIds.includes(r.id)) regNameById.set(r.id, { name: r.name, url: r.sourceUrl });
    }
  }
  const kbNameById = /* @__PURE__ */ new Map();
  if (kbIds.length > 0) {
    const docs = await db.select({ id: knowledgeBaseDocuments.id, name: knowledgeBaseDocuments.name, originalName: knowledgeBaseDocuments.originalName }).from(knowledgeBaseDocuments);
    for (const d of docs) {
      if (kbIds.includes(d.id)) kbNameById.set(d.id, d.name || d.originalName);
    }
  }
  return top.map(({ row, score }) => {
    if (row.sourceType === "regulation") {
      const meta = regNameById.get(row.sourceId);
      return {
        documentName: meta?.name ?? `Forr\xE1s #${row.sourceId}`,
        url: meta?.url ?? void 0,
        excerpt: row.text,
        relevanceScore: score,
        sourceType: "library"
      };
    }
    return {
      documentName: `Tud\xE1st\xE1r: ${kbNameById.get(row.sourceId) ?? `Doc #${row.sourceId}`}`,
      excerpt: row.text,
      relevanceScore: score,
      sourceType: "library"
    };
  });
}
function normalizeForMatch(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ");
}
function extractQueryKeywords(query) {
  return normalizeForMatch(query).split(/\s+/).filter((w) => w.length > 3);
}
function titleBoostFactor(queryKeywords, documentName) {
  if (queryKeywords.length === 0) return 1;
  const normName = normalizeForMatch(documentName);
  let matches = 0;
  for (const kw of queryKeywords) {
    if (normName.includes(kw)) matches++;
  }
  return 1 + Math.min(matches, 4) * 0.12;
}
function mergeSearchSources(keyword, semantic, maxItems, query = "") {
  const K = 60;
  const queryKeywords = extractQueryKeywords(query);
  const keyOf = (s) => `${s.documentName}::${s.excerpt.slice(0, 80)}`;
  const fused = /* @__PURE__ */ new Map();
  const addList = (list) => {
    list.forEach((s, rank) => {
      const key = keyOf(s);
      const rrf = 1 / (K + rank);
      const existing = fused.get(key);
      if (existing) {
        existing.score += rrf;
      } else {
        fused.set(key, { source: s, score: rrf });
      }
    });
  };
  addList(semantic);
  addList(keyword);
  const boosted = Array.from(fused.values()).map(({ source, score }) => {
    const boost = titleBoostFactor(queryKeywords, source.documentName);
    return { source, score: score * boost };
  });
  const sorted = boosted.sort((a, b) => b.score - a.score).slice(0, maxItems);
  const maxScore = sorted[0]?.score ?? 1;
  return sorted.map(({ source, score }) => ({
    ...source,
    relevanceScore: maxScore > 0 ? score / maxScore : 0
  }));
}
function buildUnsupportedAnswerNotice(notes) {
  const lines = [
    "**A bet\xF6lt\xF6tt szabv\xE1nyok ezt a k\xE9rd\xE9st nem fedik le megb\xEDzhat\xF3an.**",
    "",
    "A rendszer tal\xE1lt kapcsol\xF3d\xF3 forr\xE1sokat (l\xE1sd a Hivatkoz\xE1sok szekci\xF3t), de az \xF6nellen\u0151rz\xE9s szerint a v\xE1lasz nem vezethet\u0151 vissza egy\xE9rtelm\u0171en ezekre. A megt\xE9veszt\u0151, kital\xE1lt adatok elker\xFCl\xE9se v\xE9gett ez\xE9rt nem jelen\xEDt\xFCnk meg konkr\xE9t v\xE1laszt."
  ];
  if (notes) lines.push("", `_Az \xF6nellen\u0151rz\xE9s \xE9szrev\xE9tele: ${notes}_`);
  lines.push("", "Javaslat: t\xF6ltse fel a t\xE9m\xE1hoz tartoz\xF3 szabv\xE1nyt a Jogszab\xE1lyok oldalon, vagy fogalmazza \xE1t a k\xE9rd\xE9st pontosabban.");
  return lines.join("\n");
}
async function generateStructuredAnswer(question, rewrittenQuestion, sources, answerLength, operationMode) {
  if (sources.length === 0) {
    return {
      answer: "Nem tal\xE1lhat\xF3 elegend\u0151 inform\xE1ci\xF3 a rendelkez\xE9sre \xE1ll\xF3 forr\xE1sokban a k\xE9rd\xE9s megv\xE1laszol\xE1s\xE1hoz.",
      confidence: "low",
      sources: [],
      hasSufficientSources: false,
      selfCheckPassed: false,
      selfCheckNotes: "Nincs relev\xE1ns forr\xE1s.",
      rewrittenQuestion
    };
  }
  const lengthInstruction = {
    short: "Adj maximum 3-4 mondatos t\xF6m\xF6r v\xE1laszt.",
    standard: "Adj maximum 8-10 mondatos szakmai v\xE1laszt.",
    detailed: "Adj r\xE9szletes, 15-20 mondatos szakmai magyar\xE1zatot."
  }[answerLength];
  const modeInstruction = operationMode === "accurate" ? `Kiz\xE1r\xF3lag a megadott forr\xE1sokb\xF3l dolgozz. Minden \xE1ll\xEDt\xE1st forr\xE1shivatkoz\xE1ssal [n] t\xE1massz\xE1l al\xE1.
KRITIKUS: ha a forr\xE1sok NEM tartalmazz\xE1k a k\xE9rd\xE9sre a v\xE1laszt, akkor KIZ\xC1R\xD3LAG ennyit \xEDrj:
"A bet\xF6lt\xF6tt szabv\xE1nyok ezt a k\xE9rd\xE9st nem fedik le." \u2014 \xE9s semmi m\xE1st.
SOHA ne tal\xE1lj ki konkr\xE9t sz\xE1mokat, m\xE9reteket, szil\xE1rds\xE1gi/anyagoszt\xE1lyokat, hat\xE1r\xE9rt\xE9keket,
k\xE9pleteket vagy szabv\xE1ny-jel\xF6l\xE9seket, amelyek nem szerepelnek sz\xF3 szerint a forr\xE1sokban. Ha
bizonytalan vagy, hogy egy adat a forr\xE1sb\xF3l sz\xE1rmazik-e, ne \xEDrd le.` : "Els\u0151sorban a megadott forr\xE1sokb\xF3l dolgozz, de sz\xFCks\xE9g eset\xE9n \xE1ltal\xE1nos m\xE9rn\xF6ki tud\xE1st is felhaszn\xE1lhatsz \u2013 ebben az esetben jel\xF6ld meg, hogy ez nem forr\xE1sb\xF3l sz\xE1rmazik.";
  const sourcesText = sources.map((s, i) => `[${i + 1}] ${s.documentName}
${s.excerpt}`).join("\n\n---\n\n");
  const systemPrompt = `Te egy magyar m\xE9rn\xF6ki szabv\xE1ny-tan\xE1csad\xF3 AI vagy.
${modeInstruction}
${lengthInstruction}
A v\xE1lasz v\xE9g\xE9n add meg a felhaszn\xE1lt forr\xE1sokat struktur\xE1lt form\xE1ban.
V\xE1laszolj szakmai, t\xF6m\xF6r st\xEDlusban. Ne spekul\xE1lj, ne hallucin\xE1ld az adatokat.`;
  const userPrompt = `K\xE9rd\xE9s: "${question}"
${rewrittenQuestion !== question ? `Pontos\xEDtott k\xE9rd\xE9s: "${rewrittenQuestion}"` : ""}

Rendelkez\xE9sre \xE1ll\xF3 forr\xE1sok:
${sourcesText}

K\xE9rlek, v\xE1laszolj a k\xE9rd\xE9sre a fenti forr\xE1sok alapj\xE1n. Jel\xF6ld meg a hivatkoz\xE1sokat [1], [2] stb. form\xE1tumban.`;
  let answer = "";
  let confidence = "medium";
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });
    const rawContent = response.choices?.[0]?.message?.content;
    answer = typeof rawContent === "string" ? rawContent.trim() : "";
  } catch (err) {
    console.error("[StandardsSearch] LLM error:", err);
    return {
      answer: "Hiba t\xF6rt\xE9nt a v\xE1lasz gener\xE1l\xE1sa sor\xE1n. K\xE9rj\xFCk, pr\xF3b\xE1lja \xFAjra.",
      confidence: "low",
      sources,
      hasSufficientSources: true,
      selfCheckPassed: false,
      selfCheckNotes: "LLM hiba.",
      rewrittenQuestion
    };
  }
  let selfCheckPassed = true;
  let selfCheckNotes = "";
  if (operationMode === "accurate" && answer) {
    try {
      const checkResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Te egy ellen\u0151rz\u0151 AI vagy. K\xE9t k\xFCl\xF6nb\xF6z\u0151 dolgot \xE9rt\xE9kelj:
- "answerable": a megadott forr\xE1sok TARTALMAZNAK-E a k\xE9rd\xE9sre vonatkoz\xF3 \xE9rdemi inform\xE1ci\xF3t? (Igaz akkor is, ha a v\xE1lasz nem t\xF6k\xE9letes, de a t\xE9ma le van fedve. Hamis, ha a forr\xE1sok egy\xE1ltal\xE1n nem a k\xE9rd\xE9s t\xE1rgy\xE1r\xF3l sz\xF3lnak.)
- "passed": a v\xE1lasz MINDEN konkr\xE9t \xE1ll\xEDt\xE1sa (sz\xE1mok, \xE9rt\xE9kek, hivatkoz\xE1sok) pontosan visszavezethet\u0151-e a forr\xE1sokra?
Adj vissza JSON-t: { "answerable": boolean, "passed": boolean, "issues": string[], "confidence": "low"|"medium"|"high" }`
          },
          {
            role: "user",
            content: `K\xE9rd\xE9s: ${answer ? "(l\xE1sd a v\xE1laszt)" : ""}

Gener\xE1lt v\xE1lasz:
${answer}

Forr\xE1sok:
${sourcesText}

\xC9rt\xE9kel\xE9s:`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "self_check",
            strict: true,
            schema: {
              type: "object",
              properties: {
                answerable: { type: "boolean" },
                passed: { type: "boolean" },
                issues: { type: "array", items: { type: "string" } },
                confidence: { type: "string", enum: ["low", "medium", "high"] }
              },
              required: ["answerable", "passed", "issues", "confidence"],
              additionalProperties: false
            }
          }
        }
      });
      const checkContent = checkResponse.choices?.[0]?.message?.content;
      let answerable = true;
      if (checkContent && typeof checkContent === "string") {
        const checkResult = JSON.parse(checkContent);
        answerable = checkResult.answerable !== false;
        selfCheckPassed = checkResult.passed;
        selfCheckNotes = checkResult.issues?.join("; ") ?? "";
        confidence = checkResult.confidence;
      }
      if (!answerable) {
        confidence = "low";
        selfCheckPassed = false;
        answer = buildUnsupportedAnswerNotice(selfCheckNotes);
      } else if (!selfCheckPassed && confidence === "high") {
        confidence = "medium";
      }
    } catch {
      confidence = "medium";
    }
  } else {
    confidence = sources.length >= 3 ? "high" : sources.length >= 1 ? "medium" : "low";
  }
  return {
    answer,
    confidence,
    sources,
    hasSufficientSources: true,
    selfCheckPassed,
    selfCheckNotes,
    rewrittenQuestion
  };
}
async function generateExtendedAnswer(question, originalAnswer, sources) {
  const sourcesText = sources.map((s, i) => `[${i + 1}] ${s.documentName}
${s.excerpt}`).join("\n\n---\n\n");
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Te egy magyar m\xE9rn\xF6ki szabv\xE1ny-tan\xE1csad\xF3 AI vagy.
B\u0151v\xEDtsd ki az al\xE1bbi v\xE1laszt r\xE9szletesebb szakmai magyar\xE1zattal.
Kiz\xE1r\xF3lag a megadott forr\xE1sokra t\xE1maszkodj \u2013 ne adj hozz\xE1 forr\xE1s n\xE9lk\xFCli inform\xE1ci\xF3t.
Adj r\xE9szletes, 20-25 mondatos szakmai magyar\xE1zatot, t\xF6bb hivatkoz\xE1ssal.`
        },
        {
          role: "user",
          content: `K\xE9rd\xE9s: "${question}"

Eredeti v\xE1lasz:
${originalAnswer}

Forr\xE1sok:
${sourcesText}

B\u0151v\xEDtett v\xE1lasz:`
        }
      ]
    });
    const rawExt = response.choices?.[0]?.message?.content;
    return typeof rawExt === "string" ? rawExt.trim() : originalAnswer;
  } catch {
    return originalAnswer;
  }
}
var standardsSearchRouter = router({
  /**
   * Main search endpoint – query rewriting + hybrid search + structured answer
   */
  search: publicProcedure.input(
    z5.object({
      question: z5.string().min(3).max(1e3),
      searchMode: z5.enum(["mszt", "internal", "combined", "web", "combined_with_web"]).default("internal"),
      answerLength: z5.enum(["short", "standard", "detailed"]).default("standard"),
      operationMode: z5.enum(["fast", "accurate"]).default("accurate"),
      projectId: z5.number().int().positive().optional(),
      projectName: z5.string().optional(),
      urls: z5.array(z5.string().url()).optional()
    })
  ).mutation(async ({ input }) => {
    const { question, searchMode, answerLength, operationMode, projectId, projectName, urls } = input;
    const rewrittenQuestion = operationMode === "accurate" ? await rewriteQuery(question) : question;
    let sources = [];
    if (searchMode === "web") {
      if (urls && urls.length > 0) {
        sources = await fetchUrlSources(urls, rewrittenQuestion);
      } else {
        sources = await webSearchStandards(rewrittenQuestion, true);
      }
    } else if (searchMode === "combined_with_web") {
      const webSources = urls && urls.length > 0 ? await fetchUrlSources(urls, rewrittenQuestion) : await webSearchStandards(rewrittenQuestion, true);
      const libSources = await keywordSearch(rewrittenQuestion, "internal");
      const semanticSources = await semanticSearch(rewrittenQuestion, "internal");
      const allLibrary = mergeSearchSources(libSources, semanticSources, 8, rewrittenQuestion);
      const seenUrls = new Set(allLibrary.map((s) => s.url).filter(Boolean));
      const dedupedWeb = webSources.filter((s) => !s.url || !seenUrls.has(s.url));
      sources = [...allLibrary, ...dedupedWeb].slice(0, 10);
    } else {
      const libSources = await keywordSearch(rewrittenQuestion, "internal");
      const semanticSources = await semanticSearch(rewrittenQuestion, "internal");
      sources = mergeSearchSources(libSources, semanticSources, 10, rewrittenQuestion);
    }
    const result = await generateStructuredAnswer(
      question,
      rewrittenQuestion,
      sources,
      answerLength,
      operationMode
    );
    const db = await getDb();
    let queryId;
    if (db) {
      try {
        const inserted = await db.insert(searchQueries).values({
          question,
          rewrittenQuestion: result.rewrittenQuestion,
          searchMode,
          answerLength,
          operationMode,
          answer: result.answer,
          confidence: result.confidence,
          sources: result.sources,
          hasSufficientSources: result.hasSufficientSources,
          selfCheckPassed: result.selfCheckPassed,
          selfCheckNotes: result.selfCheckNotes,
          projectId: projectId ?? null,
          projectName
        });
        queryId = inserted.insertId;
      } catch (err) {
        console.error("[StandardsSearch] Failed to save query:", err);
      }
    }
    return {
      queryId,
      ...result
    };
  }),
  /**
   * Generate extended answer for an existing search result
   */
  extendAnswer: publicProcedure.input(
    z5.object({
      queryId: z5.number()
    })
  ).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    const rows = await db.select().from(searchQueries).where(eq4(searchQueries.id, input.queryId)).limit(1);
    const query = rows[0];
    if (!query) throw new TRPCError6({ code: "NOT_FOUND", message: "Keres\xE9s nem tal\xE1lhat\xF3." });
    if (!query.answer) throw new TRPCError6({ code: "BAD_REQUEST", message: "Nincs alap v\xE1lasz a b\u0151v\xEDt\xE9shez." });
    if (query.extendedAnswer) {
      return { extendedAnswer: query.extendedAnswer };
    }
    const extendedAnswer = await generateExtendedAnswer(
      query.question,
      query.answer,
      query.sources ?? []
    );
    await db.update(searchQueries).set({ extendedAnswer }).where(eq4(searchQueries.id, input.queryId));
    return { extendedAnswer };
  }),
  /**
   * List search history
   */
  listHistory: publicProcedure.input(
    z5.object({
      limit: z5.number().min(1).max(100).default(50),
      offset: z5.number().min(0).default(0),
      search: z5.string().optional(),
      projectId: z5.number().int().positive().optional()
    })
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { items: [], total: 0 };
    try {
      const conditions = [];
      if (input.search) {
        conditions.push(
          or(
            like(searchQueries.question, `%${input.search}%`),
            like(searchQueries.answer, `%${input.search}%`)
          )
        );
      }
      if (input.projectId !== void 0) {
        conditions.push(eq4(searchQueries.projectId, input.projectId));
      }
      const baseQuery = db.select().from(searchQueries);
      const filtered = conditions.length > 0 ? baseQuery.where(conditions.length === 1 ? conditions[0] : and2(...conditions)) : baseQuery;
      const items = await filtered.orderBy(desc3(searchQueries.createdAt)).limit(input.limit).offset(input.offset);
      return { items, total: items.length };
    } catch (err) {
      console.error("[StandardsSearch] listHistory error:", err);
      return { items: [], total: 0 };
    }
  }),
  /**
   * Get single search query by ID
   */
  getQuery: publicProcedure.input(z5.object({ id: z5.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    const rows = await db.select().from(searchQueries).where(eq4(searchQueries.id, input.id)).limit(1);
    if (!rows[0]) throw new TRPCError6({ code: "NOT_FOUND", message: "Keres\xE9s nem tal\xE1lhat\xF3." });
    return rows[0];
  }),
  /**
   * Delete a search query from history
   */
  deleteQuery: publicProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    await db.delete(searchQueries).where(eq4(searchQueries.id, input.id));
    return { success: true };
  })
});

// server/routers/knowledgeBase.ts
import { z as z6 } from "zod";
import { TRPCError as TRPCError7 } from "@trpc/server";
init_db();
init_schema();
import { and as and3, eq as eq5, inArray as inArray2, isNull as isNull2, like as like2, or as or2, desc as desc4, sql as sql3 } from "drizzle-orm";
init_documentExtractor();
import { nanoid as nanoid2 } from "nanoid";
var knowledgeBaseRouter = router({
  // List all documents, optionally filtered by search query, project, and
  // (V11.7) soft-delete status. Default: only non-deleted rows.
  list: publicProcedure.input(z6.object({
    search: z6.string().optional(),
    projectId: z6.number().int().positive().optional(),
    includeDeleted: z6.boolean().default(false)
  })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const filters = [];
    if (input.search && input.search.trim()) {
      const q = `%${input.search.trim()}%`;
      filters.push(
        or2(
          like2(knowledgeBaseDocuments.name, q),
          like2(knowledgeBaseDocuments.originalName, q),
          like2(knowledgeBaseDocuments.description, q),
          like2(knowledgeBaseDocuments.tags, q)
        )
      );
    }
    if (input.projectId !== void 0) {
      filters.push(eq5(knowledgeBaseDocuments.projectId, input.projectId));
    }
    if (!input.includeDeleted) {
      filters.push(isNull2(knowledgeBaseDocuments.deletedAt));
    }
    const baseQuery = db.select().from(knowledgeBaseDocuments);
    const filtered = filters.length > 0 ? baseQuery.where(filters.length === 1 ? filters[0] : and3(...filters)) : baseQuery;
    try {
      return await filtered.orderBy(desc4(knowledgeBaseDocuments.uploadedAt));
    } catch (err) {
      console.warn("[knowledgeBase.list] deletedAt column missing? Falling back:", err);
      const nonDeletedFilters = filters.filter(
        (_, i) => (
          // We added the deletedAt filter last, so drop the last filter on retry
          i !== filters.length - 1 || input.includeDeleted
        )
      );
      const fallback = nonDeletedFilters.length > 0 ? db.select().from(knowledgeBaseDocuments).where(nonDeletedFilters.length === 1 ? nonDeletedFilters[0] : and3(...nonDeletedFilters)) : db.select().from(knowledgeBaseDocuments);
      return fallback.orderBy(desc4(knowledgeBaseDocuments.uploadedAt));
    }
  }),
  // Upload one or more documents
  upload: publicProcedure.input(z6.object({
    projectId: z6.number().int().positive().optional(),
    documents: z6.array(z6.object({
      base64: z6.string(),
      originalName: z6.string(),
      fileType: z6.string(),
      fileSize: z6.number(),
      name: z6.string(),
      description: z6.string().optional(),
      tags: z6.string().optional()
    }))
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Adatb\xE1zis nem el\xE9rhet\u0151");
    const results = [];
    for (const doc of input.documents) {
      const buffer = Buffer.from(doc.base64, "base64");
      const suffix = nanoid2(8);
      const s3Key = `knowledge-base/${Date.now()}-${suffix}.${doc.fileType}`;
      const mimeMap = {
        pdf: "application/pdf",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        doc: "application/msword",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
        dwg: "application/acad",
        dxf: "application/dxf",
        ifc: "application/x-step",
        rtf: "application/rtf"
      };
      const mime = mimeMap[doc.fileType.toLowerCase()] ?? "application/octet-stream";
      const { url: s3Url } = await storagePut(s3Key, buffer, mime);
      let extractedText = null;
      try {
        const result = await extractDocumentText(buffer, doc.fileType);
        extractedText = result.text ?? null;
      } catch (_e) {
      }
      await db.insert(knowledgeBaseDocuments).values({
        name: doc.name || doc.originalName,
        originalName: doc.originalName,
        fileType: doc.fileType.toLowerCase(),
        fileSize: doc.fileSize,
        s3Url,
        s3Key,
        extractedText,
        description: doc.description ?? null,
        tags: doc.tags ?? null,
        projectId: input.projectId ?? null
      });
      results.push({ name: doc.name, s3Key });
    }
    return { uploaded: results.length };
  }),
  // Soft-delete a document (V11.7). Cascades chunk_embeddings cleanup so
  // semantic search doesn't return phantom results from deleted docs — on
  // restore, the user must regenerate embeddings.
  delete: publicProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new Error("Adatb\xE1zis nem el\xE9rhet\u0151");
    try {
      await db.update(knowledgeBaseDocuments).set({ deletedAt: /* @__PURE__ */ new Date() }).where(eq5(knowledgeBaseDocuments.id, input.id));
    } catch (err) {
      console.warn("[knowledgeBase.delete] soft-delete path failed, falling back to hard delete:", err);
      await db.delete(knowledgeBaseDocuments).where(eq5(knowledgeBaseDocuments.id, input.id));
    }
    await db.delete(chunkEmbeddings).where(and3(eq5(chunkEmbeddings.sourceType, "knowledge_base"), eq5(chunkEmbeddings.sourceId, input.id)));
    return { success: true };
  }),
  // Bulk soft-delete (V11.7) — atomic batch over multiple docs.
  deleteMany: publicProcedure.input(z6.object({ ids: z6.array(z6.number().int().positive()).min(1).max(500) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151" });
    const existing = await db.select({ id: knowledgeBaseDocuments.id }).from(knowledgeBaseDocuments).where(inArray2(knowledgeBaseDocuments.id, input.ids));
    const existingIds = existing.map((r) => r.id);
    if (existingIds.length === 0) {
      return { deletedCount: 0, requestedCount: input.ids.length };
    }
    try {
      await db.update(knowledgeBaseDocuments).set({ deletedAt: /* @__PURE__ */ new Date() }).where(inArray2(knowledgeBaseDocuments.id, existingIds));
    } catch (err) {
      console.warn("[knowledgeBase.deleteMany] soft-delete fallback to hard:", err);
      await db.delete(knowledgeBaseDocuments).where(inArray2(knowledgeBaseDocuments.id, existingIds));
    }
    await db.delete(chunkEmbeddings).where(
      and3(
        eq5(chunkEmbeddings.sourceType, "knowledge_base"),
        inArray2(chunkEmbeddings.sourceId, existingIds)
      )
    );
    return { deletedCount: existingIds.length, requestedCount: input.ids.length };
  }),
  /**
   * Restore a soft-deleted document. Embeddings need to be regenerated separately.
   */
  restore: publicProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151" });
    await db.update(knowledgeBaseDocuments).set({ deletedAt: null }).where(eq5(knowledgeBaseDocuments.id, input.id));
    return { success: true };
  }),
  /**
   * Permanent (hard) delete — kept for an admin "empty trash" flow.
   */
  permanentDelete: publicProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151" });
    await db.delete(knowledgeBaseDocuments).where(eq5(knowledgeBaseDocuments.id, input.id));
    await db.delete(chunkEmbeddings).where(and3(eq5(chunkEmbeddings.sourceType, "knowledge_base"), eq5(chunkEmbeddings.sourceId, input.id)));
    return { success: true };
  }),
  /**
   * Per-document chunk-embedding counts, mirroring regulationSources.getEmbeddingCounts.
   */
  getEmbeddingCounts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    try {
      const rows = await db.select({
        sourceId: chunkEmbeddings.sourceId,
        chunkCount: sql3`count(*)`
      }).from(chunkEmbeddings).where(eq5(chunkEmbeddings.sourceType, "knowledge_base")).groupBy(chunkEmbeddings.sourceId);
      return rows.map((r) => ({ sourceId: r.sourceId, chunkCount: Number(r.chunkCount) }));
    } catch (err) {
      console.error("[knowledgeBase] getEmbeddingCounts skipped:", err);
      return [];
    }
  }),
  /**
   * Generate (or regenerate) chunk embeddings for a Knowledge Base document.
   * Mirrors regulationSources.regenerateEmbeddings — same graceful fallback
   * if the embedding API is unavailable.
   */
  regenerateEmbeddings: publicProcedure.input(z6.object({ id: z6.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151" });
    const rows = await db.select().from(knowledgeBaseDocuments).where(eq5(knowledgeBaseDocuments.id, input.id)).limit(1);
    const doc = rows[0];
    if (!doc) throw new TRPCError7({ code: "NOT_FOUND", message: "Tud\xE1st\xE1r dokumentum nem tal\xE1lhat\xF3" });
    if (!doc.extractedText || doc.extractedText.trim().length === 0) {
      return { chunkCount: 0, embeddingApiUnavailable: false, message: "A dokumentumnak nincs kinyert sz\xF6vege." };
    }
    const embedded = await chunkAndEmbed(doc.extractedText);
    if (embedded.length === 0) {
      return { chunkCount: 0, embeddingApiUnavailable: true, message: "Az embedding API nem \xE9rhet\u0151 el, vagy nincs haszn\xE1lhat\xF3 chunk." };
    }
    await db.delete(chunkEmbeddings).where(and3(eq5(chunkEmbeddings.sourceType, "knowledge_base"), eq5(chunkEmbeddings.sourceId, input.id)));
    await db.insert(chunkEmbeddings).values(
      embedded.map((c) => ({
        sourceType: "knowledge_base",
        sourceId: input.id,
        chunkIndex: c.chunkIndex,
        text: c.text.slice(0, 65e3),
        embedding: c.embedding
      }))
    );
    return { chunkCount: embedded.length, embeddingApiUnavailable: false, message: null };
  }),
  // Get all extracted texts for internal search (used by standardsSearch)
  getTextsForSearch: publicProcedure.input(z6.object({ query: z6.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const docs = await db.select({
      id: knowledgeBaseDocuments.id,
      name: knowledgeBaseDocuments.name,
      originalName: knowledgeBaseDocuments.originalName,
      extractedText: knowledgeBaseDocuments.extractedText,
      tags: knowledgeBaseDocuments.tags
    }).from(knowledgeBaseDocuments).orderBy(desc4(knowledgeBaseDocuments.uploadedAt));
    const q = input.query.toLowerCase();
    const keywords = q.split(/\s+/).filter((k) => k.length > 2);
    return docs.filter((doc) => {
      if (!doc.extractedText) return false;
      const text2 = doc.extractedText.toLowerCase();
      return keywords.some((k) => text2.includes(k));
    }).map((doc) => ({
      id: doc.id,
      name: doc.name || doc.originalName,
      excerpt: doc.extractedText ? doc.extractedText.slice(0, 500) : "",
      relevanceScore: keywords.filter(
        (k) => (doc.extractedText ?? "").toLowerCase().includes(k)
      ).length / Math.max(keywords.length, 1)
    }));
  })
});

// server/routers/projects.ts
import { z as z8 } from "zod";
import { TRPCError as TRPCError9 } from "@trpc/server";
import { and as and5, desc as desc5, eq as eq7, ne } from "drizzle-orm";
init_db();
init_schema();

// server/routers/projectMembers.ts
import { z as z7 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";
import { and as and4, eq as eq6 } from "drizzle-orm";
init_db();
init_schema();
var roleEnum = z7.enum(["owner", "member", "reviewer"]);
async function getProjectMembership(db, projectId, userId) {
  const rows = await db.select({ role: projectMembers.role }).from(projectMembers).where(and4(eq6(projectMembers.projectId, projectId), eq6(projectMembers.userId, userId))).limit(1);
  return rows[0] ?? null;
}
async function requireMembership(db, projectId, userId) {
  const m = await getProjectMembership(db, projectId, userId);
  if (!m) {
    throw new TRPCError8({ code: "FORBIDDEN", message: "Nincs hozz\xE1f\xE9r\xE9sed ehhez a projekthez." });
  }
  return m;
}
async function requireOwnerForProject(db, projectId, userId) {
  const m = await getProjectMembership(db, projectId, userId);
  if (!m || m.role !== "owner") {
    throw new TRPCError8({ code: "FORBIDDEN", message: "Csak a projekt tulajdonosa v\xE9gezheti el ezt a m\u0171veletet." });
  }
}
async function countOwners(db, projectId) {
  const rows = await db.select({ id: projectMembers.id }).from(projectMembers).where(and4(eq6(projectMembers.projectId, projectId), eq6(projectMembers.role, "owner")));
  return rows.length;
}
var projectMembersRouter = router({
  /**
   * List members of a project (with user info joined).
   */
  list: publicProcedure.input(z7.object({ projectId: z7.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
      userName: users.name,
      userEmail: users.email
    }).from(projectMembers).leftJoin(users, eq6(projectMembers.userId, users.id)).where(eq6(projectMembers.projectId, input.projectId));
    return rows;
  }),
  /**
   * Add a user to a project by email. Owner-only.
   */
  add: protectedProcedure.input(z7.object({
    projectId: z7.number().int().positive(),
    email: z7.string().email(),
    role: roleEnum.default("member")
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    const projectExists = await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq6(projects.id, input.projectId)).limit(1);
    if (!projectExists[0]) {
      throw new TRPCError8({ code: "NOT_FOUND", message: "Projekt nem tal\xE1lhat\xF3." });
    }
    await requireOwnerForProject(db, input.projectId, ctx.user.id);
    const targetUserRows = await db.select({ id: users.id }).from(users).where(eq6(users.email, input.email)).limit(1);
    const targetUser = targetUserRows[0];
    if (!targetUser) {
      throw new TRPCError8({ code: "NOT_FOUND", message: `Nincs ilyen e-mail c\xEDm\u0171 felhaszn\xE1l\xF3: ${input.email}` });
    }
    const existing = await getProjectMembership(db, input.projectId, targetUser.id);
    if (existing) {
      throw new TRPCError8({ code: "CONFLICT", message: "Ez a felhaszn\xE1l\xF3 m\xE1r tagja a projektnek." });
    }
    await db.insert(projectMembers).values({
      projectId: input.projectId,
      userId: targetUser.id,
      role: input.role
    });
    await createNotification({
      userId: targetUser.id,
      eventType: "project_member_add",
      title: `Hozz\xE1adva \xFAj projekthez: ${projectExists[0].name ?? "Projekt"}`,
      body: `${ctx.user.email ?? "Egy felhaszn\xE1l\xF3"} ${input.role === "owner" ? "tulajdonosi" : input.role === "reviewer" ? "lektori" : "tag"} szerepk\xF6rrel adott hozz\xE1 a projekthez.`,
      link: `/projects/${input.projectId}`,
      email: input.email
    });
    return { success: true };
  }),
  /**
   * Change a member's role. Owner-only. Cannot demote the last remaining owner.
   */
  changeRole: protectedProcedure.input(z7.object({
    projectId: z7.number().int().positive(),
    userId: z7.number().int().positive(),
    role: roleEnum
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    await requireOwnerForProject(db, input.projectId, ctx.user.id);
    const target = await getProjectMembership(db, input.projectId, input.userId);
    if (!target) {
      throw new TRPCError8({ code: "NOT_FOUND", message: "A felhaszn\xE1l\xF3 nem tagja a projektnek." });
    }
    if (target.role === "owner" && input.role !== "owner") {
      const owners = await countOwners(db, input.projectId);
      if (owners <= 1) {
        throw new TRPCError8({
          code: "BAD_REQUEST",
          message: "Az utols\xF3 tulajdonos szerepk\xF6re nem m\xF3dos\xEDthat\xF3. El\u0151bb adj hozz\xE1 egy m\xE1sik tulajdonost."
        });
      }
    }
    await db.update(projectMembers).set({ role: input.role }).where(and4(eq6(projectMembers.projectId, input.projectId), eq6(projectMembers.userId, input.userId)));
    return { success: true };
  }),
  /**
   * Remove a member. Owner-only. Cannot remove the last remaining owner.
   */
  remove: protectedProcedure.input(z7.object({
    projectId: z7.number().int().positive(),
    userId: z7.number().int().positive()
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    await requireOwnerForProject(db, input.projectId, ctx.user.id);
    const target = await getProjectMembership(db, input.projectId, input.userId);
    if (!target) {
      throw new TRPCError8({ code: "NOT_FOUND", message: "A felhaszn\xE1l\xF3 nem tagja a projektnek." });
    }
    if (target.role === "owner") {
      const owners = await countOwners(db, input.projectId);
      if (owners <= 1) {
        throw new TRPCError8({
          code: "BAD_REQUEST",
          message: "Az utols\xF3 tulajdonos nem t\xE1vol\xEDthat\xF3 el. El\u0151bb adj hozz\xE1 egy m\xE1sik tulajdonost."
        });
      }
    }
    await db.delete(projectMembers).where(and4(eq6(projectMembers.projectId, input.projectId), eq6(projectMembers.userId, input.userId)));
    return { success: true };
  })
});

// server/routers/projects.ts
var disciplineEnum2 = z8.enum([
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
  "egyeb"
]);
var statusEnum = z8.enum(["active", "archived", "deleted"]);
var workflowStatusEnum = z8.enum([
  "uj",
  "elemzes_alatt",
  "ai_eloelenorizve",
  "ember_felulvizsgalva",
  "javitasra_visszakuldve",
  "lezart"
]);
var projectsRouter = router({
  /**
   * List all non-deleted projects, newest first.
   */
  list: publicProcedure.input(
    z8.object({
      includeDeleted: z8.boolean().default(false)
    }).optional()
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const includeDeleted = input?.includeDeleted ?? false;
    const query = db.select().from(projects);
    const rows = includeDeleted ? await query.orderBy(desc5(projects.createdAt)) : await query.where(ne(projects.status, "deleted")).orderBy(desc5(projects.createdAt));
    return rows;
  }),
  /**
   * Get a single project by id.
   */
  getById: publicProcedure.input(z8.object({ id: z8.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    const rows = await db.select().from(projects).where(eq7(projects.id, input.id)).limit(1);
    const project = rows[0];
    if (!project) throw new TRPCError9({ code: "NOT_FOUND", message: "Projekt nem tal\xE1lhat\xF3." });
    return project;
  }),
  /**
   * Create a new project. The current authenticated user becomes the owner.
   */
  create: protectedProcedure.input(
    z8.object({
      name: z8.string().min(1).max(255),
      description: z8.string().max(1e4).optional(),
      discipline: disciplineEnum2.default("altalanos"),
      workflowStatus: workflowStatusEnum.default("uj")
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    const inserted = await db.insert(projects).values({
      name: input.name,
      description: input.description ?? null,
      discipline: input.discipline,
      workflowStatus: input.workflowStatus,
      ownerId: ctx.user.id
    });
    const insertId = inserted.insertId;
    if (insertId) {
      await db.insert(projectMembers).values({
        projectId: insertId,
        userId: ctx.user.id,
        role: "owner"
      });
    }
    return { id: insertId ?? null };
  }),
  /**
   * Update an existing project. Any combination of fields may be provided.
   */
  update: protectedProcedure.input(
    z8.object({
      id: z8.number().int().positive(),
      name: z8.string().min(1).max(255).optional(),
      description: z8.string().max(1e4).nullable().optional(),
      status: statusEnum.optional(),
      workflowStatus: workflowStatusEnum.optional(),
      discipline: disciplineEnum2.optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    await requireOwnerForProject(db, input.id, ctx.user.id);
    const { id, ...patch } = input;
    const cleaned = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== void 0)
    );
    if (Object.keys(cleaned).length === 0) {
      return { success: true };
    }
    await db.update(projects).set(cleaned).where(eq7(projects.id, id));
    return { success: true };
  }),
  /**
   * Soft-delete a project (sets status = 'deleted'). Owner-only. The row is
   * preserved so historical analyses, KB documents and searches that reference
   * it still resolve, but it is hidden from the default list.
   */
  delete: protectedProcedure.input(z8.object({ id: z8.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    await requireOwnerForProject(db, input.id, ctx.user.id);
    await db.update(projects).set({ status: "deleted" }).where(and5(eq7(projects.id, input.id), ne(projects.status, "deleted")));
    return { success: true };
  }),
  /**
   * Export all per-project data as a single JSON snapshot. Members-only access.
   * Use case: handing the project state to another tool (or backup before
   * archiving). The file content of S3-uploaded Tudástár documents is NOT
   * included — only metadata + extractedText. The export is audit-logged.
   */
  export: protectedProcedure.input(z8.object({ id: z8.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    const projectRows = await db.select().from(projects).where(eq7(projects.id, input.id)).limit(1);
    const project = projectRows[0];
    if (!project) throw new TRPCError9({ code: "NOT_FOUND", message: "Projekt nem tal\xE1lhat\xF3." });
    await requireMembership(db, input.id, ctx.user.id);
    const memberRows = await db.select({
      userId: projectMembers.userId,
      role: projectMembers.role,
      joinedAt: projectMembers.createdAt,
      userName: users.name,
      userEmail: users.email
    }).from(projectMembers).leftJoin(users, eq7(projectMembers.userId, users.id)).where(eq7(projectMembers.projectId, input.id));
    const projectAnalyses = await db.select().from(analyses).where(eq7(analyses.projectId, input.id)).orderBy(desc5(analyses.createdAt));
    const projectKb = await db.select().from(knowledgeBaseDocuments).where(eq7(knowledgeBaseDocuments.projectId, input.id)).orderBy(desc5(knowledgeBaseDocuments.uploadedAt));
    const projectSearches = await db.select().from(searchQueries).where(eq7(searchQueries.projectId, input.id)).orderBy(desc5(searchQueries.createdAt));
    const exportedAt = /* @__PURE__ */ new Date();
    await auditLog({
      userId: ctx.user.id,
      userEmail: ctx.user.email ?? void 0,
      eventType: "project_export",
      resourceType: "project",
      resourceId: input.id,
      description: `Projekt export\xE1lva: ${project.name}`,
      metadata: {
        projectId: input.id,
        analysesCount: projectAnalyses.length,
        knowledgeBaseCount: projectKb.length,
        searchQueriesCount: projectSearches.length
      }
    });
    return {
      format: "compliance-checker-project-export-v1",
      exportedAt,
      exportedBy: { id: ctx.user.id, email: ctx.user.email ?? null, name: ctx.user.name ?? null },
      project,
      members: memberRows,
      analyses: projectAnalyses,
      knowledgeBaseDocuments: projectKb,
      searchQueries: projectSearches
    };
  }),
  /**
   * Import a project from a JSON snapshot previously created by `projects.export`.
   * Always creates a NEW project (never overwrites) with the current user as the
   * owner. Members are NOT imported (they may not exist in this workspace).
   * KB documents are imported with their original s3Url/s3Key — if those S3
   * blobs were deleted or live on a different bucket, the metadata is still
   * available but the file is unreachable. Audit-logged.
   */
  import: protectedProcedure.input(
    z8.object({
      data: z8.object({
        format: z8.literal("compliance-checker-project-export-v1"),
        project: z8.object({
          name: z8.string().min(1).max(255),
          description: z8.string().nullable().optional(),
          discipline: disciplineEnum2.optional(),
          workflowStatus: workflowStatusEnum.optional()
        }),
        analyses: z8.array(z8.object({
          title: z8.string().min(1).max(255),
          status: z8.enum(["pending", "processing", "completed", "error"]).optional(),
          workflowStatus: z8.enum([
            "uj",
            "elemzes_alatt",
            "ai_eloelenorizve",
            "ember_felulvizsgalva",
            "javitasra_visszakuldve",
            "lezart"
          ]).nullable().optional(),
          progressStep: z8.string().nullable().optional(),
          retryCount: z8.number().nullable().optional(),
          planDocuments: z8.unknown().optional(),
          regulationSourceIds: z8.array(z8.number()).nullable().optional(),
          regulationDocumentKeys: z8.array(z8.string()).nullable().optional(),
          regulationDocumentNames: z8.array(z8.string()).nullable().optional(),
          results: z8.unknown().optional(),
          summary: z8.string().nullable().optional(),
          errorMessage: z8.string().nullable().optional(),
          createdAt: z8.union([z8.string(), z8.date()]).optional()
        })).default([]),
        knowledgeBaseDocuments: z8.array(z8.object({
          name: z8.string(),
          originalName: z8.string(),
          fileType: z8.string(),
          fileSize: z8.number(),
          s3Url: z8.string().default(""),
          s3Key: z8.string().default(""),
          extractedText: z8.string().nullable().optional(),
          description: z8.string().nullable().optional(),
          tags: z8.string().nullable().optional()
        })).default([]),
        searchQueries: z8.array(z8.object({
          question: z8.string().min(1),
          rewrittenQuestion: z8.string().nullable().optional(),
          searchMode: z8.enum(["mszt", "internal", "combined", "web", "combined_with_web"]).optional(),
          answerLength: z8.enum(["short", "standard", "detailed"]).optional(),
          operationMode: z8.enum(["fast", "accurate"]).optional(),
          answer: z8.string().nullable().optional(),
          extendedAnswer: z8.string().nullable().optional(),
          confidence: z8.enum(["low", "medium", "high"]).nullable().optional(),
          sources: z8.unknown().optional(),
          hasSufficientSources: z8.boolean().optional(),
          selfCheckPassed: z8.boolean().optional(),
          selfCheckNotes: z8.string().nullable().optional(),
          projectName: z8.string().nullable().optional()
        })).default([])
      }),
      includeAnalyses: z8.boolean().default(true),
      includeKnowledgeBase: z8.boolean().default(true),
      includeSearchQueries: z8.boolean().default(false),
      nameOverride: z8.string().min(1).max(255).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    const { data } = input;
    const projectName = input.nameOverride ?? data.project.name;
    const inserted = await db.insert(projects).values({
      name: projectName,
      description: data.project.description ?? null,
      discipline: data.project.discipline ?? "altalanos",
      workflowStatus: data.project.workflowStatus ?? "uj",
      ownerId: ctx.user.id
    });
    const newProjectId = inserted.insertId;
    if (!newProjectId) {
      throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "\xDAj projekt-ID nem siker\xFClt l\xE9trehozni." });
    }
    await db.insert(projectMembers).values({
      projectId: newProjectId,
      userId: ctx.user.id,
      role: "owner"
    });
    let analysesImported = 0;
    if (input.includeAnalyses) {
      for (const a of data.analyses) {
        try {
          await db.insert(analyses).values({
            title: a.title,
            projectId: newProjectId,
            userId: ctx.user.id,
            status: a.status ?? "completed",
            workflowStatus: a.workflowStatus ?? "uj",
            progressStep: a.progressStep ?? null,
            retryCount: a.retryCount ?? 0,
            planDocuments: a.planDocuments ?? [],
            regulationSourceIds: a.regulationSourceIds ?? [],
            regulationDocumentKeys: a.regulationDocumentKeys ?? [],
            regulationDocumentNames: a.regulationDocumentNames ?? [],
            results: a.results ?? null,
            summary: a.summary ?? null,
            errorMessage: a.errorMessage ?? null
          });
          analysesImported++;
        } catch (err) {
          console.error("[projects.import] analysis insert failed:", err);
        }
      }
    }
    let kbImported = 0;
    if (input.includeKnowledgeBase) {
      for (const d of data.knowledgeBaseDocuments) {
        try {
          await db.insert(knowledgeBaseDocuments).values({
            name: d.name,
            originalName: d.originalName,
            fileType: d.fileType,
            fileSize: d.fileSize,
            s3Url: d.s3Url,
            s3Key: d.s3Key,
            extractedText: d.extractedText ?? null,
            description: d.description ?? null,
            tags: d.tags ?? null,
            projectId: newProjectId
          });
          kbImported++;
        } catch (err) {
          console.error("[projects.import] kb insert failed:", err);
        }
      }
    }
    let searchesImported = 0;
    if (input.includeSearchQueries) {
      for (const s of data.searchQueries) {
        try {
          await db.insert(searchQueries).values({
            question: s.question,
            rewrittenQuestion: s.rewrittenQuestion ?? null,
            searchMode: s.searchMode ?? "combined",
            answerLength: s.answerLength ?? "standard",
            operationMode: s.operationMode ?? "accurate",
            answer: s.answer ?? null,
            extendedAnswer: s.extendedAnswer ?? null,
            confidence: s.confidence ?? null,
            sources: s.sources ?? null,
            hasSufficientSources: s.hasSufficientSources ?? true,
            selfCheckPassed: s.selfCheckPassed ?? true,
            selfCheckNotes: s.selfCheckNotes ?? null,
            userId: ctx.user.id,
            projectId: newProjectId,
            projectName
          });
          searchesImported++;
        } catch (err) {
          console.error("[projects.import] search insert failed:", err);
        }
      }
    }
    await auditLog({
      userId: ctx.user.id,
      userEmail: ctx.user.email ?? void 0,
      eventType: "project_import",
      resourceType: "project",
      resourceId: newProjectId,
      description: `Projekt import\xE1lva: ${projectName}`,
      metadata: {
        newProjectId,
        analysesImported,
        kbImported,
        searchesImported,
        requestedIncludes: {
          analyses: input.includeAnalyses,
          knowledgeBase: input.includeKnowledgeBase,
          searchQueries: input.includeSearchQueries
        }
      }
    });
    return {
      success: true,
      projectId: newProjectId,
      analysesImported,
      kbImported,
      searchesImported
    };
  })
});

// server/routers/audit.ts
import { z as z9 } from "zod";
import { and as and6, desc as desc6, eq as eq8, gte, sql as sql4 } from "drizzle-orm";
init_db();
init_schema();
var eventTypeFilter = z9.enum([
  "user_login",
  "user_logout",
  "document_upload",
  "document_delete",
  "document_view",
  "analysis_start",
  "analysis_complete",
  "analysis_error",
  "analysis_retry",
  "report_generate",
  "report_download",
  "regulation_source_add",
  "regulation_source_update",
  "regulation_source_delete",
  "regulation_source_sync",
  "credential_save",
  "credential_delete",
  "credential_test",
  "search_query",
  "knowledge_base_upload",
  "knowledge_base_delete",
  "project_create",
  "project_update",
  "project_archive",
  "project_export",
  "project_member_add",
  "project_member_remove",
  "project_member_change_role",
  "finding_status_change",
  "workflow_status_change"
]).optional();
var auditRouter = router({
  /**
   * List audit log entries with optional filters and pagination.
   * Returns the rows + a total count for the current filter set.
   */
  list: protectedProcedure.input(
    z9.object({
      limit: z9.number().int().min(1).max(200).default(50),
      offset: z9.number().int().min(0).default(0),
      eventType: eventTypeFilter,
      resourceType: z9.string().optional(),
      resourceId: z9.string().optional(),
      userId: z9.number().int().positive().optional(),
      sinceDays: z9.number().int().min(1).max(365).optional()
    }).optional()
  ).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { items: [], total: 0 };
    const limit = input?.limit ?? 50;
    const offset = input?.offset ?? 0;
    const conditions = [];
    if (input?.eventType) conditions.push(eq8(auditLogs.eventType, input.eventType));
    if (input?.resourceType) conditions.push(eq8(auditLogs.resourceType, input.resourceType));
    if (input?.resourceId) conditions.push(eq8(auditLogs.resourceId, input.resourceId));
    if (input?.userId !== void 0) conditions.push(eq8(auditLogs.userId, input.userId));
    if (input?.sinceDays !== void 0) {
      const cutoff = new Date(Date.now() - input.sinceDays * 24 * 60 * 60 * 1e3);
      conditions.push(gte(auditLogs.createdAt, cutoff));
    }
    const baseQuery = db.select().from(auditLogs);
    const filtered = conditions.length === 0 ? baseQuery : conditions.length === 1 ? baseQuery.where(conditions[0]) : baseQuery.where(and6(...conditions));
    const items = await filtered.orderBy(desc6(auditLogs.createdAt)).limit(limit).offset(offset);
    let total = items.length;
    try {
      const countQuery = db.select({ n: sql4`count(*)` }).from(auditLogs);
      const countFiltered = conditions.length === 0 ? countQuery : conditions.length === 1 ? countQuery.where(conditions[0]) : countQuery.where(and6(...conditions));
      const countRows = await countFiltered;
      total = Number(countRows[0]?.n ?? items.length);
    } catch {
    }
    return { items, total };
  }),
  /**
   * Aggregate event counts by eventType in the last `sinceDays` days (default 30).
   * Useful for a small dashboard widget.
   */
  summary: protectedProcedure.input(z9.object({ sinceDays: z9.number().int().min(1).max(365).default(30) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const sinceDays = input?.sinceDays ?? 30;
    const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1e3);
    try {
      const rows = await db.select({ eventType: auditLogs.eventType, count: sql4`count(*)` }).from(auditLogs).where(gte(auditLogs.createdAt, cutoff)).groupBy(auditLogs.eventType).orderBy(desc6(sql4`count(*)`));
      return rows.map((r) => ({ eventType: r.eventType, count: Number(r.count) }));
    } catch (err) {
      console.error("[audit.summary] error:", err);
      return [];
    }
  }),
  /**
   * Distinct resource types currently present in the log — feeds the filter dropdown.
   */
  resourceTypes: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    try {
      const rows = await db.selectDistinct({ resourceType: auditLogs.resourceType }).from(auditLogs);
      return rows.map((r) => r.resourceType).filter((r) => !!r).sort();
    } catch {
      return [];
    }
  })
});

// server/routers/searchSettings.ts
import { z as z10 } from "zod";
import { TRPCError as TRPCError10 } from "@trpc/server";
import { eq as eq9 } from "drizzle-orm";
init_db();
init_schema();
var answerLengthEnum = z10.enum(["short", "standard", "detailed"]);
var operationModeEnum = z10.enum(["fast", "accurate"]);
var searchModeEnum = z10.enum(["mszt", "internal", "combined", "web", "combined_with_web"]);
var DEFAULTS = {
  answerLength: "standard",
  operationMode: "accurate",
  searchMode: "internal"
};
var searchSettingsRouter = router({
  /**
   * Get the current user's saved search settings, falling back to defaults
   * if no row exists yet.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { ...DEFAULTS, isCustom: false };
    const rows = await db.select().from(searchSettings).where(eq9(searchSettings.userId, ctx.user.id)).limit(1);
    const row = rows[0];
    if (!row) return { ...DEFAULTS, isCustom: false };
    return {
      answerLength: row.answerLength,
      operationMode: row.operationMode,
      searchMode: row.searchMode,
      isCustom: true
    };
  }),
  /**
   * Upsert the user's search settings. Any unspecified field keeps its previous
   * value (or the default if the row didn't exist).
   */
  upsert: protectedProcedure.input(
    z10.object({
      answerLength: answerLengthEnum.optional(),
      operationMode: operationModeEnum.optional(),
      searchMode: searchModeEnum.optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    const existingRows = await db.select().from(searchSettings).where(eq9(searchSettings.userId, ctx.user.id)).limit(1);
    const existing = existingRows[0];
    const next = {
      answerLength: input.answerLength ?? existing?.answerLength ?? DEFAULTS.answerLength,
      operationMode: input.operationMode ?? existing?.operationMode ?? DEFAULTS.operationMode,
      searchMode: input.searchMode ?? existing?.searchMode ?? DEFAULTS.searchMode
    };
    if (existing) {
      await db.update(searchSettings).set(next).where(eq9(searchSettings.userId, ctx.user.id));
    } else {
      await db.insert(searchSettings).values({
        userId: ctx.user.id,
        ...next
      });
    }
    return { success: true, ...next };
  }),
  /**
   * Reset settings to defaults (deletes the row).
   */
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    await db.delete(searchSettings).where(eq9(searchSettings.userId, ctx.user.id));
    return { success: true, ...DEFAULTS, isCustom: false };
  })
});

// server/routers/admin.ts
import { z as z11 } from "zod";
import { TRPCError as TRPCError11 } from "@trpc/server";
import { and as and7, desc as desc7, eq as eq10, isNotNull, sql as sql5 } from "drizzle-orm";
init_db();
init_schema();
var userRoleEnum = z11.enum(["user", "admin", "reviewer"]);
var adminRouter = router({
  /**
   * High-level system stats for the admin dashboard top widget.
   */
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    try {
      const [userCount] = await db.select({ n: sql5`count(*)` }).from(users);
      const [projectCount] = await db.select({ n: sql5`count(*)` }).from(projects).where(eq10(projects.status, "active"));
      const [analysisCount] = await db.select({ n: sql5`count(*)` }).from(analyses);
      const [kbCount] = await db.select({ n: sql5`count(*)` }).from(knowledgeBaseDocuments);
      const [regCount] = await db.select({ n: sql5`count(*)` }).from(regulationSources);
      const [searchCount] = await db.select({ n: sql5`count(*)` }).from(searchQueries);
      const [auditCount] = await db.select({ n: sql5`count(*)` }).from(auditLogs);
      let kbTrash = 0;
      let regTrash = 0;
      try {
        const [r] = await db.select({ n: sql5`count(*)` }).from(knowledgeBaseDocuments).where(isNotNull(knowledgeBaseDocuments.deletedAt));
        kbTrash = Number(r?.n ?? 0);
      } catch {
      }
      try {
        const [r] = await db.select({ n: sql5`count(*)` }).from(regulationSources).where(isNotNull(regulationSources.deletedAt));
        regTrash = Number(r?.n ?? 0);
      } catch {
      }
      return {
        users: Number(userCount?.n ?? 0),
        activeProjects: Number(projectCount?.n ?? 0),
        analyses: Number(analysisCount?.n ?? 0),
        knowledgeBaseDocs: Number(kbCount?.n ?? 0),
        regulationSources: Number(regCount?.n ?? 0),
        searchQueries: Number(searchCount?.n ?? 0),
        auditEvents: Number(auditCount?.n ?? 0),
        trash: { kb: kbTrash, regulations: regTrash }
      };
    } catch (err) {
      console.error("[admin.stats] error:", err);
      return null;
    }
  }),
  /**
   * List all users (workspace-wide). Returns minimal profile + role.
   */
  listUsers: adminProcedure.input(z11.object({ search: z11.string().optional() }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn
    }).from(users).orderBy(desc7(users.lastSignedIn));
    if (input?.search?.trim()) {
      const q = input.search.trim().toLowerCase();
      return rows.filter(
        (u) => (u.name?.toLowerCase().includes(q) ?? false) || (u.email?.toLowerCase().includes(q) ?? false)
      );
    }
    return rows;
  }),
  /**
   * Change a user's role. Admin-only. Cannot demote yourself if you'd be
   * the last admin remaining (protects against accidental lock-out).
   */
  changeUserRole: adminProcedure.input(z11.object({
    userId: z11.number().int().positive(),
    role: userRoleEnum
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    if (input.userId === ctx.user.id && input.role !== "admin") {
      const adminRows = await db.select({ id: users.id }).from(users).where(eq10(users.role, "admin"));
      if (adminRows.length <= 1) {
        throw new TRPCError11({
          code: "BAD_REQUEST",
          message: "Te vagy az utols\xF3 admin \u2014 el\u0151bb adj admin szerepk\xF6rt egy m\xE1sik felhaszn\xE1l\xF3nak."
        });
      }
    }
    await db.update(users).set({ role: input.role }).where(eq10(users.id, input.userId));
    return { success: true };
  }),
  /**
   * Workspace-wide projects (regardless of membership). Useful for the admin
   * who needs to inspect every project + see its owner.
   */
  listAllProjects: adminProcedure.input(z11.object({ includeDeleted: z11.boolean().default(false) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const includeDeleted = input?.includeDeleted ?? false;
    const baseQuery = db.select({
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
      memberCount: sql5`(SELECT COUNT(*) FROM ${projectMembers} WHERE ${projectMembers.projectId} = ${projects.id})`
    }).from(projects).leftJoin(users, eq10(projects.ownerId, users.id));
    const rows = includeDeleted ? await baseQuery.orderBy(desc7(projects.createdAt)) : await baseQuery.where(and7(eq10(projects.status, "active"))).orderBy(desc7(projects.createdAt));
    return rows.map((r) => ({ ...r, memberCount: Number(r.memberCount) }));
  }),
  /**
   * Empty trash — permanently deletes ALL soft-deleted regulationSources and
   * knowledgeBaseDocuments, plus their cached embeddings. Use with care.
   */
  emptyTrash: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    let kbDeleted = 0;
    let regDeleted = 0;
    try {
      const kbToDelete = await db.select({ id: knowledgeBaseDocuments.id }).from(knowledgeBaseDocuments).where(isNotNull(knowledgeBaseDocuments.deletedAt));
      const kbIds = kbToDelete.map((r) => r.id);
      if (kbIds.length > 0) {
        await db.delete(knowledgeBaseDocuments).where(isNotNull(knowledgeBaseDocuments.deletedAt));
        kbDeleted = kbIds.length;
      }
    } catch (err) {
      console.warn("[admin.emptyTrash] kb step failed:", err);
    }
    try {
      const regToDelete = await db.select({ id: regulationSources.id }).from(regulationSources).where(isNotNull(regulationSources.deletedAt));
      const regIds = regToDelete.map((r) => r.id);
      if (regIds.length > 0) {
        await db.delete(regulationSources).where(isNotNull(regulationSources.deletedAt));
        regDeleted = regIds.length;
      }
    } catch (err) {
      console.warn("[admin.emptyTrash] reg step failed:", err);
    }
    return { kbDeleted, regDeleted };
  })
});

// server/routers/notifications.ts
import { z as z12 } from "zod";
import { TRPCError as TRPCError12 } from "@trpc/server";
import { and as and8, desc as desc8, eq as eq11, sql as sql6 } from "drizzle-orm";
init_db();
init_schema();
var notificationsRouter = router({
  /**
   * List notifications for the current user. Default: all, newest first.
   * Optional `unreadOnly` for the dropdown.
   */
  list: protectedProcedure.input(z12.object({
    unreadOnly: z12.boolean().default(false),
    limit: z12.number().int().min(1).max(100).default(30)
  }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const limit = input?.limit ?? 30;
    const unreadOnly = input?.unreadOnly ?? false;
    try {
      const query = db.select().from(notifications);
      const filtered = unreadOnly ? query.where(and8(eq11(notifications.userId, ctx.user.id), eq11(notifications.isRead, false))) : query.where(eq11(notifications.userId, ctx.user.id));
      return filtered.orderBy(desc8(notifications.createdAt)).limit(limit);
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
      const rows = await db.select({ n: sql6`count(*)` }).from(notifications).where(and8(eq11(notifications.userId, ctx.user.id), eq11(notifications.isRead, false)));
      return { count: Number(rows[0]?.n ?? 0) };
    } catch {
      return { count: 0 };
    }
  }),
  /**
   * Mark a single notification as read. Only the owner can mark their own.
   */
  markRead: protectedProcedure.input(z12.object({ id: z12.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    await db.update(notifications).set({ isRead: true }).where(and8(eq11(notifications.id, input.id), eq11(notifications.userId, ctx.user.id)));
    return { success: true };
  }),
  /**
   * Mark all current-user notifications as read.
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    await db.update(notifications).set({ isRead: true }).where(and8(eq11(notifications.userId, ctx.user.id), eq11(notifications.isRead, false)));
    return { success: true };
  }),
  /**
   * Delete a single notification (clear from the list).
   */
  delete: protectedProcedure.input(z12.object({ id: z12.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "Adatb\xE1zis nem el\xE9rhet\u0151." });
    await db.delete(notifications).where(and8(eq11(notifications.id, input.id), eq11(notifications.userId, ctx.user.id)));
    return { success: true };
  })
});

// server/_core/systemRouter.ts
import { z as z13 } from "zod";
var systemRouter = router({
  health: publicProcedure.input(
    z13.object({
      timestamp: z13.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  }))
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    // Profil-lekérés: a context.ts most a better-auth session-ből tölti be a
    // user-t (LOCAL_DEV_USER_ID bypass-szal dev-ben).
    me: publicProcedure.query((opts) => opts.ctx.user),
    // Logout: a better-auth /api/auth/sign-out endpointja kezeli — ezt a
    // logout-route kliensoldalon közvetlenül hívjuk. A meglévő tRPC endpoint
    // backward-compat: szimplán signalozza a kliensnek, hogy a kliens-oldali
    // logout-call megtörtént. A session-cleanup a better-auth dolga.
    logout: publicProcedure.mutation(() => {
      return { success: true };
    })
  }),
  compliance: complianceRouter,
  pdf: pdfExportRouter,
  regulationSources: regulationSourcesRouter,
  platformCredentials: platformCredentialsRouter,
  standardsSearch: standardsSearchRouter,
  knowledgeBase: knowledgeBaseRouter,
  projects: projectsRouter,
  projectMembers: projectMembersRouter,
  audit: auditRouter,
  searchSettings: searchSettingsRouter,
  admin: adminRouter,
  notifications: notificationsRouter
  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

// server/_core/auth.ts
init_env();
init_schema();
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle as drizzle2 } from "drizzle-orm/mysql2";
var _authInstance = null;
var _authInitTried = false;
function getAuth() {
  if (_authInitTried) return _authInstance;
  _authInitTried = true;
  if (!ENV.databaseUrl) {
    console.warn("[auth] DATABASE_URL missing \u2014 better-auth disabled.");
    return null;
  }
  const secret = process.env.BETTER_AUTH_SECRET || ENV.cookieSecret;
  if (!secret) {
    console.warn("[auth] BETTER_AUTH_SECRET / JWT_SECRET missing \u2014 better-auth disabled.");
    return null;
  }
  try {
    const db = drizzle2(ENV.databaseUrl);
    const baseUrl = process.env.BETTER_AUTH_URL || `http://localhost:3000`;
    const options = {
      database: drizzleAdapter(db, {
        provider: "mysql",
        schema: {
          user: users,
          session: sessions,
          account: accounts,
          verification: verifications
        },
        usePlural: false
      }),
      secret,
      baseURL: baseUrl,
      basePath: "/api/auth",
      // Az ID-k INT autoincrement, nem UUID — a meglévő FK-k (analyses.userId
      // stb.) miatt fontos. better-auth `generateId: false` esetén nem
      // generál ID-t a kliens-oldalon, hagyja a DB-nek (auto-increment).
      advanced: {
        database: {
          generateId: false
        }
      },
      // Default user-fields a mi users-schema-nkat tükrözi. emailVerified +
      // image alapból ott vannak. A többi mező (openId, role, loginMethod,
      // lastSignedIn) marad app-specifikus és nem hat az auth-flow-ra.
      emailAndPassword: {
        enabled: false
        // Magic-link only — egyszerűbb UX, nincs jelszó-felejtés.
      },
      plugins: [
        magicLink({
          /**
           * Magic-link e-mail küldés.
           *  - Ha RESEND_API_KEY env be van állítva → Resend.send.
           *  - Egyébként console.log (dev / Resend nélküli prod), hogy a
           *    link a szerver-log-ból kimásolható legyen.
           */
          sendMagicLink: async ({ email, url }) => {
            const resendKey = process.env.RESEND_API_KEY;
            const fromAddr = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
            if (!resendKey) {
              console.info(`[auth] Magic link to ${email} (RESEND_API_KEY not set):
  ${url}
`);
              return;
            }
            try {
              const { Resend } = await import("resend");
              const resend = new Resend(resendKey);
              const { error } = await resend.emails.send({
                from: fromAddr,
                to: email,
                subject: "Bel\xE9p\xE9si link \u2013 Compliance Checker",
                html: `
<!doctype html>
<html lang="hu">
  <body style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 32px auto; padding: 0 16px; color: #161718;">
    <h2 style="color: #7CA9D3; font-weight: 700;">M M\xE9rn\xF6ki Iroda \u2014 Compliance Checker</h2>
    <p>Kattints az al\xE1bbi gombra a bel\xE9p\xE9shez. A link <strong>egyszer haszn\xE1lhat\xF3</strong> \xE9s <strong>5 perc</strong> m\xFAlva lej\xE1r.</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #7CA9D3; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Bel\xE9p\xE9s</a>
    </p>
    <p style="font-size: 12px; color: #6b7280;">Ha nem te k\xE9rted ezt a bel\xE9p\xE9st, hagyd figyelmen k\xEDv\xFCl ezt az e-mailt.</p>
    <p style="font-size: 12px; color: #6b7280; word-break: break-all;">Vagy m\xE1sold a b\xF6ng\xE9sz\u0151d c\xEDmsor\xE1ba: ${url}</p>
  </body>
</html>`
              });
              if (error) {
                console.error(`[auth] Resend hiba (${email}):`, error);
              }
            } catch (err) {
              console.error(`[auth] Resend kiv\xE9tel (${email}):`, err);
            }
          }
        })
      ],
      session: {
        expiresIn: 60 * 60 * 24 * 30,
        // 30 nap
        updateAge: 60 * 60 * 24
        // 1 napos session-token refresh
      }
    };
    _authInstance = betterAuth(options);
    return _authInstance;
  } catch (err) {
    console.error("[auth] init failed:", err);
    return null;
  }
}
async function handleAuthRequest(request) {
  const auth = getAuth();
  if (!auth) {
    return new Response(
      JSON.stringify({ error: "Auth not configured (DATABASE_URL or BETTER_AUTH_SECRET missing)" }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }
  return auth.handler(request);
}
async function getSessionFromHeaders(headers) {
  const auth = getAuth();
  if (!auth) return null;
  try {
    const session = await auth.api.getSession({ headers });
    if (!session?.user) return null;
    return { user: { id: Number(session.user.id) } };
  } catch {
    return null;
  }
}

// server/_core/demoAuth.ts
import crypto2 from "node:crypto";
var DEMO_COOKIE_NAME = "demo_session";
var TOKEN_VALUE = "demo";
function isDemoLoginEnabled() {
  return Boolean(process.env.DEMO_PASSWORD);
}
function demoUserEmail() {
  return process.env.DEMO_USER_EMAIL || "demo@compliance-checker.local";
}
function getSecret() {
  const pwd = process.env.DEMO_PASSWORD;
  if (!pwd) return null;
  return process.env.BETTER_AUTH_SECRET || pwd;
}
function sign(value, secret) {
  return crypto2.createHmac("sha256", secret).update(value).digest("hex");
}
function signDemoToken() {
  const secret = getSecret();
  if (!secret) return null;
  return `${TOKEN_VALUE}.${sign(TOKEN_VALUE, secret)}`;
}
function verifyDemoToken(token) {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const [value, sig] = token.split(".");
  if (value !== TOKEN_VALUE || !sig) return false;
  const expected = sign(TOKEN_VALUE, secret);
  try {
    return crypto2.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
function checkDemoPassword(candidate) {
  const expected = process.env.DEMO_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto2.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

// server/_core/context.ts
async function maybeLoadDevUser() {
  if (process.env.NODE_ENV === "production") return null;
  const idStr = process.env.LOCAL_DEV_USER_ID;
  if (!idStr) return null;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  try {
    const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq12 } = await import("drizzle-orm");
    const db = await getDb2();
    if (!db) return null;
    const rows = await db.select().from(users2).where(eq12(users2.id, id)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
async function maybeLoadDemoUser(req) {
  if (!isDemoLoginEnabled()) return null;
  const cookies = parseCookieHeader(req.headers.cookie);
  if (!verifyDemoToken(cookies[DEMO_COOKIE_NAME])) return null;
  try {
    const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq12 } = await import("drizzle-orm");
    const db = await getDb2();
    if (!db) return null;
    const email = demoUserEmail();
    const rows = await db.select().from(users2).where(eq12(users2.email, email)).limit(1);
    if (rows[0]) return rows[0];
    await db.insert(users2).values({
      email,
      name: "Demo felhaszn\xE1l\xF3",
      role: "admin",
      loginMethod: "demo"
    });
    const created = await db.select().from(users2).where(eq12(users2.email, email)).limit(1);
    return created[0] ?? null;
  } catch {
    return null;
  }
}
async function loadUserById(id) {
  try {
    const { getDb: getDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    const { users: users2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { eq: eq12 } = await import("drizzle-orm");
    const db = await getDb2();
    if (!db) return null;
    const rows = await db.select().from(users2).where(eq12(users2.id, id)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
function expressHeadersToFetch(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(name, v);
    } else {
      headers.set(name, String(value));
    }
  }
  return headers;
}
async function createContext(opts) {
  let user = null;
  try {
    const sessionInfo = await getSessionFromHeaders(expressHeadersToFetch(opts.req));
    if (sessionInfo?.user?.id) {
      user = await loadUserById(sessionInfo.user.id);
    }
  } catch {
    user = null;
  }
  if (!user) {
    user = await maybeLoadDemoUser(opts.req);
  }
  if (!user) {
    user = await maybeLoadDevUser();
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/app.ts
async function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/demo-enabled", (_req, res) => {
    res.json({ enabled: isDemoLoginEnabled() });
  });
  app.post("/api/demo-login", (req, res) => {
    if (!isDemoLoginEnabled()) {
      res.status(404).json({ error: "A demo-bel\xE9p\xE9s nincs enged\xE9lyezve." });
      return;
    }
    if (!checkDemoPassword(req.body?.password)) {
      res.status(401).json({ error: "Hib\xE1s demo-jelsz\xF3." });
      return;
    }
    const token = signDemoToken();
    if (!token) {
      res.status(500).json({ error: "A demo-session nem hozhat\xF3 l\xE9tre." });
      return;
    }
    res.cookie(DEMO_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1e3,
      // 7 nap
      path: "/"
    });
    res.json({ ok: true });
  });
  app.post("/api/demo-logout", (_req, res) => {
    res.clearCookie(DEMO_COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });
  app.all("/api/auth/*", async (req, res) => {
    try {
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (value == null) continue;
        if (Array.isArray(value)) {
          for (const v of value) headers.append(name, v);
        } else {
          headers.set(name, String(value));
        }
      }
      const body = ["GET", "HEAD"].includes(req.method) ? void 0 : JSON.stringify(req.body ?? {});
      const webRequest = new Request(url, {
        method: req.method,
        headers,
        body
      });
      const webResponse = await handleAuthRequest(webRequest);
      res.status(webResponse.status);
      webResponse.headers.forEach((value, key) => res.setHeader(key, value));
      const respBody = await webResponse.text();
      res.send(respBody);
    } catch (err) {
      console.error("[auth-handler] error:", err);
      res.status(500).json({ error: String(err) });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app;
}

// server/_core/vercelEntry.ts
var _appPromise = null;
async function getApp() {
  if (!_appPromise) {
    _appPromise = createApp();
  }
  return _appPromise;
}
async function handler(req, res) {
  const app = await getApp();
  const callable = app;
  return new Promise((resolve, reject) => {
    callable(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
var config = {
  maxDuration: 60
};
export {
  config,
  handler as default
};
