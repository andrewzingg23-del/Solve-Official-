"use server";

import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeWorld } from "@/lib/world/creative";

export async function createWorldAction(formData: FormData) {
  if (!(await getUser())) redirect("/login?next=%2Fworlds");
  const worldId = formData.get("worldId");
  const title = formData.get("title");
  if (typeof worldId !== "string" || typeof title !== "string" || !title.trim() || title.trim().length > 160) {
    redirect("/worlds?error=world-title");
  }

  let createdWorldId: string;
  try {
    const world = await createCreativeWorld(await getKernel(), { worldId, title });
    createdWorldId = world.worldId;
  } catch {
    redirect("/worlds?error=world-create");
  }
  redirect(`/world/${createdWorldId}`);
}
