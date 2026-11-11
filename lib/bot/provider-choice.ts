// The conversational surface is one SOLVE experience with replaceable providers.
// The browser may select only these names; model IDs and credentials remain server-owned.
export type ChatProvider = "openrouter" | "openai";

export function selectChatProvider(value: unknown): ChatProvider | null {
  // Preserve existing callers: omitting provider remains OpenRouter.
  if (value === undefined || value === "openrouter") return "openrouter";
  if (value === "openai") return "openai";
  // Fail closed for malformed or unsupported provider names.
  return null;
}

export const CHAT_PROVIDER_OPTIONS: ReadonlyArray<{ id: ChatProvider; label: string }> = [
  { id: "openrouter", label: "Current AI" },
  { id: "openai", label: "OpenAI (GPT)" },
];
