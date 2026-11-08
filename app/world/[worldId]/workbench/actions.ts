"use server";

import { revalidatePath } from "next/cache";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeArtifact, loadCreativeWorld } from "@/lib/world/creative";
import { nextSpot } from "../room/place";

export type WorkbenchSaveResult = { ok: true; artifactId: string } | { ok: false; error: string };

export async function addWorkbenchNote(worldId: string, rawNote: string, requestId: string): Promise<WorkbenchSaveResult> {
  const user = await getUser();
  if (!user || user.is_anonymous) return { ok: false, error: "Sign in to save work in this World." };
  if (typeof rawNote !== "string" || !rawNote.trim() || rawNote.length > 7000 || typeof requestId !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(requestId)) {
    return { ok: false, error: "Write a note of up to 7,000 characters." };
  }
  const note = rawNote.trim();
  const first = note.split("\n")[0].trim();
  const title = first.length > 160 ? first.slice(0, 157).trimEnd() + "…" : first;

  try {
    const kernel = await getKernel();
    const { world, artifacts } = await loadCreativeWorld(kernel, worldId);
    const artifactId = await createCreativeArtifact(kernel, {
      scope: world.scope,
      worldEntityId: world.entityId,
      title, body: note === title ? "" : note,
      requestId,
      position: nextSpot(artifacts.map(item => item.position)),
    });
    // A write response alone is not a receipt: verify this exact record is readable by the actor.
    const confirmed = (await loadCreativeWorld(kernel, worldId)).artifacts.some(item => item.entityId === artifactId);
    if (!confirmed) return { ok: false, error: "Your note couldn't be confirmed. Reopen this World before retrying." };
    revalidatePath("/world/" + encodeURIComponent(worldId) + "/workbench");
    revalidatePath("/world/" + encodeURIComponent(worldId) + "/room");
    return { ok: true, artifactId };
  } catch (error) {
    if (error instanceof KernelError && error.name === "forbidden") return { ok: false, error: "You don't have permission to add work here." };
    if (error instanceof KernelError && error.name === "not_found") return { ok: false, error: "This World is no longer accessible." };
    return { ok: false, error: "Your note wasn't confirmed. Keep your text and retry once the connection is restored." };
  }
}
