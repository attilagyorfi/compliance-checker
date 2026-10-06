/**
 * Környezeti változók — V11.13 (Manus-leválasztás után)
 *
 * A `forgeApi*` mezők backward-compatible módon maradnak — ha a régi Manus
 * env-ek beállítva, az LLM/embedding helperek azokat használják (legacy út).
 * Új deploy-okon az `openai*` mezők a primary path.
 */

export const ENV = {
  // App-szintű alapok
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // ── OAuth (legacy Manus + jövőbeli better-auth) ────────────────────────────
  appId: process.env.VITE_APP_ID ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",

  // ── LLM provider ────────────────────────────────────────────────────────────
  // CHAT: Anthropic (Claude) VAGY OpenAI. EMBEDDING: mindig OpenAI (az Anthropic
  // nem kínál embedding-API-t; a v2_embeddings VECTOR(1536) a text-embedding-3-small-hoz
  // kötött). A chat-provider a getChatProvider() alapján dől el.
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com",
  llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",

  // Anthropic (Claude) — a chat-hívásokhoz (átfogalmazás, strukturált válasz,
  // rerank, compliance). Az embeddinghez NEM használható.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",

  // Legacy Manus forge (még támogatott deploy-okra). Ha ez be van állítva ÉS az
  // openaiApiKey üres, a kód a forge-ot használja.
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

/**
 * Mely LLM-provider aktív? OpenAI ha az OPENAI_API_KEY van, különben (legacy)
 * Manus forge, különben null.
 */
export type LlmProvider = "openai" | "forge" | null;
export function getLlmProvider(): LlmProvider {
  if (ENV.openaiApiKey) return "openai";
  if (ENV.forgeApiKey && ENV.forgeApiUrl) return "forge";
  return null;
}

/**
 * A CHAT-hívások providere. Sorrend:
 *   1. LLM_PROVIDER env explicit felülírás ("anthropic" | "openai" | "forge"),
 *      ha az adott provider kulcsa megvan.
 *   2. Auto: ha van ANTHROPIC_API_KEY → anthropic; különben openai; különben forge.
 * Így a Claude-ra váltás = ANTHROPIC_API_KEY beállítása (a chat átvált), az
 * embedding viszont OpenAI-n marad (lásd getLlmEmbeddingsConfig). Ha a chaten
 * is OpenAI-t akarsz az Anthropic-kulcs mellett: LLM_PROVIDER=openai.
 */
export type ChatProvider = "anthropic" | "openai" | "forge" | null;
export function getChatProvider(): ChatProvider {
  const forced = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();
  if (forced === "anthropic") return ENV.anthropicApiKey ? "anthropic" : null;
  if (forced === "openai") return ENV.openaiApiKey ? "openai" : null;
  if (forced === "forge") return ENV.forgeApiKey && ENV.forgeApiUrl ? "forge" : null;
  if (ENV.anthropicApiKey) return "anthropic";
  if (ENV.openaiApiKey) return "openai";
  if (ENV.forgeApiKey && ENV.forgeApiUrl) return "forge";
  return null;
}

/** Az Anthropic chat-config (kulcs + modell), vagy null ha nincs kulcs. */
export function getAnthropicChatConfig(): { apiKey: string; model: string } | null {
  if (!ENV.anthropicApiKey) return null;
  return { apiKey: ENV.anthropicApiKey, model: ENV.anthropicModel };
}

/**
 * Az aktív LLM-provider chat-completion URL-je és bearer-tokenje (OpenAI/forge).
 * Null ha semmilyen provider nincs konfigurálva.
 */
export function getLlmChatConfig(): { url: string; apiKey: string; model: string } | null {
  const provider = getLlmProvider();
  if (provider === "openai") {
    const base = ENV.openaiBaseUrl.replace(/\/+$/, "");
    return { url: `${base}/v1/chat/completions`, apiKey: ENV.openaiApiKey, model: ENV.llmModel };
  }
  if (provider === "forge") {
    const base = ENV.forgeApiUrl.replace(/\/+$/, "");
    return { url: `${base}/v1/chat/completions`, apiKey: ENV.forgeApiKey, model: ENV.llmModel };
  }
  return null;
}

/**
 * Az aktív LLM-provider embeddings URL-je és bearer-tokenje.
 */
export function getLlmEmbeddingsConfig(): { url: string; apiKey: string; model: string } | null {
  const provider = getLlmProvider();
  if (provider === "openai") {
    const base = ENV.openaiBaseUrl.replace(/\/+$/, "");
    return { url: `${base}/v1/embeddings`, apiKey: ENV.openaiApiKey, model: ENV.embeddingModel };
  }
  if (provider === "forge") {
    const base = ENV.forgeApiUrl.replace(/\/+$/, "");
    return { url: `${base}/v1/embeddings`, apiKey: ENV.forgeApiKey, model: ENV.embeddingModel };
  }
  return null;
}
