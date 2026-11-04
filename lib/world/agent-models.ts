// Server-owned model roster for a World conversation. Adding a model never
// grants it tool access or World membership; this is read-only chat inference.
// Only configured, known providers can receive shared World context.
import {
  buildChatCompletionBody,
  completeChat,
  type ChatCompletionResult,
} from "../bot/openrouter";

export type RoomAgentProvider = "openrouter" | "openai" | "anthropic" | "meta";
export type RoomAgentOption = {
  id: string;
  label: string;
  provider: RoomAgentProvider;
  model: string;
  configured: boolean; // key present, NOT a tested live connection
};
type Env = Record<string, string | undefined>;
type ModelDefinition = Omit<RoomAgentOption, "configured">;

const PROVIDERS: RoomAgentProvider[] = ["openrouter", "openai", "anthropic", "meta"];
const ID = /^[a-z][a-z0-9_-]{0,31}$/;
const MODEL = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/;

function providerKey(provider: RoomAgentProvider, env: Env): string | undefined {
  const key = provider === "openrouter" ? env.OPENROUTER_API_KEY :
    provider === "openai" ? env.OPENAI_API_KEY :
    provider === "anthropic" ? env.ANTHROPIC_API_KEY :
    (env.MODEL_API_KEY || env.META_API_KEY);
  return key?.trim() || undefined;
}

/** Extra models are declared by a trusted deployment owner, not the browser.
 * Example: SOLVE_ROOM_AGENTS_JSON=[{"id":"qwen","label":"Qwen","provider":"openrouter","model":"qwen/qwen3"}]
 * There are no user-controlled endpoints or credentials in this catalog.
 */
export function extraRoomAgents(env: Env = process.env): ModelDefinition[] {
  const raw = env.SOLVE_ROOM_AGENTS_JSON;
  if (!raw || raw.length > 6000) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set(["solve", "chatgpt", "claude", "muse"]);
    const result: ModelDefinition[] = [];
    for (const entry of parsed.slice(0, 12)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== "string" || !ID.test(e.id) || seen.has(e.id) ||
          typeof e.label !== "string" || !e.label.trim() || e.label.length > 48 ||
          typeof e.model !== "string" || !MODEL.test(e.model) ||
          !PROVIDERS.includes(e.provider as RoomAgentProvider)) continue;
      seen.add(e.id);
      result.push({ id: e.id, label: e.label.trim(), provider: e.provider as RoomAgentProvider, model: e.model });
    }
    return result;
  } catch {
    return [];
  }
}

export function listRoomAgents(env: Env = process.env): RoomAgentOption[] {
  const base: ModelDefinition[] = [
    { id: "solve", label: "SOLVE AI", provider: "openrouter",
      model: env.OPENROUTER_MODEL?.trim() || "anthropic/claude-haiku-4.5" },
    { id: "chatgpt", label: "OpenAI (ChatGPT models)", provider: "openai",
      model: env.SOLVE_OPENAI_MODEL?.trim() || "gpt-6-luna" },
    { id: "claude", label: "Claude", provider: "anthropic",
      model: env.SOLVE_CLAUDE_MODEL?.trim() || "claude-haiku-5-5" },
    { id: "muse", label: "Muse Spark (Meta)", provider: "meta",
      model: env.SOLVE_MUSE_MODEL?.trim() || "muse-spark-1.3" },
    ...extraRoomAgents(env),
  ];
  return base.map(a => ({ ...a, configured: !!providerKey(a.provider, env) }));
}

export function roomAgentById(id: string, env: Env = process.env): RoomAgentOption | null {
  return listRoomAgents(env).find(a => a.id === id) ?? null;
}

function providerFailure(status: number): Error {
  if (status === 401 || status === 403) return new Error("provider_auth");
  if (status === 402) return new Error("provider_funding");
  if (status === 429) return new Error("provider_rate_limit");
  return new Error("provider_http_" + status);
}

async function responseJson(url: string, key: string, headers: Record<string, string>, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw providerFailure(res.status);
  const data: unknown = await res.json().catch(() => null);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("provider_invalid_response");
  return data as Record<string, unknown>;
}

function usageCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0;
}

function completionFromOpenAI(data: Record<string, unknown>): ChatCompletionResult {
  const output = Array.isArray(data.output) ? data.output : [];
  const fragments: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" &&
          (part as { type?: unknown }).type === "output_text" &&
          typeof (part as { text?: unknown }).text === "string") {
        fragments.push((part as { text: string }).text);
      }
    }
  }
  const reply = fragments.join("\n").trim() ||
    (typeof data.output_text === "string" ? data.output_text.trim() : "");
  if (!reply) throw new Error("provider_empty_response");
  const usage = (data.usage && typeof data.usage === "object" ? data.usage : {}) as Record<string, unknown>;
  return { reply, inputTokens: usageCount(usage.input_tokens), outputTokens: usageCount(usage.output_tokens) };
}

function completionFromChat(data: Record<string, unknown>): ChatCompletionResult {
  const choice = Array.isArray(data.choices) ? data.choices[0] : null;
  const msg = choice && typeof choice === "object" ? (choice as { message?: { content?: unknown } }).message : null;
  const reply = typeof msg?.content === "string" ? msg.content.trim() : "";
  if (!reply) throw new Error("provider_empty_response");
  const usage = (data.usage && typeof data.usage === "object" ? data.usage : {}) as Record<string, unknown>;
  return { reply, inputTokens: usageCount(usage.prompt_tokens), outputTokens: usageCount(usage.completion_tokens) };
}

function completionFromAnthropic(data: Record<string, unknown>): ChatCompletionResult {
  const content = Array.isArray(data.content) ? data.content : [];
  const reply = content.filter(p => p && typeof p === "object" && (p as { type?: unknown }).type === "text")
    .map(p => (p as { text?: unknown }).text).filter((t): t is string => typeof t === "string").join("\n").trim();
  if (!reply) throw new Error("provider_empty_response");
  const usage = (data.usage && typeof data.usage === "object" ? data.usage : {}) as Record<string, unknown>;
  return { reply, inputTokens: usageCount(usage.input_tokens), outputTokens: usageCount(usage.output_tokens) };
}

export type WorldAgentReply = ChatCompletionResult & { model: string; agentId: string };

/** Inference only. No code execution, tools, file access or other authority. */
export async function completeRoomAgent(
  agentId: string,
  context: { system: string; sharedText: string },
  question: string,
  env: Env = process.env,
): Promise<WorldAgentReply> {
  const agent = roomAgentById(agentId, env);
  if (!agent) throw new Error("agent_not_allowed");
  const key = providerKey(agent.provider, env);
  if (!key) throw new Error("agent_not_configured");
  const prompt = "Shared World data (quoted JSON):\n" + context.sharedText +
    "\n\nQuestion from the requesting person:\n" + question;
  let completion: ChatCompletionResult;
  if (agent.provider === "openrouter") {
    completion = await completeChat(key, buildChatCompletionBody({
      model: agent.model, system: context.system, history: [], message: prompt, maxTokens: 1400,
    }));
  } else if (agent.provider === "openai") {
    const data = await responseJson("https://api.openai.com/v1/responses", key, {}, {
      model: agent.model, instructions: context.system, input: prompt,
      max_output_tokens: 1800, reasoning: { effort: "none" },
    });
    completion = completionFromOpenAI(data);
  } else if (agent.provider === "anthropic") {
    const data = await responseJson("https://api.anthropic.com/v1/messages", key, {
      "x-api-key": key, "anthropic-version": "2023-06-01",
    }, {
      model: agent.model, max_tokens: 1400, system: context.system,
      messages: [{ role: "user", content: prompt }],
    });
    completion = completionFromAnthropic(data);
  } else {
    const data = await responseJson("https://api.meta.ai/v1/chat/completions", key, {}, {
      model: agent.model, max_tokens: 1400,
      messages: [{ role: "developer", content: context.system }, { role: "user", content: prompt }],
    });
    completion = completionFromChat(data);
  }
  return { ...completion, model: agent.model, agentId: agent.id };
}
