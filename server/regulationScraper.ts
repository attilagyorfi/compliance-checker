/**
 * Regulation source scraper.
 * Fetches legal text from NJT (njt.hu), net.jogtar.hu, and other free sources.
 * For paid platforms (MSZT, Jogtár, Építésijog.hu), uses stored credentials.
 */

import * as cheerio from "cheerio";

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

    const sessionCookies = loginRes.headers.get("set-cookie") ?? "";
    // Symfony redirects to the target path (302) on success
    // On failure it redirects back to /login (also 302 but Location contains /login)
    const location = loginRes.headers.get("location") ?? "";
    const isSuccess = loginRes.status === 302 && !location.includes("/login");

    if (isSuccess) {
      return { success: true, sessionCookies: phpSessId + "; " + sessionCookies };
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
    const loginCookies = loginPageRes.headers.get("set-cookie") ?? "";

    const formData = new URLSearchParams();
    formData.append("email", username);
    formData.append("password", password);
    if (csrfToken) formData.append("_token", csrfToken);

    const loginRes = await fetch("https://uj.jogtar.hu/login", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": loginCookies,
        "Referer": "https://uj.jogtar.hu/login",
      },
      body: formData.toString(),
      redirect: "manual",
    });

    const sessionCookies = loginRes.headers.get("set-cookie") ?? "";
    const isSuccess = loginRes.status === 302 || sessionCookies.includes("session");

    if (isSuccess) {
      return { success: true, sessionCookies: loginCookies + "; " + sessionCookies };
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
    const loginCookies = loginPageRes.headers.get("set-cookie") ?? "";

    const formData = new URLSearchParams();
    formData.append("email", username);
    formData.append("password", password);
    if (csrfToken) formData.append("_token", csrfToken);

    const loginRes = await fetch("https://epitesijog.hu/belepes", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ComplianceChecker/1.0)",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": loginCookies,
        "Referer": "https://epitesijog.hu/belepes",
      },
      body: formData.toString(),
      redirect: "manual",
    });

    const sessionCookies = loginRes.headers.get("set-cookie") ?? "";
    const isSuccess = loginRes.status === 302 || sessionCookies.includes("session");

    if (isSuccess) {
      return { success: true, sessionCookies: loginCookies + "; " + sessionCookies };
    } else {
      return { success: false, error: "Bejelentkezés sikertelen – ellenőrizze a felhasználónevet és jelszót." };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
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
      // Attempt login and fetch
      let loginResult: PlatformLoginResult;
      if (sourceType === "mszt") loginResult = await loginToMszt(credentials.username, credentials.password);
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

// ── Simple encryption helpers ──────────────────────────────────────────────────
// Note: For production, use proper KMS. This is a simple XOR+base64 for the pilot.

const ENCRYPTION_KEY = process.env.JWT_SECRET ?? "compliance-checker-key-2024";

export function encryptPassword(plaintext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY);
  const data = Buffer.from(plaintext, "utf8");
  const encrypted = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    encrypted[i] = data[i]! ^ key[i % key.length]!;
  }
  return encrypted.toString("base64");
}

export function decryptPassword(encrypted: string): string {
  const key = Buffer.from(ENCRYPTION_KEY);
  const data = Buffer.from(encrypted, "base64");
  const decrypted = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    decrypted[i] = data[i]! ^ key[i % key.length]!;
  }
  return decrypted.toString("utf8");
}
