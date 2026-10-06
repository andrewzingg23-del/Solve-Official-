"use server";

import { createHash } from "node:crypto";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { parseChatGptExport, formatConversationMemory, type ImportedConversation } from "@/lib/bot/import";
import { memoryScope, noteMemory } from "@/lib/bot/memory";
import { loadBot } from "@/lib/bot/store";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_IMPORT = 100;

export type ImportPreview = {
  ok: boolean;
  count?: number;
  titles?: string[];
  error?: string;
};

export async function previewBotImport(formData: FormData): Promise<ImportPreview> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose your conversations.json export." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "That file is over 25MB. Export a smaller date range." };
  try {
    const json = JSON.parse(await file.text());
    const convs = parseChatGptExport(json).slice(0, MAX_IMPORT);
    if (convs.length === 0) return { ok: false, error: "No conversations found in that file." };
    return { ok: true, count: convs.length, titles: convs.slice(0, 5).map((c) => c.title) };
  } catch {
    return { ok: false, error: "That doesn't look like a ChatGPT export. It should be the conversations.json from Settings → Data controls → Export." };
  }
}

export type ImportResult = { ok: boolean; imported?: number; error?: string };

export async function confirmBotImport(formData: FormData): Promise<ImportResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose your conversations.json export." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "That file is over 25MB." };

  let convs: ImportedConversation[];
  let raw: string;
  try {
    raw = await file.text();
    convs = parseChatGptExport(JSON.parse(raw)).slice(0, MAX_IMPORT);
  } catch {
    return { ok: false, error: "Could not read that export." };
  }
  if (convs.length === 0) return { ok: false, error: "No conversations found." };

  const kernel = await getKernel();
  const bot = await loadBot(kernel);
  if (!bot.avatar) return { ok: false, error: "Set up your bot first." };
  const ownerId = bot.ownerId;

  // Skip if this exact file was already imported.
  const hash = createHash("sha256").update(raw).digest("hex");
  const recent = await kernel.readEvents(memoryScope(ownerId), { limit: 200 });
  const already = recent.some(
    (e) => e.type === "bot.import.completed" && (e.payload as Record<string, unknown>)?.hash === hash,
  );
  if (already) return { ok: true, imported: 0 };

  let imported = 0;
  const via = { client_id: "chatgpt-import", client_name: "ChatGPT import" };
  for (const conv of convs) {
    const mem = formatConversationMemory(conv);
    try {
      await noteMemory(kernel, ownerId, { text: mem.text, source: { kind: "import", title: mem.title } }, via);
      imported++;
    } catch {
      // One bad conversation doesn't stop the import.
    }
  }
  await kernel.recordEvent({
    type: "bot.import.completed",
    scope: memoryScope(ownerId),
    payload: { hash, count: imported, source: "chatgpt" },
  });
  return { ok: true, imported };
}
