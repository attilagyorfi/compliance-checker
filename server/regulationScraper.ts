/**
 * Regulation source scraper.
 * Fetches legal text from NJT (njt.hu), net.jogtar.hu, and other free sources.
 * For paid platforms (MSZT, Jogtár, Építésijog.hu), uses stored credentials.
 */

import * as cheerio from "cheerio";
import * as crypto from "crypto";

// ── Free source scrapers ───────────────────────────────────────────────────────

/**
 * Fetch regulation text from NJT (njt.hu).
 * The URL format is: https://njt.hu/jogszabaly/{year}-{number}-{type}-{version}
 */
export async function fetchFromNjt(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`NJT fetch failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return extractNjtText(html);
}

/**
 * Extract clean text from NJT HTML.
 */
function extractNjtText(html: string): string {
  const $ = cheerio.load(html);

  // Remove navigation, header, footer, scripts, styles
  $("nav, header, footer, script, style, .menu, .sidebar, .breadcrumb, .print-header").remove();
  $(".cookie-notice, .modal, .overlay, .popup").remove();

  // The main content is in the regulation body
  const mainContent = $(".jogszabaly-tartalom, #tartalom, .regulation-body, main, article").first();
  
  let text: string;
  if (mainContent.length > 0) {
    text = mainContent.text();
  } else {
    // Fallback: get all body text
    $("body").find("nav, header, footer, script, style").remove();
    text = $("body").text();
  }

  // Clean up whitespace
  return text
    .replace(/\t/g, " ")
    .replace(/[ ]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 200000); // limit to 200k chars
}

/**
 * Fetch regulation text from net.jogtar.hu.
 * URL format: https://net.jogtar.hu/jogszabaly?docid={docid}
 */
export async function fetchFromNetJogtar(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`net.jogtar.hu fetch failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return extractNetJogtarText(html);
}

/**
 * Extract clean text from net.jogtar.hu HTML.
 */
function extractNetJogtarText(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("nav, header, footer, script, style, .navigation, .sidebar, .ads").remove();
  $(".cookie-bar, .modal, .toolbar").remove();

  // Main content
  const mainContent = $(".jogszabaly, .law-content, #content, .content-body, main").first();
  
  let text: string;
  if (mainContent.length > 0) {
    text = mainContent.text();
  } else {
    $("body").find("nav, header, footer, script, style").remove();
    text = $("body").text();
  }

  return text
    .replace(/\t/g, " ")
    .replace(/[ ]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 200000);
}

/**
 * Fetch a PDF from a URL and return the buffer.
 */
