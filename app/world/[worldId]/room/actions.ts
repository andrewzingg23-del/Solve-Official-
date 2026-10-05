"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { BuildProofError, saveBuild } from "@/lib/github/build-proof";
import { parseRepoUrl, readRepo, repoForWorld, repoUrl, sameRepo } from "@/lib/github/repo";
import { deploymentRooms } from "@/lib/github/rooms";
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

// Saves a build as proof, after reading it from GitHub again: only a build GitHub reports as passed
// is saved, whatever the form says.
export async function saveBuildAction(worldId: string, formData: FormData) {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(room(worldId))}`);
  const buildId = Number(text(formData.get("buildId")));
  if (!Number.isSafeInteger(buildId) || buildId <= 0) redirect(`${room(worldId)}?lens=build&error=build-input`);
  let code: string | null = null;
  try {
    const kernel = await getKernel();
    const { world, resources } = await loadCreativeWorld(kernel, worldId);
    const linked = resources.filter((r) => r.status === "open" && r.sourceUrl);
    const repo = repoForWorld({ worldId: world.worldId, viewerEmail: user.email, links: linked.map((r) => r.sourceUrl), rooms: deploymentRooms() });
    if (!repo) throw new BuildProofError("no repository");
    const read = await readRepo(repo.ref, { token: repo.paired ? process.env.GITHUB_TOKEN || null : null });
    if (!read.ok) throw new BuildProofError("GitHub didn't answer");
    const resource = linked.find((r) => { const ref = parseRepoUrl(r.sourceUrl); return ref !== null && sameRepo(ref, repo.ref); });
    await saveBuild(kernel, { scope: world.scope, entityId: resource?.entityId ?? world.entityId, view: read.view, buildId });
  } catch (error) {
    code = error instanceof BuildProofError ? "build-unseen" : failure(error) === "access" ? "build-access" : "build-save";
  }
  if (code) redirect(`${room(worldId)}?lens=build&error=${code}`);
  revalidatePath(room(worldId));
  redirect(`${room(worldId)}?lens=build&saved=build`);
}
