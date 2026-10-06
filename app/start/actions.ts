"use server";

import { createClient } from "@/lib/supabase/server";
import { claimIdentity } from "@/app/claim/actions";

// Step 2: claim the SOV ID. The kernel is the source of truth; if it isn't
// provisioned yet, the name is kept as a pending claim — never a fake ID.
export async function claimSovId(
  name: string,
): Promise<{ ok: boolean; actorId?: string; pending?: boolean; error?: string }> {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { ok: false, error: "Give your SOV ID a name." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "Sign in first." };
  try {
    const { actorId, label } = await claimIdentity(clean);
    await supabase.auth.updateUser({ data: { sov_label: label, sov_actor_id: actorId } });
    return { ok: true, actorId };
  } catch {
    // Kernel not provisioned: keep the name as a pending claim, say so plainly.
    await supabase.auth.updateUser({ data: { sov_pending_label: clean } });
    return { ok: true, pending: true };
  }
}

// Step 6: what the assistant learned about you. Plain answers, kept on your account.
export async function saveKnowYou(
  answers: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "Sign in first." };
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === "string" && v.trim()) clean[k.slice(0, 40)] = v.trim().slice(0, 500);
  }
  const { error: saveError } = await supabase.auth.updateUser({ data: { profile: clean } });
  if (saveError) return { ok: false, error: "Couldn't save. Try again." };
  return { ok: true };
}
