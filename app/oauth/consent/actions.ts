"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { approveConnection, type ConnectionMode } from "@/lib/bot/memory";
import { loadBot, saveBot } from "@/lib/bot/store";
import { getKernel } from "@/lib/kernel/server";
import { createClient, getUser } from "@/lib/supabase/server";

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const back = (id: string, error: string): never => redirect(`/oauth/consent?${new URLSearchParams({ authorization_id: id, error })}`);

// The person lets an assistant connect to their SOLVE, acting as their AI. The assistant's identity
// comes from Supabase's record of this authorization request, never from the form, and the kernel
// records the connection before Supabase issues the assistant its code.
//
// A person who has no AI companion yet gets one here, with the default persona: before the rebuild
// the only way to make one was a page that no longer exists, so new people could never connect.
export async function approveConsentAction(formData: FormData) {
  const id = text(formData.get("authorization_id"));
  const mode: ConnectionMode = text(formData.get("mode")) === "remember" ? "remember" : "read";
  if (!id) redirect("/control");
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const supabase = await createClient();
  const details = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (details.error || !details.data) back(id, "expired");
  if ("redirect_url" in details.data!) redirect(details.data.redirect_url);
  const client = details.data!.client;

  let failed = false;
  try {
    const kernel = await getKernel();
    let bot = await loadBot(kernel);
    if (!bot.avatar) {
      const requestId = createHash("sha256").update(`companion:${id}`).digest("hex").slice(0, 40);
      bot = await saveBot(kernel, {}, requestId);
    }
    if (!bot.avatar) failed = true;
    else await approveConnection(kernel, bot.ownerId, bot.avatar.agent_id, { clientId: client.id, clientName: client.name, mode }, `consent-${id}`);
  } catch {
    failed = true;
  }
  if (failed) back(id, "kernel");

  const approved = await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true });
  if (approved.error || !approved.data) back(id, "expired");
  redirect(approved.data!.redirect_url);
}

export async function denyConsentAction(formData: FormData) {
  const id = text(formData.get("authorization_id"));
  if (!id) redirect("/control");
  const supabase = await createClient();
  const denied = await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (denied.error || !denied.data) redirect("/control");
  redirect(denied.data!.redirect_url);
}
