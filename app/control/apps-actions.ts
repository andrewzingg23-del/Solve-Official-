"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";

export type DisconnectResult = { ok: true } | { ok: false; error: string };

// Disconnect an app the person connected (an AI assistant, through SOLVE's connector). Supabase
// revokes the person's consent, deletes the app's sessions and invalidates its refresh tokens; the
// kernel refuses any app token whose session is gone (20261110080000), so it stops at once rather
// than when its last token expires.
export async function disconnectApp(clientId: string): Promise<DisconnectResult> {
  if (typeof clientId !== "string" || !/^[0-9a-f-]{36}$/i.test(clientId)) return { ok: false, error: "That app couldn't be found." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  const { error } = await (await createClient()).auth.oauth.revokeGrant({ clientId });
  if (error) return { ok: false, error: "It wasn't disconnected. Try again; nothing else changed." };
  revalidatePath("/control");
  return { ok: true };
}
