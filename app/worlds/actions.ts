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
  if (
    typeof worldId !== "string" ||
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 160 ||
    goal.length > 7_000 ||
    /[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]/.test(goal)
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
  redirect(`/world/${createdWorldId}`);
}
