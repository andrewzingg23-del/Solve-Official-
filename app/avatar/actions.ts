"use server";

import { createClient } from "@/lib/supabase/server";
import { isValidFace, isValidFaceUrl, sanitizeBotName } from "@/lib/bot/avatar";
import { sanitizeSoul } from "@/lib/bot/soul";

async function authedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase };
}

export async function saveBotAvatar(
  face: string,
  name: string,
  face_url?: string,
  generated?: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidFace(face)) return { ok: false, error: "Pick a face to continue." };
  if (face_url !== undefined && !isValidFaceUrl(face_url))
    return { ok: false, error: "That image didn't come through. Try again." };
  const clean = sanitizeBotName(name);
  if (!clean) return { ok: false, error: "Give your bot a name." };
  const authed = await authedUser();
  if (!authed) return { ok: false, error: "Sign in to make this bot yours." };
  const { error: saveError } = await authed.supabase.auth.updateUser({
    data: { bot_avatar: { face, name: clean, ...(face_url ? { face_url, generated: generated === true } : {}) } },
  });
  if (saveError) return { ok: false, error: "Couldn't save. Try again." };
  return { ok: true };
}

export async function saveFacePhoto(
  dataUrl: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidFaceUrl(dataUrl)) return { ok: false, error: "That photo didn't come through. Try again." };
  const clean = sanitizeBotName(name);
  if (!clean) return { ok: false, error: "Give your bot a name." };
  const authed = await authedUser();
  if (!authed) return { ok: false, error: "Sign in to make this bot yours." };
  const { error: saveError } = await authed.supabase.auth.updateUser({
    data: { bot_avatar: { face: "blank", face_url: dataUrl, generated: false, name: clean } },
  });
  if (saveError) return { ok: false, error: "Couldn't save. Try again." };
  return { ok: true };
}

export async function saveBotSoul(soul: string): Promise<{ ok: boolean; error?: string }> {
  const authed = await authedUser();
  if (!authed) return { ok: false, error: "Sign in to shape your bot." };
  const clean = sanitizeSoul(soul);
  const { error: saveError } = await authed.supabase.auth.updateUser({
    data: { bot_soul: clean },
  });
  if (saveError) return { ok: false, error: "Couldn't save. Try again." };
  return { ok: true };
}

export async function saveHomeNode(
  lat: number,
  lng: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return { ok: false, error: "That location didn't come through." };
  const authed = await authedUser();
  if (!authed) return { ok: false, error: "Sign in to place your node." };
  const { error: saveError } = await authed.supabase.auth.updateUser({
    data: { home_node: { lat, lng } },
  });
  if (saveError) return { ok: false, error: "Couldn't save. Try again." };
  return { ok: true };
}
