"use server";

import { createClient } from "@/lib/supabase/server";
import { normalizeAppearance } from "@/lib/product/appearance";
import { parsePublicMedia } from "@/lib/product/public-media";

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


// User-selected *public media link*. This is not a Spotify or YouTube account grant.
// No iframe HTML, provider access token, or private source data is accepted.
export async function saveSpacePublicMedia(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const safe = input === "" ? "" : parsePublicMedia(input)?.sourceUrl;
  if (safe === undefined) return { ok: false, error: "Paste a supported public Spotify or YouTube link." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return { ok: false, error: "Sign in to save this across devices." };
  const { error: saveError } = await supabase.auth.updateUser({
    data: { sov_space_public_media: safe },
  });
  if (saveError) return { ok: false, error: "The media link couldn't be saved. Please retry." };
  return { ok: true };
}
