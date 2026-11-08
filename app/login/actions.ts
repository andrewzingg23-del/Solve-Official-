"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(formData.get("next"));

  if (!email) redirect(loginUrl({ next, error: "Enter your email address." }));

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString() },
  });

  if (error) redirect(loginUrl({ next, error: error.message }));
  redirect(loginUrl({ next, sent: email }));
}

// A one-time email code can be entered in the original browser or another device.
// This does not depend on the browser-local PKCE verifier used by magic links.
// Requires the staging Supabase Magic Link email template to include {{ .Token }}.
export async function verifyEmailCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim().replace(/\\s+/g, "");
  const next = safeNextPath(formData.get("next"));
  if (!email || !/^\\d{6,8}$/.test(token)) {
    redirect(loginUrl({ next, sent: email, error: "Enter the numeric code from your latest sign-in email." }));
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    redirect(loginUrl({ next, sent: email, error: "That code is invalid or expired. Request a new sign-in email and try again." }));
  }
  redirect(next);
}

function loginUrl(params: Record<string, string>) {
  return `/login?${new URLSearchParams(params)}`;
}


// Account sign-in is distinct from connecting a provider's data or tools to a SOV Project.
// Each social provider must be configured in the chosen Supabase Auth project.
export async function beginSocialSignIn(formData: FormData) {
  const requested = String(formData.get("provider") ?? "");
  const next = safeNextPath(formData.get("next"));
  if (requested !== "google" && requested !== "github") {
    redirect(loginUrl({ next, error: "Unsupported sign-in provider." }));
  }

  const h = await headers();
  const origin = h.get("origin") ?? (h.get("x-forwarded-proto") ?? "http") + "://" + h.get("host");
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: requested,
    options: { redirectTo: callback.toString() },
  });
  if (error || !data.url) redirect(loginUrl({ next, error: error?.message ?? "This provider is not configured yet." }));
  redirect(data.url);
}
