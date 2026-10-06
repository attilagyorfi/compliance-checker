/**
 * Claude (Anthropic) chat-adapter — a hivatalos @anthropic-ai/sdk-val.
 *
 * Ugyanazt az `InvokeResult` alakot adja vissza, mint az OpenAI-út
 * (`invokeLLM`), így a hívók (standardsSearch, v2/search rerank, compliance)
 * VÁLTOZATLANUL működnek: továbbra is `resp.choices[0].message.content`-ot
 * olvasnak. A váltás csak az env-ben történik (ANTHROPIC_API_KEY + opcionálisan
 * LLM_PROVIDER / ANTHROPIC_MODEL).
 *
 * FONTOS: ez CSAK a chat. Az embedding az Anthropicon nem elérhető — az
 * továbbra is OpenAI (server/embeddings.ts + getLlmEmbeddingsConfig).
 */

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicChatConfig } from "./env";
import type { InvokeParams, InvokeResult, MessageContent } from "./llm";

let _client: Anthropic | null = null;
function getClient(apiKey: string): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

/** A jelenlegi flow-k szövegesek — a tartalmat sima szöveggé lapítjuk. */
function toText(content: MessageContent | MessageContent[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((p) => {
      if (typeof p === "string") return p;
      if (p.type === "text") return p.text;
      return ""; // kép/fájl: ezek a flow-k nem használják
    })
    .join("\n")
    .trim();
}

/** Ha a modell ```json ... ``` kódkeretbe csomagolná a JSON-t, lecsupaszítjuk. */
function stripJsonFences(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (m ? m[1] : t).trim();
}

export async function invokeAnthropic(params: InvokeParams): Promise<InvokeResult> {
  const cfg = getAnthropicChatConfig();
  if (!cfg) {
    throw new Error(
      "Nincs ANTHROPIC_API_KEY konfigurálva a Claude chat-hez. Állítsd be az ANTHROPIC_API_KEY env-változót."
    );
  }
  const client = getClient(cfg.apiKey);

  // A system üzenetek külön `system` mezőbe mennek (Anthropic), a többi
  // user/assistant turn a messages tömbbe.
  const systemParts: string[] = [];
  const msgs: Anthropic.MessageParam[] = [];
  for (const m of params.messages) {
    const text = toText(m.content);
    if (m.role === "system") {
      if (text) systemParts.push(text);
      continue;
    }
    if (m.role === "assistant") {
      msgs.push({ role: "assistant", content: text });
      continue;
    }
    // user / tool / function → user turn (ezek a flow-k nem futtatnak tool-loopot)
    msgs.push({ role: "user", content: text });
  }
  if (msgs.length === 0) msgs.push({ role: "user", content: "" });

  // JSON-kimenet (OpenAI response_format json_object / json_schema paritás):
  // a modellt a system-promptban kérjük tiszta JSON-ra, a kódkeretet lecsupaszítjuk.
  const rf = params.responseFormat || params.response_format;
  const wantsJson = Boolean(rf && (rf.type === "json_object" || rf.type === "json_schema"));
  if (wantsJson) {
    systemParts.push(
      "Kizárólag egyetlen érvényes JSON-objektummal válaszolj — minden egyéb szöveg, magyarázat és markdown kódkeret nélkül."
    );
  }

  const maxTokensEnv = Number(process.env.LLM_MAX_TOKENS);
  const max_tokens = Number.isFinite(maxTokensEnv) && maxTokensEnv > 0 ? maxTokensEnv : 8192;

  const resp = await client.messages.create({
    model: cfg.model,
    max_tokens,
    ...(systemParts.length ? { system: systemParts.join("\n\n") } : {}),
    messages: msgs,
  });

  // A text-blokkokat fűzzük össze (a thinking-blokkokat kihagyjuk).
  let text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (wantsJson) text = stripJsonFences(text);

  // OpenAI chat-completion alakra képezés — a hívók ezt várják.
  return {
    id: resp.id,
    created: Math.floor(Date.now() / 1000),
    model: resp.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: resp.stop_reason ?? null,
      },
    ],
    usage: {
      prompt_tokens: resp.usage.input_tokens ?? 0,
      completion_tokens: resp.usage.output_tokens ?? 0,
      total_tokens: (resp.usage.input_tokens ?? 0) + (resp.usage.output_tokens ?? 0),
    },
  };
}
