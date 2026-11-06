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
