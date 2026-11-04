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
  conversations?: { index: number; title: string; at: string }[];
  previewHash?: string;
  error?: string;
};

export async function previewBotImport(formData: FormData): Promise<ImportPreview> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose your conversations.json export." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "That file is over 25MB. Export a smaller date range." };
  try {
    const raw = await file.text();
    const json = JSON.parse(raw);
    const previewHash = createHash("sha256").update(raw).digest("hex");
    const convs = parseChatGptExport(json).slice(0, MAX_IMPORT);
    if (convs.length === 0) return { ok: false, error: "No conversations found in that file." };
    return { ok: true, previewHash, count: convs.length, titles: convs.slice(0, 5).map((c) => c.title),
      conversations: convs.map((c, index) => ({ index, title: c.title, at: c.at })) };
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
  const expectedHash = formData.get("preview_hash");
  const digest = createHash("sha256").update(raw).digest("hex");
  if (typeof expectedHash !== "string" || expectedHash !== digest) {
    return { ok: false, error: "The export changed after preview. Review the file again before importing." };
  }

  // Only selected conversations enter the owner's memory. The indices refer
  // to the uploaded file we have just parsed, never to an arbitrary account.
  const rawSelection = formData.get("selected_indices");
  let selected: number[];
  if (rawSelection === null) {
    // A client must explicitly approve the exact conversation indices.
    // Never silently import everything when a form field is missing.
    return { ok: false, error: "Review and select conversations before importing." };
  } else {
    try {
      const decoded: unknown = JSON.parse(String(rawSelection));
      if (!Array.isArray(decoded) || decoded.length > MAX_IMPORT ||
          decoded.some(i => typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= convs.length))
        return { ok: false, error: "Select valid conversations from your preview." };
      selected = [...new Set(decoded as number[])].sort((a, b) => a - b);
    } catch { return { ok: false, error: "Select valid conversations from your preview." }; }
    if (selected.length === 0) return { ok: false, error: "Choose at least one conversation to import." };
  }

  const kernel = await getKernel();
  const bot = await loadBot(kernel);
  if (!bot.avatar) return { ok: false, error: "Set up your bot first." };
  const ownerId = bot.ownerId;

  // Skip if this exact file was already imported.
  const hash = createHash("sha256").update(raw).update("\\u0000").update(selected.join(",")).digest("hex");
  const recent = await kernel.readEvents(memoryScope(ownerId), { limit: 200 });
  const already = recent.some(
    (e) => e.type === "bot.import.completed" && (e.payload as Record<string, unknown>)?.hash === hash,
  );
  if (already) return { ok: true, imported: 0 };

  let imported = 0;
  const via = { client_id: "chatgpt-import", client_name: "ChatGPT import" };
  for (const index of selected) {
    const conv = convs[index];
    const mem = formatConversationMemory(conv);
    try {
      await noteMemory(kernel, ownerId, { text: mem.text, source: { kind: "import", title: mem.title } }, via);
      imported++;
    } catch {
      // One bad conversation doesn't stop the import.
    }
  }
  if (imported !== selected.length) {
    return { ok:false, imported, error:`Only ${imported} of ${selected.length} summaries were saved. Review your private memory before retrying.` };
  }
  await kernel.recordEvent({
    type: "bot.import.completed",
    scope: memoryScope(ownerId),
    payload: { hash, count: imported, selectedCount: selected.length, source: "chatgpt" },
  });
  return { ok: true, imported };
}
