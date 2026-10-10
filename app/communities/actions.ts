"use server";

import { ACCOUNT_CHANGED, sameDisplayedAccount } from "@/lib/product/account-guard";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { CommunityInputError, startCommunity } from "@/lib/community/community";

export async function startCommunityAction(formData: FormData) {
  const user = await getUser();
  if (!sameDisplayedAccount(formData.get("expectedUserId"), user?.id)) return { ok: false as const, error: ACCOUNT_CHANGED };
  const nonce = formData.get("nonce");
  let communityId: string;
  try {
    const community = await startCommunity(await getKernel(), {
      name: formData.get("name"),
      about: formData.get("about"),
      packs: formData.getAll("packs"),
      nonce: typeof nonce === "string" ? nonce : "",
    });
    communityId = community.communityId;
  } catch (error) {
    return { ok: false as const, error: error instanceof CommunityInputError ? "Check your community name and description. Your draft is still here." : "Your community could not be started. Your draft is still here; retry shortly." };
  }
  return { ok: true as const, href: `/community/${communityId}?started=1` };
}
