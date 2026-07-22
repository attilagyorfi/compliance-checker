/**
 * Demo-belépés — V11.18
 *
 * A megrendelői bemutatóhoz: közös jelszóval, e-mail nélkül be lehet lépni az
 * online demóba. Csak akkor aktív, ha a `DEMO_PASSWORD` env be van állítva —
 * éles (fizetős) üzemben egyszerűen ne állítsuk be, és a funkció eltűnik.
 *
 * A session állapotmentes: egy HMAC-cal aláírt cookie, amit a szerver minden
 * kérésnél ellenőrizni tud. Serverless (Vercel) környezetben ez fontos, mert ott
 * nincs megosztott memória a függvény-példányok között.
 */

import crypto from "node:crypto";

export const DEMO_COOKIE_NAME = "demo_session";
const TOKEN_VALUE = "demo";

/** A demo-belépés csak akkor él, ha be van állítva jelszó. */
export function isDemoLoginEnabled(): boolean {
  return Boolean(process.env.DEMO_PASSWORD);
}

/** A demo-userhez tartozó e-mail (a DB-ben ezzel azonosítjuk). */
export function demoUserEmail(): string {
  return process.env.DEMO_USER_EMAIL || "demo@compliance-checker.local";
}

function getSecret(): string | null {
  const pwd = process.env.DEMO_PASSWORD;
  if (!pwd) return null;
  // Az auth-secret az elsődleges; ha nincs, a jelszóból származtatunk.
  return process.env.BETTER_AUTH_SECRET || pwd;
}

function sign(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

/** Aláírt demo-token előállítása (a cookie értéke). */
export function signDemoToken(): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return `${TOKEN_VALUE}.${sign(TOKEN_VALUE, secret)}`;
}

/** A cookie-ban kapott token ellenőrzése (időzítés-biztos összehasonlítással). */
export function verifyDemoToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;
  const [value, sig] = token.split(".");
  if (value !== TOKEN_VALUE || !sig) return false;
  const expected = sign(TOKEN_VALUE, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

/** A megadott jelszó ellenőrzése (időzítés-biztos). */
export function checkDemoPassword(candidate: unknown): boolean {
  const expected = process.env.DEMO_PASSWORD;
  if (!expected || typeof candidate !== "string") return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Egyszerű cookie-fejléc feldolgozás (nem használunk cookie-parser middleware-t). */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
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
