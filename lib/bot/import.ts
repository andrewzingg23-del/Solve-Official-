// "Bring your bots with you": parse a ChatGPT conversations.json export into
// conversations the bot can remember. Each conversation becomes one sealed
// memory (source kind "import") via noteMemory, so the bot's existing search
// finds them and forgetting erases them like any other memory.
//
// The export format: an array of conversations, each with a `mapping` of
// message nodes linked parent -> children. We walk from `current_node` back
// through parents to recover the conversation path in order.
import { cleanText, MEMORY_LIMITS } from "./memory";

export type ImportedMessage = { role: "user" | "assistant"; text: string };
export type ImportedConversation = {
  title: string;
  at: string; // ISO timestamp of the conversation start
  messages: ImportedMessage[];
};

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

const MAX_CONVERSATIONS = 500;
const MAX_MESSAGES_PER_CONVERSATION = 60;

function messageText(message: Record<string, unknown>): string | null {
  const author = record(message.author);
  const role = author.role;
  if (role !== "user" && role !== "assistant") return null;
  const parts = record(message.content).parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.filter((p): p is string => typeof p === "string").join("\n");
  const cleaned = cleanText(text, 500);
  return cleaned ? cleaned : null;
}

function conversationPath(mapping: Record<string, unknown>, currentNode: string): ImportedMessage[] {
  const out: ImportedMessage[] = [];
  const seen = new Set<string>();
  let id: unknown = currentNode;
  // Walk back to the root, then reverse for chronological order.
  const chain: string[] = [];
  while (typeof id === "string" && id && !seen.has(id)) {
    seen.add(id);
    chain.push(id);
    id = record(mapping[id]).parent;
  }
  for (const nodeId of chain.reverse()) {
    const node = record(mapping[nodeId]);
    const text = messageText(record(node.message));
    if (!text) continue;
    const role = record(record(node.message).author).role as "user" | "assistant";
    out.push({ role, text });
    if (out.length >= MAX_MESSAGES_PER_CONVERSATION) break;
  }
  return out;
}

export function parseChatGptExport(json: unknown): ImportedConversation[] {
  if (!Array.isArray(json)) throw new Error("Expected a JSON array of conversations");
  const out: ImportedConversation[] = [];
  for (const item of json.slice(0, MAX_CONVERSATIONS)) {
    const conv = record(item);
    const mapping = record(conv.mapping);
    const currentNode = typeof conv.current_node === "string" ? conv.current_node : "";
    if (!currentNode || Object.keys(mapping).length === 0) continue;
    const messages = conversationPath(mapping, currentNode);
    if (messages.length === 0) continue;
    const title = cleanText(conv.title, MEMORY_LIMITS.title) || "Untitled conversation";
    const createTime = typeof conv.create_time === "number" ? conv.create_time * 1000 : Date.now();
    out.push({ title, at: new Date(createTime).toISOString(), messages });
  }
  return out;
}

// One memory's worth of a conversation: title, date, and the transcript head.
// noteMemory truncates to MEMORY_LIMITS.text; the transcript is front-loaded
// so the opening (usually the topic) survives.
export function formatConversationMemory(conv: ImportedConversation): { text: string; title: string } {
  const lines = conv.messages.map((m) => `${m.role === "user" ? "You" : "Assistant"}: ${m.text}`);
  const date = conv.at.slice(0, 10);
  const text = `Imported conversation from ${date}.\n${lines.join("\n")}`;
  return { text: text.slice(0, MEMORY_LIMITS.text), title: `ChatGPT: ${conv.title}`.slice(0, MEMORY_LIMITS.title) };
}

export const IMPORT_LIMITS = { MAX_CONVERSATIONS, MAX_MESSAGES_PER_CONVERSATION } as const;