export async function fetchPdfFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`PDF fetch failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Paid platform scrapers (credential-based) ─────────────────────────────────

export interface PlatformLoginResult {
  success: boolean;
  sessionCookies?: string;
  error?: string;
}

// ── Cookie header helpers ──────────────────────────────────────────────────────
// `Set-Cookie` response headers carry attributes (Path, HttpOnly, Expires, etc.)
// that must NOT appear in the corresponding `Cookie` request header — the request
// form only accepts `name=value` pairs joined by "; ". These helpers convert
// response cookies into request-header form and merge multiple cookie strings
// with later values overriding earlier ones by name.

/**
 * Convert one or more `Set-Cookie` response headers into a `Cookie` request
 * header value, stripping attributes and keeping only `name=value` pairs.
 */
export function cookieHeaderFromResponse(headers: Headers): string {
  const getSetCookie = (headers as { getSetCookie?: () => string[] }).getSetCookie?.bind(headers);
  let rawCookies: string[] = [];
  if (typeof getSetCookie === "function") {
    rawCookies = getSetCookie();
  } else {
    const single = headers.get("set-cookie");
    if (single) {
      // Split on ", " before a cookie name=value (avoids splitting Expires's comma).
      rawCookies = single.split(/,\s*(?=[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/);
    }
  }
  return rawCookies
    .map((c) => {
      const semi = c.indexOf(";");
      return (semi === -1 ? c : c.slice(0, semi)).trim();
    })
    .filter((c) => c.includes("="))
    .join("; ");
}

/**
 * Merge `Cookie` request header strings; later values override earlier ones by name.
 */
export function mergeCookies(...cookieStrings: string[]): string {
  const map = new Map<string, string>();
  for (const cookieStr of cookieStrings) {
    if (!cookieStr) continue;
    for (const part of cookieStr.split(/;\s*/)) {
      if (!part) continue;
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (name) map.set(name, part.slice(eq + 1).trim());
    }
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

/**
 * Attempt to log in to MSZT Online Szabványtár.
 * Returns session cookies on success.
 */
export async function loginToMszt(username: string, password: string): Promise<PlatformLoginResult> {
  // MSZT Szabványtár uses plain HTTP (Apache 2.2 / PHP 5.4 – no valid TLS from server-side Node)
  const BASE = "http://szabvanykonyvtar.mszt.hu";
  const TIMEOUT_MS = 15000;
  try {
    // Step 1: GET /login to obtain PHPSESSID + CSRF token
    const loginPageRes = await fetch(`${BASE}/login`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!loginPageRes.ok) {
      return { success: false, error: `Login oldal betöltése sikertelen: HTTP ${loginPageRes.status}` };
    }

    const loginHtml = await loginPageRes.text();
    const $ = cheerio.load(loginHtml);

    // MSZT uses Symfony security: field names are _username, _password, _csrf_token
    const csrfToken = $('input[name="_csrf_token"]').val() as string | undefined;
    // Collect session cookie (PHPSESSID)
    const setCookieHeader = loginPageRes.headers.get("set-cookie") ?? "";
    const phpSessMatch = setCookieHeader.match(/PHPSESSID=([^;]+)/);
    const phpSessId = phpSessMatch ? `PHPSESSID=${phpSessMatch[1]}` : "";

    if (!csrfToken) {
      return { success: false, error: "CSRF token nem található a bejelentkezési oldalon. Az MSZT oldal struktúrája megváltozott." };
    }

    // Step 2: POST to /login_check (Symfony security firewall endpoint)
    const formData = new URLSearchParams();
    formData.append("_username", username);
    formData.append("_password", password);
    formData.append("_csrf_token", csrfToken);
    formData.append("_target_path", "search");
    formData.append("login", "Bejelentkezés");

    const loginRes = await fetch(`${BASE}/login_check`, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": phpSessId,
        "Referer": `${BASE}/login`,
        "Origin": BASE,
      },
      body: formData.toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const newSessionCookies = cookieHeaderFromResponse(loginRes.headers);
    // Symfony redirects to the target path (302) on success
    // On failure it redirects back to /login (also 302 but Location contains /login)
    const location = loginRes.headers.get("location") ?? "";
    const isSuccess = loginRes.status === 302 && !location.includes("/login");

    if (isSuccess) {
      return { success: true, sessionCookies: mergeCookies(phpSessId, newSessionCookies) };
    } else {
      // Follow the redirect to check the actual error message on the login page
      // The MSZT server shows different messages for:
      //   1. Wrong credentials: standard login form with no special message
      //   2. Already logged in: "Sajnáljuk! Ezzel a felhasználónévvel már bejelentkezett valaki!"
      try {
        const redirectedRes = await fetch(location || `${BASE}/login`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Cookie": phpSessId,
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const redirectedHtml = await redirectedRes.text();
        if (redirectedHtml.includes("már bejelentkezett") || redirectedHtml.includes("Sajnáljuk")) {
          return { success: false, error: "Ez a fiók már be van jelentkezve egy másik munkamenetben. Az MSZT szerver 20 percenként automatikusan kijelentkeztet. Kérjük, várjon 20 percet, majd próbálja újra." };
        }
      } catch {
        // Ignore errors when following redirect for error detection
      }
      const errorMsg = location.includes("/login")
        ? "Hibás felhasználónév vagy jelszó."
        : `Bejelentkezés sikertelen (HTTP ${loginRes.status}).`;
      return { success: false, error: errorMsg };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Provide more helpful error messages for common failures
    let friendlyMsg = msg;
    if (msg.includes("timeout") || msg.includes("TimeoutError")) {
      friendlyMsg = "Kapcsolat időtúllépés – az MSZT szerver nem válaszolt 15 másodpercen belül.";
    } else if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      friendlyMsg = "Hálózati hiba – nem sikerült kapcsolódni az MSZT szerverhez. Ellenőrizze az internetkapcsolatot.";
    }
    return { success: false, error: `Kapcsolódási hiba: ${friendlyMsg}` };
  }
}

/**
 * Attempt to log in to Jogtár Premium (uj.jogtar.hu).
 */
export async function loginToJogtar(username: string, password: string): Promise<PlatformLoginResult> {
  try {
    const loginPageRes = await fetch("https://uj.jogtar.hu/login", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    const loginHtml = loginPageRes.ok ? await loginPageRes.text() : "";
    const $ = cheerio.load(loginHtml);
    const csrfToken = $('input[name="_token"], meta[name="csrf-token"]').attr("content") ??
                      $('input[name="_token"]').val() as string | undefined;
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
        "Referer": "https://uj.jogtar.hu/login",
      },
      body: formData.toString(),
      redirect: "manual",
    });

    const newSessionCookies = cookieHeaderFromResponse(loginRes.headers);
    const isSuccess = loginRes.status === 302 || newSessionCookies.includes("session");

    if (isSuccess) {
      return { success: true, sessionCookies: mergeCookies(initialCookies, newSessionCookies) };
    } else {
      return { success: false, error: "Bejelentkezés sikertelen – ellenőrizze a felhasználónevet és jelszót." };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Attempt to log in to Építésijog.hu.
 */
export async function loginToEpitesijog(username: string, password: string): Promise<PlatformLoginResult> {
  try {
    const loginPageRes = await fetch("https://epitesijog.hu/belepes", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    const loginHtml = loginPageRes.ok ? await loginPageRes.text() : "";
    const $ = cheerio.load(loginHtml);
    const csrfToken = $('input[name="_token"]').val() as string | undefined;
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
        "Referer": "https://epitesijog.hu/belepes",
      },
      body: formData.toString(),
      redirect: "manual",
    });

    const newSessionCookies = cookieHeaderFromResponse(loginRes.headers);
    const isSuccess = loginRes.status === 302 || newSessionCookies.includes("session");

    if (isSuccess) {
      return { success: true, sessionCookies: mergeCookies(initialCookies, newSessionCookies) };
    } else {
      return { success: false, error: "Bejelentkezés sikertelen – ellenőrizze a felhasználónevet és jelszót." };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Session cache (MSZT) ──────────────────────────────────────────────────────
// MSZT only allows one active session per account, so re-logging in for every
// `regulationSources.fetchContent` call wastes time and risks the "already
// logged in" race. A small in-memory TTL cache reuses a successful session
// for `MSZT_SESSION_TTL_MS` after login. The password-hash key invalidates
// the cache automatically if the user changes their password.

interface CachedSession {
  sessionCookies: string;
  expiresAt: number;
  passwordHash: string;
}

export const MSZT_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const msztSessionCache = new Map<string, CachedSession>();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * Generic session-cache wrapper. Returns a cached session if not expired and
 * the password hash matches; otherwise calls `loginFn` and caches the result.
 * Exported so unit tests can verify the caching logic without hitting the
 * network — pass in a Map and a fake login function.
 */
export async function withSessionCache(
  cache: Map<string, CachedSession>,
  ttlMs: number,
  username: string,
  password: string,
  loginFn: (u: string, p: string) => Promise<PlatformLoginResult>
): Promise<PlatformLoginResult> {
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
      passwordHash,
    });
  } else {
    cache.delete(username);
  }
  return result;
}

/**
 * Cached MSZT login. Use this from request flows (e.g. fetchRegulationText);
 * `platformCredentials.testConnection` should bypass the cache and call
 * `loginToMszt` directly to verify credentials freshly.
 */
export function getMsztSession(username: string, password: string): Promise<PlatformLoginResult> {
  return withSessionCache(msztSessionCache, MSZT_SESSION_TTL_MS, username, password, loginToMszt);
}

/**
 * Drop the cached MSZT session for `username`, or all entries if omitted.
 * Call after detecting a stale-cookie failure (e.g. 401 on content fetch).
 */
export function invalidateMsztSession(username?: string): void {
  if (username) msztSessionCache.delete(username);
  else msztSessionCache.clear();
}

// ── MSZT live search (V11+, experimental) ─────────────────────────────────────
// Performs a live keyword search against the MSZT Szabványtár, parses the
// results page, and returns a small list of standard hits. This is
// EXPERIMENTAL: MSZT exposes no documented search API, so the scraping is
// best-effort and feature-flagged off by default.
//
// Enable in production by setting `ENABLE_LIVE_MSZT_SEARCH=true`. Disabled
// callers receive an empty array and the search engine falls back to the
// existing DB-cached MSZT-imported sources.

export interface MsztSearchHit {
  documentName: string;
  url?: string;
  excerpt: string;
  relevanceScore?: number;
}

export function isMsztLiveSearchEnabled(): boolean {
  return (process.env.ENABLE_LIVE_MSZT_SEARCH ?? "").toLowerCase() === "true";
}

/**
 * Live MSZT search using stored credentials. Returns [] on any failure so the
 * caller can fall back gracefully. Uses the session cache to avoid re-login.
 */
export async function searchMsztLive(
  query: string,
  credentials: { username: string; password: string },
  topK = 5
): Promise<MsztSearchHit[]> {
  if (!isMsztLiveSearchEnabled()) return [];
  if (!query.trim()) return [];

  const BASE = "http://szabvanykonyvtar.mszt.hu";
  const TIMEOUT_MS = 15_000;

  try {
    const session = await getMsztSession(credentials.username, credentials.password);
    if (!session.success || !session.sessionCookies) return [];

    // Try the most likely search URL pattern; the login flow already sets
    // _target_path=search, suggesting `/search` is the canonical search page.
    const searchUrl = `${BASE}/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
        "Cookie": session.sessionCookies,
        "Referer": `${BASE}/search`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[MSZT live search] HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();

    // If we got redirected back to the login page (cookie expired despite cache),
    // invalidate and bail out.
    if (html.includes("_username") && html.includes("_password") && html.includes("_csrf_token")) {
      invalidateMsztSession(credentials.username);
      return [];
    }

    const $ = cheerio.load(html);

    // Try several plausible result selectors in order of specificity.
    // MSZT's actual markup is unknown to us at implementation time — the
    // surrounding caller treats no-hits and parser-confusion identically.
    const selectorCandidates = [
      ".search-result",
      ".standard-item",
      ".result-item",
      ".szabvany-item",
      ".search-results .item",
      "article",
      "tr.result",
    ];

    let hits: MsztSearchHit[] = [];
    for (const sel of selectorCandidates) {
      const elements = $(sel);
      if (elements.length === 0) continue;
      hits = elements.toArray().slice(0, topK).map((el) => {
        const $el = $(el);
        const linkEl = $el.find("a").first();
        const link = linkEl.attr("href");
        const url = link
          ? (link.startsWith("http") ? link : `${BASE}${link.startsWith("/") ? "" : "/"}${link}`)
          : undefined;
        const name = (linkEl.text() || $el.find("h1,h2,h3,h4,.title").first().text() || $el.text().slice(0, 200)).trim();
        const excerpt = $el.text().replace(/\s+/g, " ").trim().slice(0, 600);
        return {
          documentName: name || "MSZT találat",
          url,
          excerpt,
        } as MsztSearchHit;
      }).filter((h) => h.documentName.length > 0 && h.excerpt.length > 20);
      if (hits.length > 0) break;
    }

    return hits;
  } catch (err) {
    console.warn("[MSZT live search] error:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Main dispatcher ────────────────────────────────────────────────────────────

export type SourceType = "njt" | "netjogtar" | "eurlex" | "mszt" | "jogtar" | "epitesijog" | "pdf" | "url";

export interface FetchRegulationResult {
  text: string;
  fetchedAt: Date;
  warning?: string;
}

/**
 * Fetch regulation text from any supported source.
 */
export async function fetchRegulationText(
  sourceType: SourceType,
  url: string,
  credentials?: { username: string; password: string }
): Promise<FetchRegulationResult> {
  const fetchedAt = new Date();

  switch (sourceType) {
    case "njt":
      return { text: await fetchFromNjt(url), fetchedAt };

    case "netjogtar":
      return { text: await fetchFromNetJogtar(url), fetchedAt };

    case "url":
      // Generic URL – try HTML first, then PDF
      if (url.toLowerCase().endsWith(".pdf")) {
        const buf = await fetchPdfFromUrl(url);
        const { extractFromPdf } = await import("./documentExtractor");
        return { text: await extractFromPdf(buf), fetchedAt };
      } else {
        return { text: await fetchFromNjt(url), fetchedAt }; // reuse generic HTML extractor
      }

    case "mszt":
    case "jogtar":
    case "epitesijog":
      if (!credentials) {
        return {
          text: "",
          fetchedAt,
          warning: `A ${sourceType.toUpperCase()} platformhoz bejelentkezési adatok szükségesek. Kérjük, adja meg a hitelesítő adatokat a Beállítások / Platform-kapcsolatok menüpontban.`,
        };
      }
      // Attempt login and fetch (MSZT uses a TTL cache to avoid redundant logins)
      let loginResult: PlatformLoginResult;
      if (sourceType === "mszt") loginResult = await getMsztSession(credentials.username, credentials.password);
      else if (sourceType === "jogtar") loginResult = await loginToJogtar(credentials.username, credentials.password);
      else loginResult = await loginToEpitesijog(credentials.username, credentials.password);

      if (!loginResult.success) {
        return {
          text: "",
          fetchedAt,
          warning: `Bejelentkezés sikertelen: ${loginResult.error}`,
        };
      }

      // Fetch content with session cookies
      try {
        const contentRes = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
            "Cookie": loginResult.sessionCookies ?? "",
          },
        });
        const html = await contentRes.text();
        const $ = cheerio.load(html);
        $("nav, header, footer, script, style").remove();
        const text = $("body").text().replace(/\s{3,}/g, "\n").trim().slice(0, 200000);
        return { text, fetchedAt };
      } catch (err) {
        return {
          text: "",
          fetchedAt,
          warning: `Tartalom letöltése sikertelen: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

    case "eurlex":
      // EUR-Lex has a public API
      return { text: await fetchFromNjt(url), fetchedAt }; // HTML scraping works for EUR-Lex too

    case "pdf":
      return {
        text: "",
        fetchedAt,
        warning: "PDF forrás esetén töltse fel a fájlt manuálisan.",
      };

    default:
      return { text: "", fetchedAt, warning: "Ismeretlen forrástípus." };
  }
}

// ── Password encryption (AES-256-CBC) ──────────────────────────────────────────
// Key is derived from JWT_SECRET via scrypt; each encryption uses a random IV.
// Output format: "<base64 IV>:<base64 ciphertext>".
// For backward compatibility, decryptPassword falls back to the legacy XOR
// scheme when the input has no IV separator — so existing rows in the DB keep
// working until they are re-saved.

const SCRYPT_SALT = "compliance-checker-aes-salt-v1";

function getEncryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET ?? "compliance-checker-key-2024";
  return crypto.scryptSync(secret, SCRYPT_SALT, 32);
}

export function encryptPassword(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("base64") + ":" + encrypted.toString("base64");
}

export function decryptPassword(encrypted: string): string {
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

function decryptLegacyXor(encrypted: string): string {
  const ENCRYPTION_KEY = process.env.JWT_SECRET ?? "compliance-checker-key-2024";
  const key = Buffer.from(ENCRYPTION_KEY);
  const data = Buffer.from(encrypted, "base64");
  const decrypted = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i]! ^ key[i % key.length]!;
  }
  return decrypted.toString("utf8");
}
