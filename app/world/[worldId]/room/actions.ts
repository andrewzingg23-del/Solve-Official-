"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { parseRepoUrl, repoUrl } from "@/lib/github/repo";
import { createCreativeArtifact, createCreativeResourceEntry, loadCreativeWorld } from "@/lib/world/creative";
import { nextSpot } from "./place";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");
const room = (worldId: string) => `/world/${encodeURIComponent(worldId)}/room`;

function failure(error: unknown) {
  if (error instanceof KernelError && error.name === "forbidden") return "access";
  if (error instanceof KernelError && error.name === "invalid") return "input";
  return "save";
}

// The command bar: a note becomes a piece in the World, its first line the title.
export async function addNoteAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(room(worldId))}`);
  const note = text(formData.get("note")).trim();
  if (!note) redirect(`${room(worldId)}?lens=pieces&error=note-input`);
  const firstLine = note.split("\n")[0].trim();
  const title = firstLine.length > 160 ? `${firstLine.slice(0, 157).trimEnd()}…` : firstLine;
  const body = note === title ? "" : note;
  let code: string | null = null;
  try {
    const kernel = await getKernel();
    const { world, artifacts } = await loadCreativeWorld(kernel, worldId);
    await createCreativeArtifact(kernel, {
      scope: world.scope,
      worldEntityId: world.entityId,
      requestId: text(formData.get("requestId")),
      title,
      body,
      position: nextSpot(artifacts.map((a) => a.position)),
    });
  } catch (error) {
    code = failure(error);
  }
  if (code) redirect(`${room(worldId)}?lens=pieces&error=note-${code}`);
  revalidatePath(room(worldId));
  redirect(`${room(worldId)}?lens=pieces&saved=note`);
}

// Linking a repository adds it to the World's resources (one concept, one home), as the World's
// own word. The room then reads it from GitHub; solve never writes to it.
export async function linkRepoAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(room(worldId))}`);
  const ref = parseRepoUrl(text(formData.get("url")));
  if (!ref) redirect(`${room(worldId)}?lens=pieces&error=repo-input`);
  let code: string | null = null;
  try {
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    await createCreativeResourceEntry(kernel, {
      scope: world.scope,
      worldEntityId: world.entityId,
      requestId: text(formData.get("requestId")),
      entryType: "offer",
      category: "resource",
      title: `${ref.owner}/${ref.repo}`,
      description: "The code this World builds. solve reads it from GitHub and never writes to it.",
      sourceUrl: ref.trunk ? `${repoUrl(ref)}/tree/${ref.trunk}` : repoUrl(ref),
    });
  } catch (error) {
    code = failure(error);
  }
  if (code) redirect(`${room(worldId)}?lens=pieces&error=repo-${code}`);
  revalidatePath(room(worldId));
  redirect(`${room(worldId)}?lens=build&saved=repo`);
}
