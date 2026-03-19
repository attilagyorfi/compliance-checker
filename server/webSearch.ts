/**
 * Web Search Module
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides internet-based search for engineering standards and regulations.
 * Uses DuckDuckGo HTML search (no API key required) + page content extraction.
 *
 * Strategy:
 *  1. Build a focused query (e.g. "MSZ EN 1990 teherbírás site:njt.hu OR site:mszt.hu")
 *  2. Fetch DuckDuckGo HTML results → extract top N result URLs + snippets
 *  3. For each URL, attempt to fetch and extract text (cheerio-based)
 *  4. Return results as SearchSource[] compatible with the existing answer pipeline
 */

import * as cheerio from "cheerio";
import type { SearchSource } from "../drizzle/schema";

// ── Constants ──────────────────────────────────────────────────────────────────

const DDG_URL = "https://html.duckduckgo.com/html/";
const MAX_RESULTS = 6;
const FETCH_TIMEOUT_MS = 8000;
const MAX_CONTENT_CHARS = 3000;

// Trusted Hungarian + EU engineering/legal domains to prioritize
const TRUSTED_DOMAINS = [
  "njt.hu",
  "net.jogtar.hu",
  "epitesijog.hu",
  "mszt.hu",
  "e-epites.hu",
  "mmk.hu",
  "katasztrofavedelem.hu",
  "mnb.hu",
  "eur-lex.europa.eu",
  "eurocodes.jrc.ec.europa.eu",
  "iso.org",
  "cen.eu",
];

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  fullText?: string;
}

// ── DuckDuckGo search ──────────────────────────────────────────────────────────

/**
 * Search DuckDuckGo HTML endpoint and return raw results.
 */
async function searchDuckDuckGo(query: string): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({ q: query, kl: "hu-hu" });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${DDG_URL}?${params}`, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[WebSearch] DuckDuckGo returned ${response.status}`);
      return [];
    }

    const html = await response.text();
    return parseDuckDuckGoResults(html);
  } catch (err) {
    clearTimeout(timeout);
    console.error("[WebSearch] DuckDuckGo fetch error:", err);
    return [];
  }
}

/**
 * Parse DuckDuckGo HTML results page.
 */
function parseDuckDuckGoResults(html: string): WebSearchResult[] {
  const $ = cheerio.load(html);
  const results: WebSearchResult[] = [];

  // DuckDuckGo HTML result structure: .result__body > .result__title + .result__snippet
  $(".result").each((_, el) => {
    const titleEl = $(el).find(".result__title a");
    const snippetEl = $(el).find(".result__snippet");
    const hrefRaw = titleEl.attr("href") ?? "";

    // DDG wraps URLs in redirect: /l/?uddg=<encoded>
    let url = "";
    try {
      if (hrefRaw.startsWith("/l/")) {
        const u = new URL("https://duckduckgo.com" + hrefRaw);
        url = decodeURIComponent(u.searchParams.get("uddg") ?? "");
      } else if (hrefRaw.startsWith("http")) {
        url = hrefRaw;
      }
    } catch {
      url = hrefRaw;
    }

    const title = titleEl.text().trim();
    const snippet = snippetEl.text().trim();

    if (url && title) {
      results.push({ title, url, snippet });
    }
  });

  return results.slice(0, MAX_RESULTS * 2); // fetch more, filter later
}

// ── Page content extraction ────────────────────────────────────────────────────

/**
 * Fetch a URL and extract readable text content.
 */
