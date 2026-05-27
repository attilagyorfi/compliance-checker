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
  // Új primary: OpenAI direkt API-kulcs.
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com",
  llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",

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
 * Az aktív LLM-provider chat-completion URL-je és bearer-tokenje.
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
