"use server";

import { redirect } from "next/navigation";
import { approveConnection, type ConnectionMode } from "@/lib/bot/memory";
import { loadBot } from "@/lib/bot/store";
import { getKernel } from "@/lib/kernel/server";
import { createClient, getUser } from "@/lib/supabase/server";

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const back = (id: string, error: string): never => redirect(`/oauth/consent?${new URLSearchParams({ authorization_id: id, error })}`);

// The person lets this assistant speak as their bot. The client's identity comes from Supabase's
// record of this authorization request, never from the form; the kernel record of the connection
// is written before Supabase issues the assistant its code.
export async function approveConsentAction(formData: FormData) {
  const id = text(formData.get("authorization_id"));
  const mode: ConnectionMode = text(formData.get("mode")) === "remember" ? "remember" : "read";
  if (!id) redirect("/bot");
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const supabase = await createClient();
  const details = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (details.error || !details.data) back(id, "expired");
  if ("redirect_url" in details.data!) redirect(details.data.redirect_url);
  const client = details.data!.client;

  let failed: string | null = null;
  try {
    const kernel = await getKernel();
    const bot = await loadBot(kernel);
    if (!bot.avatar) failed = "no-bot";
    else await approveConnection(kernel, bot.ownerId, bot.avatar.agent_id, { clientId: client.id, clientName: client.name, mode }, `consent-${id}`);
  } catch {
    failed = "kernel";
  }
  if (failed) back(id, failed);

  const approved = await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true });
  if (approved.error || !approved.data) back(id, "expired");
  redirect(approved.data!.redirect_url);
}

export async function denyConsentAction(formData: FormData) {
  const id = text(formData.get("authorization_id"));
  if (!id) redirect("/bot");
  const supabase = await createClient();
  const denied = await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (denied.error || !denied.data) redirect("/bot");
  redirect(denied.data!.redirect_url);
}
