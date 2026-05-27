/**
 * Better-auth konfiguráció — V11.13 M4
 *
 * A Manus OAuth (sdk.ts / oauth.ts) helyettese. Email + magic-link auth,
 * drizzle-adapter a meglévő users + új session/account/verification táblákon.
 *
 * Az `OPENAI_API_KEY`/`R2_*` mintát követve graceful: ha a kötelező env-ek
 * hiányoznak, az auth-helper exportál egy dummy-t ami nem omlik össze, csak
 * minden auth-kérés sikertelen. Lokálisan ettől még a `LOCAL_DEV_USER_ID`
 * bypass működik (lásd context.ts).
 */

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/mysql2";
import { ENV } from "./env";
import * as schema from "../../drizzle/schema";

// ── Provider helper ──────────────────────────────────────────────────────────

/**
 * Lazy-init the better-auth instance to avoid throwing at module import time
 * when DATABASE_URL or BETTER_AUTH_SECRET isn't set (tests, local dev pre-setup).
 */
let _authInstance: ReturnType<typeof betterAuth> | null = null;
let _authInitTried = false;

export function getAuth(): ReturnType<typeof betterAuth> | null {
  if (_authInitTried) return _authInstance;
  _authInitTried = true;

  if (!ENV.databaseUrl) {
    console.warn("[auth] DATABASE_URL missing — better-auth disabled.");
    return null;
  }
  const secret = process.env.BETTER_AUTH_SECRET || ENV.cookieSecret;
  if (!secret) {
    console.warn("[auth] BETTER_AUTH_SECRET / JWT_SECRET missing — better-auth disabled.");
    return null;
  }

  try {
    const db = drizzle(ENV.databaseUrl);
    const baseUrl = process.env.BETTER_AUTH_URL || `http://localhost:3000`;

    const options: BetterAuthOptions = {
      database: drizzleAdapter(db, {
        provider: "mysql",
        schema: {
          user: schema.users,
          session: schema.sessions,
          account: schema.accounts,
          verification: schema.verifications,
        },
        usePlural: false,
      }),
      secret,
      baseURL: baseUrl,
      basePath: "/api/auth",
      // Az ID-k INT autoincrement, nem UUID — a meglévő FK-k (analyses.userId
      // stb.) miatt fontos. better-auth `generateId: false` esetén nem
      // generál ID-t a kliens-oldalon, hagyja a DB-nek (auto-increment).
      advanced: {
        database: {
          generateId: false,
        },
      },
      // Default user-fields a mi users-schema-nkat tükrözi. emailVerified +
      // image alapból ott vannak. A többi mező (openId, role, loginMethod,
      // lastSignedIn) marad app-specifikus és nem hat az auth-flow-ra.
      emailAndPassword: {
        enabled: false, // Magic-link only — egyszerűbb UX, nincs jelszó-felejtés.
      },
      plugins: [
        magicLink({
          /**
           * Magic-link e-mail küldés. Production-ben SMTP/Resend integrációval
           * cserélendő. Most placeholder: console.log + audit-log entry, hogy
           * fejlesztés közben a linket a szerver-log-ból ki lehessen másolni.
           */
          sendMagicLink: async ({ email, url }) => {
            console.info(`[auth] Magic link to ${email}:\n  ${url}\n`);
            // TODO M5+: Resend / SMTP integráció itt.
          },
        }),
      ],
      session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 nap
        updateAge: 60 * 60 * 24, // 1 napos session-token refresh
      },
    };

    _authInstance = betterAuth(options);
    return _authInstance;
  } catch (err) {
    console.error("[auth] init failed:", err);
    return null;
  }
}

/**
 * Express request-handler az /api/auth/* route-okhoz.
 * Ha az auth nincs konfigurálva (lokál dev a setup előtt), 503-at ad vissza.
 */
export async function handleAuthRequest(
  request: Request,
): Promise<Response> {
  const auth = getAuth();
  if (!auth) {
    return new Response(
      JSON.stringify({ error: "Auth not configured (DATABASE_URL or BETTER_AUTH_SECRET missing)" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }
  return auth.handler(request);
}

/**
 * Belső kérésből session-lookup a context.ts-nek. Null-t ad vissza ha nincs
 * érvényes session vagy az auth nincs konfigurálva.
 */
export async function getSessionFromHeaders(
  headers: Headers,
): Promise<{ user: { id: number } } | null> {
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
