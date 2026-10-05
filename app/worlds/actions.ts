"use server";

import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeWorld } from "@/lib/world/creative";

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

  let createdWorldId: string;
  try {
    const world = await createCreativeWorld(await getKernel(), { worldId, title, goal });
    createdWorldId = world.worldId;
  } catch {
    redirect("/worlds?error=world-create");
  }
  redirect(`/world/${createdWorldId}/room`);
}
