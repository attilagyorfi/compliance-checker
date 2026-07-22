import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, analyses, InsertAnalysis, Analysis, ComplianceResult } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Kell-e TLS a kapcsolathoz?
 *
 * A felhő-szolgáltatók (TiDB Cloud, PlanetScale stb.) kötelező TLS-t várnak
 * ("Connections using insecure transport are prohibited"), a lokál Docker MySQL
 * viszont TLS nélkül fut. A hoszt alapján döntünk, kivéve ha az URL már
 * tartalmaz explicit ssl paramétert.
 */
function needsTls(url: string): boolean {
  if (/[?&]ssl=/.test(url)) return false; // az URL már rendelkezik róla
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = process.env.DATABASE_URL;
      if (needsTls(url)) {
        // A drizzle mysql2-drivere a callback-alapú poolt várja (nem a
        // mysql2/promise változatot) — belül maga promisify-ol.
        const mysql = await import("mysql2");
        const pool = mysql.default.createPool({
          uri: url,
          ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Analyses ──────────────────────────────────────────────────────────────────

export async function createAnalysis(data: InsertAnalysis): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(analyses).values(data);
  return (result[0] as any).insertId as number;
}

export async function getAnalysisById(id: number): Promise<Analysis | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
  return result[0];
}

export async function listAnalyses(filter?: { projectId?: number }): Promise<Analysis[]> {
  const db = await getDb();
  if (!db) return [];
  if (filter?.projectId !== undefined) {
    return db
      .select()
      .from(analyses)
      .where(eq(analyses.projectId, filter.projectId))
      .orderBy(desc(analyses.createdAt))
      .limit(50);
  }
  return db.select().from(analyses).orderBy(desc(analyses.createdAt)).limit(50);
}

export async function updateAnalysisStatus(
  id: number,
  status: Analysis["status"],
  extra?: { results?: ComplianceResult[]; summary?: string; errorMessage?: string; progressStep?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(analyses)
    .set({ status, ...extra })
    .where(eq(analyses.id, id));
}
