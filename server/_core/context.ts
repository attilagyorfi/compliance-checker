import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * Local dev auth bypass — ha a LOCAL_DEV_USER_ID env változó be van állítva,
 * minden request az adott DB-userrel autentikáltnak látszik. Production-ben
 * SOSE használd. A flag csak NODE_ENV !== "production" mellett vehető figyelembe,
 * így prod build accidentally sem szivároghat be.
 */
async function maybeLoadDevUser(): Promise<User | null> {
  if (process.env.NODE_ENV === "production") return null;
  const idStr = process.env.LOCAL_DEV_USER_ID;
  if (!idStr) return null;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  try {
    const { getDb } = await import("../db");
    const { users } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Dev-only fallback: if no real auth and LOCAL_DEV_USER_ID is set, inject
  // that user. Strictly gated on NODE_ENV !== "production".
  if (!user) {
    user = await maybeLoadDevUser();
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
