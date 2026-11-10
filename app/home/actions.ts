"use server";

import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeWorld } from "@/lib/world/creative";

export type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;

/** The first sentence, as a title a person will recognise. */
function titleOf(words: string): string {
  const first = words.trim().split(/[.!?\n]/)[0]?.trim() || words.trim();
  return first.length > 100 ? first.slice(0, 97).trimEnd() + "…" : first;
}

// Record one thing a person wrote down, as theirs. A visitor already has a kernel identity, so this
// works before any account exists; signing in later buys reach, not ownership.
export async function createThing(id: string, words: string): Promise<CreateResult> {
  const text = typeof words === "string" ? words.trim() : "";
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > 7000 || CONTROL.test(text)) return { ok: false, error: "That can't be saved as written. Try shorter, plain text." };
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "Something went wrong preparing this. Reload and try again." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const world = await createCreativeWorld(await getKernel(), { worldId: id, title: titleOf(text), goal: text });
    return { ok: true, id: world.worldId };
  } catch {
    return { ok: false, error: "It wasn't recorded. Your words are still here; try again." };
  }
}
