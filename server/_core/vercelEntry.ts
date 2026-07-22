/**
 * Vercel serverless belépési pont (bundle-forrás) — V11.18
 *
 * Az egész Express app-ot egy catch-all "[...path]" route-tal exportálja, így
 * minden /api/* kérés ide érkezik. A statikus frontend (dist/public) a Vercel
 * CDN-ről megy közvetlenül; a vercel.json `rewrites` szabályozza a szétosztást.
 *
 * FONTOS — miért itt van, és miért bundle-eljük:
 * a projekt ESM ("type": "module"), és a Vercel a TypeScript API-fájlt csak
 * lefordítja, de a `server/` alatti importált modulokat nem másolja a függvény
 * bundle-jébe. Emiatt futásidőben "ERR_MODULE_NOT_FOUND: Cannot find module
 * '/var/task/server/_core/app'" hibával állt le minden /api hívás. Ezért a
 * build (esbuild) ebből a fájlból EGYETLEN önálló JS-t készít az
 * `api/[...path].js` útvonalra, amely már minden szerver-kódot tartalmaz.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./app";

let _appPromise: Promise<import("express").Express> | null = null;

async function getApp() {
  if (!_appPromise) {
    _appPromise = createApp();
  }
  return _appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const app = await getApp();
  // Az Express app maga is egy (req, res, next) hívható handler, és a natív
  // Node IncomingMessage/ServerResponse objektumokkal is működik — a Vercel
  // pontosan ezeket adja át. A típus-cast azért kell, mert az Express
  // deklaráció a saját Request/Response típusait várja.
  const callable = app as unknown as (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void
  ) => void;
  return new Promise<void>((resolve, reject) => {
    callable(req, res, (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// A függvény időkorlátja a vercel.json `functions` blokkjában is szerepel.
export const config = {
  maxDuration: 60,
};
