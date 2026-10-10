"use server";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { loadBot, saveBot } from "@/lib/bot/store";
import { getBotAvatar } from "@/lib/bot/avatar";
import { ACCOUNT_CHANGED, sameDisplayedAccount } from "@/lib/product/account-guard";
import { validateIdentityInput } from "@/lib/product/identity";

export async function saveProfileAction(input: unknown, requestId: string, expectedUserId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!sameDisplayedAccount(expectedUserId, user?.id)) return { ok: false, error: ACCOUNT_CHANGED };
  if (!user) return { ok: false, error: "Sign in to save this profile to your account." };
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) return { ok: false, error: "Try saving this profile again." };
  try {
    const kernel = await getKernel();
    await kernel.register();
    const existing = await loadBot(kernel);
    const checked = validateIdentityInput(input, existing.persona);
    if (!checked.ok) return checked;
    await kernel.setPersonLabel(checked.name, requestId);
    const savedBot = await saveBot(kernel, checked.persona, requestId);
    const savedActor = await kernel.whoami();
    const previous = getBotAvatar(user);
    const avatar = { name: savedBot.persona.name, face: checked.face, ...(previous.face === checked.face && previous.face_url ? { face_url: previous.face_url, generated: previous.generated === true } : {}) };
    const { error } = await (await createClient()).auth.updateUser({ data: { display_name: savedActor.label, sov_label: savedActor.label, bot_avatar: avatar } });
    if (error) return { ok: false, error: "Your identity was saved, but the account display couldn't update. Keep this page open and retry." };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch { return { ok: false, error: "Your profile couldn't finish saving. Your changes are still here; retry in a moment." }; }
}
