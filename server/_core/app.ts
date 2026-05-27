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

export async function createApp(): Promise<Express> {
  const app = express();

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
