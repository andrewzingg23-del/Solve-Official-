"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/server";

// Signing in, and the one thing it must never do: lose what a guest already made.
//
// A guest is a real identity. The kernel keys a person to their auth subject (`register`, migration
// 20261102043153), so everything they hold — their Spaces, a connected GitHub, the grants they gave
// an AI — hangs off that one subject. Asking Supabase for a fresh sign-in mints a *new* subject,
// which strands all of it in the old browser session (BUILD-STREAM.md, 2026-11-11: a guest held a
// live GitHub token and an AI's write access).
//
// So a guest adding their email *keeps their subject*: `updateUser` makes the same user permanent.
// Nothing moves, because nothing needs to — it was always theirs.

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(formData.get("next"));
  if (!email) redirect(loginUrl({ next, error: "Enter your email address." }));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const callback = await callbackUrl(next);

  // A guest: keep this identity and give it an email, so everything they hold comes with them.
  if (user?.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: callback });
    if (!error) redirect(loginUrl({ next, sent: email, keeping: "1" }));
    // The email already belongs to an account. We will not quietly sign them into it and abandon
    // what this browser holds; that choice is theirs to make with its cost stated.
    if (isTaken(error)) redirect(loginUrl({ next, taken: email }));
    redirect(loginUrl({ next, error: error.message }));
  }

  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback } });
  if (error) redirect(loginUrl({ next, error: error.message }));
  redirect(loginUrl({ next, sent: email }));
}

/**
 * Sign in to an account that already exists, when the person has been told plainly that what this
 * browser's guest holds does not come with them. Only reachable from that warning.
 */
export async function signInLeavingGuestBehind(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(formData.get("next"));
  if (!email) redirect(loginUrl({ next, intent: "signin", error: "Enter your email address." }));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: await callbackUrl(next), shouldCreateUser: false } });
  if (error) redirect(loginUrl({ next, intent: "signin", error: error.message }));
  redirect(loginUrl({ next, sent: email, left: "1" }));
}

/** Supabase's way of saying the address is already an account. */
function isTaken(error: { code?: string; message?: string }): boolean {
  return error.code === "email_exists"
    || /already (been )?registered|already exists|already in use/i.test(error.message ?? "");
}

async function callbackUrl(next: string): Promise<string> {
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", next);
  return callback.toString();
}

function loginUrl(params: Record<string, string>) {
  return `/login?${new URLSearchParams(params)}`;
}
