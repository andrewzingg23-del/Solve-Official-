"use server";

import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { parseRepoUrl, repoUrl } from "@/lib/github/repo";
import { createCreativeResourceEntry, createCreativeWorld } from "@/lib/world/creative";

export async function createWorldAction(formData: FormData) {
  if (!(await getUser())) redirect("/login?next=%2Fworlds");
  const worldId = formData.get("worldId");
  const title = formData.get("title");
  const goalValue = formData.get("goal");
  const goal = typeof goalValue === "string" ? goalValue.trim() : "";
  const hasUnsupportedControl = [...goal].some((character) => {
    const code = character.charCodeAt(0);
    return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || (code >= 0x7f && code <= 0x9f);
  });
  if (
    typeof worldId !== "string" ||
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 160 ||
    goal.length > 7_000 ||
    hasUnsupportedControl
  ) {
    redirect("/worlds?error=world-input");
  }

  // A repository, if given, is linked as the World's first resource, so its room opens on the build.
  const repoValue = formData.get("repo");
  const repoText = typeof repoValue === "string" ? repoValue.trim() : "";
  const repo = repoText ? parseRepoUrl(repoText) : null;
  if (repoText && !repo) redirect("/worlds?error=world-repo");

  let createdWorldId: string;
  let linked = true;
  try {
    const kernel = await getKernel();
    const world = await createCreativeWorld(kernel, { worldId, title, goal });
    createdWorldId = world.worldId;
    if (repo) {
      linked = await createCreativeResourceEntry(kernel, {
        scope: world.scope,
        worldEntityId: world.entityId,
        requestId: `repo:${world.worldId}`,
        entryType: "offer",
        category: "resource",
        title: `${repo.owner}/${repo.repo}`,
        description: "The code this World builds. solve reads it from GitHub and never writes to it.",
        sourceUrl: repo.trunk ? `${repoUrl(repo)}/tree/${repo.trunk}` : repoUrl(repo),
      }).then(() => true, () => false);
    }
  } catch {
    redirect("/worlds?error=world-create");
  }
  redirect(`/world/${createdWorldId}/room${!repo ? "" : linked ? "?lens=build" : "?lens=pieces&error=repo-save"}`);
}
