"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { createClient, getUser } from "@/lib/supabase/server";

export type NameResult = { ok: true; name: string } | { ok: false; error: string };

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;

// The name on a person's card. It is recorded in their identity as an event, so it has a history
// and is what everyone they share with sees.
export async function saveName(raw: string): Promise<NameResult> {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "Write the name you'd like on your card." };
  if (name.length > 80 || CONTROL.test(name)) return { ok: false, error: "That name can't be used as written. Try something shorter." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    await (await getKernel()).setPersonLabel(name, randomUUID());
    return { ok: true, name };
  } catch {
    return { ok: false, error: "Your name wasn't saved, and nothing changed. Try again." };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
