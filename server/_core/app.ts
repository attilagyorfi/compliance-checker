/**
 * Express app factory — V11.13 M5
 *
 * Szétválasztva a `index.ts`-től, hogy ugyanazt az app-példányt fel lehessen
 * használni Vercel serverless function-ként ÉS lokál long-running szerverként.
 *
 * Lokál:    server/_core/index.ts → createApp().listen(port)
 * Vercel:   api/[...path].ts      → export default createApp()
 */

import "dotenv/config";
import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleAuthRequest } from "./auth";
import {
  DEMO_COOKIE_NAME,
  checkDemoPassword,
  isDemoLoginEnabled,
  signDemoToken,
} from "./demoAuth";

export async function createApp(): Promise<Express> {
  const app = express();

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── Állapot-diagnosztika ───────────────────────────────────────────────────
  // Deploy után ezzel derül ki gyorsan, hogy az adatbázis és a kulcsok
  // rendben vannak-e. SOHA nem ad vissza titkot (jelszót, kulcsot) — csak a
  // hosztnevet és darabszámokat.
  app.get("/api/health", async (_req, res) => {
    const out: Record<string, unknown> = {
      ok: true,
      nodeEnv: process.env.NODE_ENV ?? null,
      // Melyik deploy fut? Ha env-változót írtunk át, de ez a commit/idő nem
      // változik, akkor NEM történt újradeploy (a Vercelen az env csak új
      // deploynál lép életbe).
      vercelEnv: process.env.VERCEL_ENV ?? "(nem Vercel)",
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null,
      region: process.env.VERCEL_REGION ?? null,
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
      hasAuthSecret: Boolean(process.env.BETTER_AUTH_SECRET),
      demoLoginEnabled: isDemoLoginEnabled(),
    };
    const raw = process.env.DATABASE_URL;
    out.hasDatabaseUrl = Boolean(raw);
    if (raw) {
      try {
        const u = new URL(raw);
        out.dbHost = u.hostname; // jelszó/user nélkül
        out.dbName = u.pathname.replace(/^\//, "") || null;
      } catch {
        out.dbHost = "(értelmezhetetlen DATABASE_URL)";
      }
    }
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) {
        out.db = "nem elérhető (getDb null)";
      } else {
        const { sql } = await import("drizzle-orm");
        const r1: any = await db.execute(sql`SELECT COUNT(*) AS n FROM regulation_sources`);
        const r2: any = await db.execute(sql`SELECT COUNT(*) AS n FROM chunk_embeddings`);
        const pick = (r: any) => Number((Array.isArray(r) ? r[0] : r)?.[0]?.n ?? -1);
        out.db = "ok";
        out.regulationSources = pick(r1);
        out.chunkEmbeddings = pick(r2);
        try {
          const r3: any = await db.execute(
            sql`SELECT COUNT(*) AS n FROM chunk_embeddings WHERE embedding_vec IS NOT NULL`
          );
          out.vectorColumnRows = pick(r3);
        } catch {
          out.vectorColumnRows = "nincs embedding_vec oszlop";
        }
      }
    } catch (err) {
      out.ok = false;
      out.db = "hiba: " + String(err instanceof Error ? err.message : err).slice(0, 300);
    }
    res.json(out);
  });

  // ── Demo-belépés (csak ha a DEMO_PASSWORD env be van állítva) ──────────────
  // A megrendelői bemutatóhoz: közös jelszóval, e-mail nélkül lehet belépni.
  app.get("/api/demo-enabled", (_req, res) => {
    res.json({ enabled: isDemoLoginEnabled() });
  });

  app.post("/api/demo-login", (req, res) => {
    if (!isDemoLoginEnabled()) {
      res.status(404).json({ error: "A demo-belépés nincs engedélyezve." });
      return;
    }
    if (!checkDemoPassword(req.body?.password)) {
      res.status(401).json({ error: "Hibás demo-jelszó." });
      return;
    }
    const token = signDemoToken();
    if (!token) {
      res.status(500).json({ error: "A demo-session nem hozható létre." });
      return;
    }
    res.cookie(DEMO_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 nap
      path: "/",
    });
    res.json({ ok: true });
  });

  app.post("/api/demo-logout", (_req, res) => {
    res.clearCookie(DEMO_COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });

  // Better-auth handler (/api/auth/*) — Express → Web-Request adapter.
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
      const body = ["GET", "HEAD"].includes(req.method)
        ? undefined
        : JSON.stringify(req.body ?? {});
      const webRequest = new Request(url, {
        method: req.method,
        headers,
        body,
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

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
