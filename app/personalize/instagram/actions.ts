"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeAppearance } from "@/lib/product/appearance";

export type InstagramStyleSave = { ok: true } | { ok: false; error: string };

// No posts, images, profile handles or captions are stored in auth metadata.
// This writes a limited visual preference, not a new authorization or connection.
export async function applyInstagramInspiredLook(
  input: unknown,
  rawSource: unknown
): Promise<InstagramStyleSave> {
  const source = rawSource;
  if (source !== "photos" && source !== "captions" && source !== "photos-and-captions") {
    return { ok: false, error: "Select actual source content before saving your look." };
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "No valid appearance proposal was supplied." };
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.is_anonymous) {
      return { ok: false, error: "Sign in before saving this look." };
    }
    const next = normalizeAppearance(input);
    const { error: saveError } = await supabase.auth.updateUser({
      data: {
        sov_space_appearance: next,
        solve_reality_mode_v1: "personal",
        solve_look_source_v1: { kind: "selected-instagram-content", evidence: source, created_at: new Date().toISOString() }
      }
    });
    if (saveError) return { ok: false, error: "Your look couldn't be saved. Your previous look is intact." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Account preferences are unavailable. Nothing was changed." };
  }
}
