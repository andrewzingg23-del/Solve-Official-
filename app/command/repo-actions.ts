"use server";

import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { repoUrl, roomRepos } from "@/lib/github/repo";
import { repoRoomId } from "@/lib/github/room-id";
import { createCreativeResourceEntry, createCreativeWorld } from "@/lib/world/creative";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

// Opens the room for the repository this deployment pairs with the signed-in person: a private World
// with the repository linked as its first resource. Opening it again opens the same World.
export async function openRepoRoomAction(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login?next=%2Fcommand");
  const ref = user.email ? roomRepos(process.env.GITHUB_ROOMS).get(user.email.trim().toLowerCase()) : undefined;
  if (!ref) redirect("/command");
  let worldId: string;
  try {
    const kernel = await getKernel();
    const me = await kernel.whoami();
    worldId = repoRoomId(me.actor_id, ref);
    const world = await createCreativeWorld(kernel, { worldId, title: text(formData.get("title")).slice(0, 160) || "Build", goal: text(formData.get("goal")).slice(0, 7000) });
    await createCreativeResourceEntry(kernel, {
      scope: world.scope,
      worldEntityId: world.entityId,
      requestId: `repo:${world.worldId}`,
      entryType: "offer",
      category: "resource",
      title: `${ref.owner}/${ref.repo}`,
      description: "The code this World builds. solve reads it from GitHub and never writes to it.",
      sourceUrl: ref.trunk ? `${repoUrl(ref)}/tree/${ref.trunk}` : repoUrl(ref),
    });
  } catch {
    redirect("/command?error=repo-room");
  }
  redirect(`/world/${worldId}/room?lens=build`);
}
