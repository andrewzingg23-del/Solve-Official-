"use server";

import { revalidatePath } from "next/cache";
import { forgetMemory, noteMemory, readConnections, readMemories, revokeConnection } from "@/lib/bot/memory";
import { botPulse, type Pulse } from "@/lib/bot/pulse";
import { loadBot, saveBot } from "@/lib/bot/store";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { createClient, getUser } from "@/lib/supabase/server";

export type SaveResult = { ok: true; version: number; savedAt: string | null } | { ok: false; error: "signed-out" | "identity" | "forbidden" | "unavailable" };

// Saves the signed-in person's bot. The persona is validated again inside saveBot; the request id
// makes a double-click or a retried request write one version, not two.
export async function saveBotAction(requestId: string, persona: unknown): Promise<SaveResult> {
  if (!(await getUser())) return { ok: false, error: "signed-out" };
  try {
    const bot = await saveBot(await getKernel(), persona, requestId);
    revalidatePath("/bot");
    return { ok: true, version: bot.history.length, savedAt: bot.saved?.at ?? null };
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") return { ok: false, error: "identity" };
    if (error instanceof KernelError && error.name === "forbidden") return { ok: false, error: "forbidden" };
    return { ok: false, error: "unavailable" };
  }
}

const field = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

// Disconnects an assistant: the kernel stops honoring it at once, and Supabase forgets the grant
// so it has to ask again.
export async function disconnectAction(formData: FormData) {
  const clientId = field(formData.get("client_id"));
  if (!clientId || !(await getUser())) return;
  const kernel = await getKernel();
  const me = await kernel.whoami();
  await revokeConnection(kernel, me.actor_id, clientId, field(formData.get("request_id")) || crypto.randomUUID());
  await (await createClient()).auth.oauth.revokeGrant({ clientId }).catch(() => null);
  revalidatePath("/bot");
}

// The person feeds their bot directly.
export async function addMemoryAction(formData: FormData) {
  if (!(await getUser())) return;
  const kernel = await getKernel();
  const me = await kernel.whoami();
  const source = { kind: "person", title: field(formData.get("title")) || null, url: field(formData.get("url")) || null };
  await noteMemory(kernel, me.actor_id, { text: field(formData.get("text")), source }, { client_id: null, client_name: null }).catch(() => null);
  revalidatePath("/bot");
}

// Erases a memory: its key is destroyed, so its words are gone for good.
export async function forgetMemoryAction(formData: FormData) {
  const memoryId = field(formData.get("memory_id"));
  if (!memoryId || !(await getUser())) return;
  const kernel = await getKernel();
  const me = await kernel.whoami();
  await forgetMemory(kernel, me.actor_id, memoryId).catch(() => null);
  revalidatePath("/bot");
}

// The bot's current mood and line, from its kernel records. Polled by the live card.
export async function pulseAction(): Promise<Pulse | null> {
  if (!(await getUser())) return null;
  try {
    const kernel = await getKernel();
    const bot = await loadBot(kernel);
    if (!bot.avatar) return null;
    const [memories, connections] = await Promise.all([readMemories(kernel, bot.ownerId), readConnections(kernel, bot.ownerId)]);
    return botPulse({ persona: bot.persona, since: bot.avatar.created_at, memories, connections, history: bot.history, now: new Date() });
  } catch {
    return null;
  }
}
