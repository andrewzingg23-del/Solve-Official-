"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeSpaceAnswers } from "@/lib/product/personal-space";

// Personal composition is user-controlled configuration, NOT permission data.
// Keep it separate from the existing bot interview and authorization records.
export async function savePersonalSpace(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) {
    return { ok: false, error: "Sign in to save across devices, or continue as a guest." };
  }
  const preferences = normalizeSpaceAnswers(input);
  const { error: saveError } = await supabase.auth.updateUser({
    data: { sov_personal_space: preferences },
  });
  if (saveError) return { ok: false, error: "Your preferences could not be saved. Try again." };
  return { ok: true };
}
