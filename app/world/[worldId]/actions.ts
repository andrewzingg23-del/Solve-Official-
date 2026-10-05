"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeArtifact, createCreativeResourceEntry, isCreativeResourceCategory, isCreativeResourceEntryType, isCreativeResourceStatus, loadCreativeWorld, updateCreativeArtifact, updateCreativeResourceEntry } from "@/lib/world/creative";

const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value : "";

function returnWithError(worldId: string, code: string): never {
  redirect(`/world/${encodeURIComponent(worldId)}?error=${code}`);
}

export async function createArtifactAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/world/${worldId}`)}`);
  const title = text(formData.get("title"));
  const body = text(formData.get("body"));
  const x = Number(text(formData.get("x")));
  const y = Number(text(formData.get("y")));
  if (!title.trim() || !Number.isFinite(x) || !Number.isFinite(y)) return returnWithError(worldId, "artifact-input");

  try {
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    await createCreativeArtifact(kernel, {
      scope: world.scope,
      worldEntityId: world.entityId,
      requestId: text(formData.get("requestId")),
      title,
      body,
      position: { x, y },
    });
  } catch (error) {
    return returnWithError(worldId, error instanceof KernelError && error.name === "forbidden" ? "access" : error instanceof KernelError && error.name === "not_found" ? "world-missing" : "artifact-save");
  }
  revalidatePath(`/world/${worldId}`);
  redirect(`/world/${worldId}?saved=artifact`);
}

export async function updateArtifactAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/world/${worldId}`)}`);
  const entityId = text(formData.get("entityId"));
  const title = text(formData.get("title"));
  const body = text(formData.get("body"));
  const x = Number(text(formData.get("x")));
  const y = Number(text(formData.get("y")));
  if (!entityId || !title.trim() || !Number.isFinite(x) || !Number.isFinite(y)) return returnWithError(worldId, "artifact-input");

  try {
    await updateCreativeArtifact(await getKernel(), {
      scope: `world:${worldId}`,
      entityId,
      requestId: text(formData.get("requestId")),
      title,
      body,
      position: { x, y },
    });
  } catch (error) {
    return returnWithError(worldId, error instanceof KernelError && error.name === "forbidden" ? "access" : "artifact-save");
  }
  revalidatePath(`/world/${worldId}`);
  redirect(`/world/${worldId}?saved=artifact`);
}


function resourceErrorCode(error: unknown): string {
  if (!(error instanceof KernelError)) return "resource-save";
  if (error.name === "forbidden") return "access";
  if (error.name === "not_found") return "world-missing";
  if (error.name === "invalid") return "resource-input";
  return "resource-save";
}

export async function createResourceEntryAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/world/${worldId}`)}`);
  const entryType = text(formData.get("entryType"));
  const category = text(formData.get("category"));
  const title = text(formData.get("title"));
  const description = text(formData.get("description"));
  if (
    !isCreativeResourceEntryType(entryType) ||
    !isCreativeResourceCategory(category) ||
    !title.trim() ||
    !description.trim()
  ) return returnWithError(worldId, "resource-input");

  try {
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    await createCreativeResourceEntry(kernel, {
      scope: world.scope,
      worldEntityId: world.entityId,
      requestId: text(formData.get("requestId")),
      entryType,
      category,
      title,
      description,
      timeWindow: text(formData.get("timeWindow")),
      sourceUrl: text(formData.get("sourceUrl")),
    });
  } catch (error) {
    return returnWithError(worldId, resourceErrorCode(error));
  }
  revalidatePath(`/world/${worldId}`);
  redirect(`/world/${worldId}?saved=resource`);
}

export async function updateResourceEntryAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/world/${worldId}`)}`);
  const entityId = text(formData.get("entityId"));
  const title = text(formData.get("title"));
  const description = text(formData.get("description"));
  const status = text(formData.get("status"));
  if (!entityId || !title.trim() || !description.trim() || !isCreativeResourceStatus(status)) {
    return returnWithError(worldId, "resource-input");
  }

  try {
    await updateCreativeResourceEntry(await getKernel(), {
      scope: `world:${worldId}`,
      entityId,
      requestId: text(formData.get("requestId")),
      title,
      description,
      timeWindow: text(formData.get("timeWindow")),
      sourceUrl: text(formData.get("sourceUrl")),
      status,
    });
  } catch (error) {
    return returnWithError(worldId, resourceErrorCode(error));
  }
  revalidatePath(`/world/${worldId}`);
  redirect(`/world/${worldId}?saved=resource`);
}
