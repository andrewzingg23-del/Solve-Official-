"use server";

import { createClient } from "@/lib/supabase/server";

export type RealityMode = "base" | "adaptive" | "personal";

export function isRealityMode(value: unknown): value is RealityMode {
  return value === "base" || value === "adaptive" || value === "personal";
}

// Account appearance only. This does not affect identity, publications, grants or World data.
export async function saveRealityMode(value: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isRealityMode(value)) return { ok: false, error: "Choose a supported appearance." };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) return { ok: false, error: "Sign in to save this across devices." };
    const { error: saveError } = await supabase.auth.updateUser({ data: { solve_reality_mode_v1: value } });
    if (saveError) return { ok: false, error: "Couldn't save your appearance. Please retry." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Appearance service is unavailable. Nothing was changed." };
  }
}
