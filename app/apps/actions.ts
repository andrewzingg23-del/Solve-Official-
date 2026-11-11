"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";

export type DisconnectResult = { ok: true } | { ok: false; error: string };

// Disconnect an app the person connected (an AI assistant, through SOLVE's connector). Supabase
// revokes the person's consent, deletes the app's sessions and invalidates its refresh tokens; the
// kernel refuses any app token whose session is gone (20261110080000), so it stops at once rather
// than when its last token expires.
export async function disconnectApp(clientId: string): Promise<DisconnectResult> {
  if (typeof clientId !== "string" || !/^[0-9a-f-]{36}$/i.test(clientId)) return { ok: false, error: "That app couldn't be found." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  // The kernel first: every grant the app's agent holds is revoked, and its tokens stop resolving at
  // once — even ones already issued. An app connected before per-app agents has no kernel connection.
  const kernel = await getKernel();
  const connected = (await kernel.myConnections().catch(() => [])).some(c => c.client_id === clientId && !c.disconnected_at);
  if (connected) {
    const cut = await kernel.disconnectApp(clientId, `disconnect-${clientId}-${Date.now()}`).then(() => true, () => false);
    if (!cut) return { ok: false, error: "It wasn't disconnected. Try again; nothing else changed." };
  }
  const { error } = await (await createClient()).auth.oauth.revokeGrant({ clientId });
  if (error && !connected) return { ok: false, error: "It wasn't disconnected. Try again; nothing else changed." };
  revalidatePath("/apps");
  return { ok: true };
}

export type ToolResult = { ok: true } | { ok: false; error: string };

// Let one connected AI app use the person's GitHub through Solve — or stop it. A kernel grant on the
// person's GitHub record and nothing broader; the app never sees the token itself.
export async function setToolUse(clientId: string, provider: "github", allow: boolean): Promise<ToolResult> {
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const kernel = await getKernel();
    const person = (await kernel.whoami()).actor_id;
    const app = (await kernel.myConnections()).find(c => c.client_id === clientId && !c.disconnected_at);
    if (!app) return { ok: false, error: "That app isn't connected any more." };
    const { providerScope, PROVIDER_USE } = await import("@/lib/product/credentials");
    const { setBotAccess } = await import("@/lib/bot/worlds");
    await setBotAccess(kernel, { scope: providerScope(person, provider), botAgentId: app.agent_id, access: allow ? "add" : "none", capabilities: PROVIDER_USE }, `tool-use:${provider}:${crypto.randomUUID()}`);
    revalidatePath("/apps");
    return { ok: true };
  } catch {
    return { ok: false, error: "That didn't change. Nothing else changed." };
  }
}

// Disconnect the person's GitHub: the sealed tokens are dropped from their record at once, and
// Solve's authorization is revoked at GitHub too, where GitHub allows it.
export async function disconnectTool(provider: "github"): Promise<ToolResult> {
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const kernel = await getKernel();
    const person = (await kernel.whoami()).actor_id;
    const { readProvider, writeProvider, unseal } = await import("@/lib/product/credentials");
    const { githubConfig } = await import("@/lib/product/providers/github");
    const current = await readProvider(kernel, person, provider);
    if (!current) return { ok: true };
    const config = githubConfig();
    if (config && current.sealed) {
      const { accessToken } = unseal<{ accessToken: string }>(current.sealed);
      await fetch(`https://api.github.com/applications/${config.clientId}/grant`, {
        method: "DELETE", headers: { Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`, Accept: "application/vnd.github+json", "User-Agent": "Solve" },
        body: JSON.stringify({ access_token: accessToken }), signal: AbortSignal.timeout(10000),
      }).catch(() => null);
    }
    await writeProvider(kernel, person, provider, current, { account: current.account, status: "disconnected", secret: null }, `tool-off:${crypto.randomUUID()}`);
    revalidatePath("/apps");
    return { ok: true };
  } catch {
    return { ok: false, error: "It wasn't disconnected. Try again; nothing else changed." };
  }
}
