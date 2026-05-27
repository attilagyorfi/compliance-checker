/**
 * Vercel serverless function entry — V11.13 M5
 *
 * Az egész Express app-ot egy catch-all "[...path]" route-tal exportálja, így
 * minden /api/* (és bármely más Vercel-által ide route-olt) kérés ide érkezik.
 * A statikus frontend (dist/public) Vercel CDN-ről megy közvetlenül.
 *
 * A vercel.json `rewrites` szabályozza, hogy mit küld ide és mit a statikra.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/_core/app";

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
  // Az Express app(req, res) callable interface-t implementál
  return new Promise<void>((resolve, reject) => {
    app(req, res, (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Vercel function config — Pro plan-en 60s, Hobby-n 10s a default. A
// compliance-elemzés akár 90s-ig is tarthat, így maxDuration: 60 a maximum
// amit kérhetünk. SSE-stream-re ez kevés lehet — production-ben érdemes
// erre figyelni.
export const config = {
  maxDuration: 60,
};