async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ComplianceChecker/1.0; +https://mmernoki.hu)",
        Accept: "text/html,application/xhtml+xml,text/plain",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return "";

    const contentType = response.headers.get("content-type") ?? "";

    // Skip binary files (PDF handled separately, images, etc.)
    if (
      contentType.includes("application/pdf") ||
      contentType.includes("image/") ||
      contentType.includes("application/zip")
    ) {
      return "";
    }

    const html = await response.text();
    return extractTextFromHtml(html, url);
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[WebSearch] Failed to fetch ${url}:`, (err as Error).message);
    return "";
  }
}

/**
 * Extract clean text from HTML using cheerio.
 */
function extractTextFromHtml(html: string, _url: string): string {
  const $ = cheerio.load(html);

  // Remove noise elements
  $("script, style, nav, header, footer, .nav, .header, .footer, .menu, .sidebar, .advertisement, .cookie, .gdpr").remove();

  // Try to find main content area
  const mainSelectors = ["main", "article", ".content", "#content", ".main-content", "#main", ".article-body", ".entry-content"];
  let text = "";

  for (const sel of mainSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      text = el.text();
      break;
    }
  }

  // Fallback: use body
  if (!text) {
    text = $("body").text();
  }

  // Normalize whitespace
  return text
    .replace(/\t/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CONTENT_CHARS);
}

// ── Score and rank results ─────────────────────────────────────────────────────

/**
 * Score a result based on domain trust and keyword relevance.
 */
function scoreResult(result: WebSearchResult, keywords: string[]): number {
  let score = 0;

  // Domain trust bonus
  try {
    const domain = new URL(result.url).hostname.replace("www.", "");
    if (TRUSTED_DOMAINS.some((d) => domain.includes(d))) {
      score += 3;
    }
  } catch {
    // ignore
  }

  // Keyword matches in title + snippet
  const combined = `${result.title} ${result.snippet}`.toLowerCase();
  for (const kw of keywords) {
    if (combined.includes(kw.toLowerCase())) score += 1;
  }

  return score;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Perform an internet search for engineering standards/regulations.
 * Returns SearchSource[] compatible with the existing answer pipeline.
 */
export async function webSearchStandards(
  query: string,
  fetchContent = true
): Promise<SearchSource[]> {
  // Build a focused engineering query
  const engineeringQuery = `${query} szabvány OR jogszabály OR rendelet OR MSZ OR EN OR ISO`;

  console.log(`[WebSearch] Searching: "${engineeringQuery}"`);

  const rawResults = await searchDuckDuckGo(engineeringQuery);

  if (rawResults.length === 0) {
    console.warn("[WebSearch] No results from DuckDuckGo");
    return [];
  }

  // Score and sort
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = rawResults
    .map((r) => ({ ...r, score: scoreResult(r, keywords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  // Optionally fetch full page content
  const sources: SearchSource[] = [];

  for (const result of scored) {
    let excerpt = result.snippet;

    if (fetchContent && result.url) {
      const fullText = await fetchPageText(result.url);
      if (fullText && fullText.length > 100) {
        // Find the most relevant excerpt
        const textLower = fullText.toLowerCase();
        let bestPos = 0;
        let bestScore = 0;

        for (const kw of keywords) {
          const pos = textLower.indexOf(kw);
          if (pos !== -1) {
            const localScore = keywords.filter((k) => textLower.includes(k)).length;
            if (localScore > bestScore) {
              bestScore = localScore;
              bestPos = pos;
            }
          }
        }

        const start = Math.max(0, bestPos - 150);
        const end = Math.min(fullText.length, bestPos + 600);
        const extracted = fullText.slice(start, end).replace(/\s+/g, " ").trim();
        if (extracted.length > 80) {
          excerpt = extracted;
        }
      }
    }

    sources.push({
      documentName: result.title,
      url: result.url,
      excerpt: excerpt || result.snippet,
      relevanceScore: result.score / (keywords.length + 3), // normalize
      sourceType: "web",
    });
  }

  return sources;
}

/**
 * Fetch content from a list of explicit URLs and return as SearchSource[].
 * Used when the user provides specific URLs instead of a DuckDuckGo search.
 */
export async function fetchUrlSources(
  urls: string[],
  query: string
): Promise<SearchSource[]> {
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const sources: SearchSource[] = [];

  for (const url of urls.slice(0, MAX_RESULTS)) {
    try {
      const fullText = await fetchPageText(url);
      if (!fullText || fullText.length < 50) continue;

      // Find the most relevant excerpt
      const textLower = fullText.toLowerCase();
      let bestPos = 0;
      let bestScore = 0;

      for (const kw of keywords) {
        const pos = textLower.indexOf(kw);
        if (pos !== -1) {
          const localScore = keywords.filter((k) => textLower.includes(k)).length;
          if (localScore > bestScore) {
            bestScore = localScore;
            bestPos = pos;
          }
        }
      }

      const start = Math.max(0, bestPos - 150);
      const end = Math.min(fullText.length, bestPos + 600);
      const excerpt = fullText.slice(start, end).replace(/\s+/g, " ").trim();

      // Try to get a nice title from the URL
      let title = url;
      try {
        const u = new URL(url);
        title = u.hostname.replace("www.", "") + u.pathname;
      } catch {
        // keep url as title
      }

      sources.push({
        documentName: title,
        url,
        excerpt: excerpt || fullText.slice(0, 500),
        relevanceScore: Math.min(1, (bestScore + 1) / (keywords.length + 1)),
        sourceType: "web",
      });
    } catch (err) {
      console.warn(`[WebSearch] Failed to fetch URL ${url}:`, (err as Error).message);
    }
  }

  return sources;
}
