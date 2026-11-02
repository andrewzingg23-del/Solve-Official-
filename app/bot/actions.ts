"use server";

import { ACCOUNT_CHANGED, requireDisplayedActor } from "@/lib/product/account-guard";
import type { FormResult } from "@/app/product/recoverable-form";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { buildReceipt, receiptSecret, receiptUrl, ReceiptError, signReceipt } from "@/lib/bot/receipt";
import { forgetMemory, noteMemory, readConnections, readMemories, revokeConnection } from "@/lib/bot/memory";
import { botPulse, type Pulse } from "@/lib/bot/pulse";
import { loadBot, saveBot } from "@/lib/bot/store";
import { setBotAccess, startWorld, WorldInputError, worldScope, type WorldAccess } from "@/lib/bot/worlds";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Persona } from "@/lib/bot/persona";

export type SaveResult = { ok: true; version: number; savedAt: string | null; persona: Persona } | { ok: false; error: "signed-out" | "identity" | "forbidden" | "conflict" | "unavailable" };

// Saves the signed-in person's bot. The persona is validated again inside saveBot; the request id
// makes a double-click or a retried request write one version, not two.
export async function saveBotAction(requestId: string, persona: unknown, expectedOwnerId: string): Promise<SaveResult> {
  if (!(await getUser())) return { ok: false, error: "signed-out" };
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, expectedOwnerId);
    const bot = await saveBot(kernel, persona, requestId);
    revalidatePath("/", "layout");
    return { ok: true, version: bot.history.length, savedAt: bot.saved?.at ?? null, persona: bot.persona };
  } catch (error) {
    if (error instanceof KernelError && error.name === "unauthenticated") return { ok: false, error: "identity" };
    if (error instanceof KernelError && error.name === "forbidden") return { ok: false, error: "forbidden" };
    if (error instanceof KernelError && error.name === "conflict") return { ok: false, error: "conflict" };
    return { ok: false, error: "unavailable" };
  }
}

const field = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

// Creates a private workspace from the avatar screen. The World service owns validation, duplicate
// protection, owner identity, and the avatar's add grant; this action only connects the form to
// that existing authority path.
export async function startWorldForBotAction(formData: FormData) {
  if (!(await getUser())) redirect("/login?next=%2Fbot");
  const title = field(formData.get("title"));
  let worldId: string | null = null;
  let errorCode: "invalid" | "identity" | "limit" | "unavailable" | null = null;
  try {
    const kernel = await getKernel();
    const bot = await loadBot(kernel);
    if (!bot.avatar) errorCode = "identity";
    else {
      const result = await startWorld(kernel, bot.avatar.agent_id, { title });
      worldId = result.world.worldId;
    }
  } catch (error) {
    if (error instanceof WorldInputError) errorCode = error.message.includes("already has") ? "limit" : "invalid";
    else errorCode = "unavailable";
  }
  if (errorCode) redirect(`/bot?world_error=${errorCode}`);
  if (!worldId) redirect("/bot?world_error=unavailable");
  revalidatePath("/bot");
  revalidatePath("/worlds");
  redirect(`/world/${worldId}`);
}

// Disconnects an assistant: the kernel stops honoring it at once, and Supabase forgets the grant
// so it has to ask again.
export async function disconnectAction(formData: FormData): Promise<FormResult> {
  const clientId = field(formData.get("client_id"));
  if (!clientId || !(await getUser())) return { ok: false, error: "Your session is unavailable. No connection was changed." };
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, field(formData.get("expectedActorId")));
    const me = await kernel.whoami();
    await revokeConnection(kernel, me.actor_id, clientId, field(formData.get("request_id")) || crypto.randomUUID());
    const { error } = await (await createClient()).auth.oauth.revokeGrant({ clientId });
    if (error) return { ok: false, error: "Solve access was revoked, but the sign-in authorization could not be removed. Retry to finish disconnecting." };
    revalidatePath("/bot");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof KernelError && error.name === "conflict" ? ACCOUNT_CHANGED : "The connection could not be fully revoked. Retry to confirm its status." };
  }
}

// The person feeds their bot directly.
export async function addMemoryAction(formData: FormData): Promise<FormResult> {
  if (!(await getUser())) return { ok: false, error: "Sign in again to save this knowledge. Your text is still here." };
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, field(formData.get("expectedActorId")));
    const me = await kernel.whoami();
    const source = { kind: "person", title: field(formData.get("title")) || null, url: field(formData.get("url")) || null };
    await noteMemory(kernel, me.actor_id, { text: field(formData.get("text")), source }, { client_id: null, client_name: null });
    revalidatePath("/bot");
    return { ok: true };
  } catch (error) { return { ok: false, error: error instanceof KernelError && error.name === "conflict" ? ACCOUNT_CHANGED : "Your knowledge couldn't be saved. Your text is still here; retry in a moment." }; }
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

const ACCESS: readonly string[] = ["none", "read", "add"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Lets the person's bot into one of their Worlds, changes what it may do there, or takes it out.
// The kernel refuses unless the person holds that access themselves (in practice: owns the World).
export async function setWorldAccessAction(formData: FormData) {
  const worldId = field(formData.get("world_id")).toLowerCase();
  const access = field(formData.get("access"));
  if (!UUID.test(worldId) || !ACCESS.includes(access) || !(await getUser())) return;
  const kernel = await getKernel();
  const bot = await loadBot(kernel);
  if (!bot.avatar) return;
  const requestId = field(formData.get("request_id")) || crypto.randomUUID();
  await setBotAccess(kernel, { scope: worldScope(worldId), botAgentId: bot.avatar.agent_id, access: access as WorldAccess }, requestId).catch(() => null);
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

export type ShareResult = { url: string } | { error: string } | null;

// Makes a receipt link for one of the person's own saves (lib/bot/receipt.ts): read with their
// own sign-in, signed by the server, and shown to them to share.
export async function shareSaveAction(_previous: ShareResult, formData: FormData): Promise<ShareResult> {
  const worldId = field(formData.get("world_id")).toLowerCase();
  const recordId = field(formData.get("record_id")).toLowerCase();
  if (!UUID.test(worldId) || !UUID.test(recordId) || !(await getUser())) return { error: "Sign in to share this save." };
  const secret = receiptSecret();
  if (!secret) return { error: "Sharing isn't switched on here yet." };
  try {
    const receipt = await buildReceipt(await getKernel(), worldId, recordId);
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return { url: receiptUrl(`${proto}://${host}`, signReceipt(receipt, secret)) };
  } catch (error) {
    if (error instanceof ReceiptError) return { error: `Not shared: ${error.message}.` };
    if (error instanceof KernelError) return { error: "This save can't be shared right now." };
    throw error;
  }
}


// Read-only check of recorded consent. It cannot claim a third-party app is online.
export async function checkConnectionsAction(expectedOwnerId: string): Promise<{ ok: boolean; message: string }> {
  if (!(await getUser())) return { ok: false, message: "Your session is unavailable. Reopen Profile before checking access." };
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, expectedOwnerId);
    const connections = await readConnections(kernel, expectedOwnerId);
    return { ok: true, message: connections.length ? `${connections.length} assistant authorization${connections.length === 1 ? " is" : "s are"} recorded. This checks saved permissions only; an end-to-end request from your assistant is still needed.` : "No assistant authorizations are recorded. The built-in room AI works separately from these connections." };
  } catch (error) {
    return { ok: false, message: error instanceof Error && error.message === ACCOUNT_CHANGED ? ACCOUNT_CHANGED : "We could not verify authorizations. No permissions were changed; retry shortly." };
  }
}
