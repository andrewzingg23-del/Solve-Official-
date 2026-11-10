"use server";

import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { createClient, getUser } from "@/lib/supabase/server";

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const back = (id: string, error: string): never => redirect(`/oauth/consent?${new URLSearchParams({ authorization_id: id, error })}`);

// The person connects an app — Claude, ChatGPT, or any tool that signs in through Solve — as itself.
// The kernel makes the app its own agent (connect_app, 20261110070000) before Supabase issues the
// app its code, so from its first token the app holds nothing but what the person grants it, Space
// by Space. The app's identity comes from Supabase's record of this request, never from the form.
export async function approveConsentAction(formData: FormData) {
  const id = text(formData.get("authorization_id"));
  if (!id) redirect("/apps");
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const supabase = await createClient();
  const details = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (details.error || !details.data) back(id, "expired");
  if ("redirect_url" in details.data!) redirect(details.data.redirect_url);
  const client = details.data!.client;

  let failed = false;
  try {
    await (await getKernel()).connectApp(client.id, (client.name ?? "").trim().slice(0, 200) || "Connected app", `consent-${id}`);
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
  if (!id) redirect("/apps");
  const supabase = await createClient();
  const denied = await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (denied.error || !denied.data) redirect("/apps");
  redirect(denied.data!.redirect_url);
}
