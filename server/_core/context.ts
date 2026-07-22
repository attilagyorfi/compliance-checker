import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getSessionFromHeaders } from "./auth";
import {
  DEMO_COOKIE_NAME,
  demoUserEmail,
  isDemoLoginEnabled,
  parseCookieHeader,
  verifyDemoToken,
} from "./demoAuth";

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

/**
 * Demo-belépés — ha érvényes, aláírt demo-cookie érkezett, a kérés a közös
 * demo-userrel autentikáltnak számít. Csak akkor él, ha a DEMO_PASSWORD env be
 * van állítva (bemutató-környezet); éles üzemben egyszerűen nincs beállítva.
 *
 * A demo-usert az e-mail alapján keressük, és ha még nincs, létrehozzuk. A
 * szerepkör "admin", hogy a bemutatón minden funkció látszódjon.
 */
async function maybeLoadDemoUser(
  req: CreateExpressContextOptions["req"]
): Promise<User | null> {
  if (!isDemoLoginEnabled()) return null;
  const cookies = parseCookieHeader(req.headers.cookie);
  if (!verifyDemoToken(cookies[DEMO_COOKIE_NAME])) return null;

  try {
    const { getDb } = await import("../db");
    const { users } = await import("../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return null;

    const email = demoUserEmail();
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (rows[0]) return rows[0];

    await db.insert(users).values({
      email,
      name: "Demo felhasználó",
      role: "admin",
      loginMethod: "demo",
    });
    const created = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return created[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Load the full User row by id from the better-auth session lookup.
 */
async function loadUserById(id: number): Promise<User | null> {
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

/**
 * Convert an Express IncomingHttpHeaders to a fetch Headers object for
 * better-auth's getSession API.
 */
function expressHeadersToFetch(req: CreateExpressContextOptions["req"]): Headers {
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

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Primary: better-auth session
  try {
    const sessionInfo = await getSessionFromHeaders(expressHeadersToFetch(opts.req));
    if (sessionInfo?.user?.id) {
      user = await loadUserById(sessionInfo.user.id);
    }
  } catch {
    user = null;
  }

  // Demo-belépés (bemutató-környezet): aláírt demo-cookie → közös demo-user.
  if (!user) {
    user = await maybeLoadDemoUser(opts.req);
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
