"use server";

import { createClient } from "@/lib/supabase/server";
import { isValidFace, sanitizeBotName } from "@/lib/bot/avatar";

export async function saveBotAvatar(
  face: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidFace(face)) return { ok: false, error: "Pick one of the faces shown." };
  const clean = sanitizeBotName(name);
  if (!clean) return { ok: false, error: "Give your bot a name." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "Sign in to make this bot yours." };
  const { error: saveError } = await supabase.auth.updateUser({
    data: { bot_avatar: { face, name: clean } },
  });
  if (saveError) return { ok: false, error: "Couldn't save. Try again." };
  return { ok: true };
}
