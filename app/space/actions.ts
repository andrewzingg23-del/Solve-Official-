"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeAppearance } from "@/lib/product/appearance";

// Account-only preference, intentionally separate from capabilities or public SOV Profile.
export async function saveSpaceAppearance(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return { ok: false, error: "Sign in to save this appearance across devices." };
  const { error: updateError } = await supabase.auth.updateUser({
    data: { sov_space_appearance: normalizeAppearance(input) },
  });
  if (updateError) return { ok: false, error: "Appearance couldn't be saved. Please try again." };
  return { ok: true };
}
