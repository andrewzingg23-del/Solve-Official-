"use server";

import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { CommunityInputError, startCommunity } from "@/lib/community/community";

export async function startCommunityAction(formData: FormData) {
  if (!(await getUser())) redirect("/login?next=%2Fcommunities");
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
    redirect(`/communities?error=${error instanceof CommunityInputError ? "input" : "start"}`);
  }
  redirect(`/community/${communityId}?started=1`);
}
