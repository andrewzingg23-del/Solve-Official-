"use server";

import { ACCOUNT_CHANGED, requireDisplayedActor } from "@/lib/product/account-guard";
import type { FormResult } from "@/app/product/recoverable-form";
import { revalidatePath } from "next/cache";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeArtifact, createCreativeResourceEntry, isCreativeResourceCategory, isCreativeResourceEntryType, isCreativeResourceStatus, loadCreativeWorld, updateCreativeArtifact, updateCreativeResourceEntry } from "@/lib/world/creative";

const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value : "";

function returnWithError(code: string): FormResult {
  return { ok: false, error: code === "access" ? "Your access changed. Your text is still here; ask the owner before retrying." : code.endsWith("input") ? "Check the required fields. Your text is still here." : "This change could not be saved. Your text is still here; retry in a moment." };
}

export async function createArtifactAction(worldId: string, formData: FormData) {
  if (!(await getUser())) return { ok: false as const, error: "Sign in again to save this change. Your text is still here." };
  const title = text(formData.get("title"));
  const body = text(formData.get("body"));
  const x = Number(text(formData.get("x")));
  const y = Number(text(formData.get("y")));
  if (!title.trim() || !Number.isFinite(x) || !Number.isFinite(y)) return returnWithError("artifact-input");

  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, text(formData.get("expectedActorId")));
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
    if (error instanceof Error && error.message === ACCOUNT_CHANGED) return { ok: false as const, error: ACCOUNT_CHANGED };
    return returnWithError(error instanceof KernelError && error.name === "forbidden" ? "access" : error instanceof KernelError && error.name === "not_found" ? "world-missing" : "artifact-save");
  }
  revalidatePath(`/world/${worldId}`);
  return { ok: true as const, href: `/world/${worldId}?saved=artifact` };
}

export async function updateArtifactAction(worldId: string, formData: FormData) {
  if (!(await getUser())) return { ok: false as const, error: "Sign in again to save this change. Your text is still here." };
  const entityId = text(formData.get("entityId"));
  const title = text(formData.get("title"));
  const body = text(formData.get("body"));
  const x = Number(text(formData.get("x")));
  const y = Number(text(formData.get("y")));
  if (!entityId || !title.trim() || !Number.isFinite(x) || !Number.isFinite(y)) return returnWithError("artifact-input");

  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, text(formData.get("expectedActorId")));
    await updateCreativeArtifact(kernel, {
      scope: `world:${worldId}`,
      entityId,
      requestId: text(formData.get("requestId")),
      title,
      body,
      position: { x, y },
    });
  } catch (error) {
    if (error instanceof Error && error.message === ACCOUNT_CHANGED) return { ok: false as const, error: ACCOUNT_CHANGED };
    return returnWithError(error instanceof KernelError && error.name === "forbidden" ? "access" : "artifact-save");
  }
  revalidatePath(`/world/${worldId}`);
  return { ok: true as const, href: `/world/${worldId}?saved=artifact` };
}


function resourceErrorCode(error: unknown): string {
  if (!(error instanceof KernelError)) return "resource-save";
  if (error.name === "forbidden") return "access";
  if (error.name === "not_found") return "world-missing";
  if (error.name === "invalid") return "resource-input";
  return "resource-save";
}

export async function createResourceEntryAction(worldId: string, formData: FormData) {
  if (!(await getUser())) return { ok: false as const, error: "Sign in again to save this change. Your text is still here." };
  const entryType = text(formData.get("entryType"));
  const category = text(formData.get("category"));
  const title = text(formData.get("title"));
  const description = text(formData.get("description"));
  if (
    !isCreativeResourceEntryType(entryType) ||
    !isCreativeResourceCategory(category) ||
    !title.trim() ||
    !description.trim()
  ) return returnWithError("resource-input");

  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, text(formData.get("expectedActorId")));
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
    if (error instanceof Error && error.message === ACCOUNT_CHANGED) return { ok: false as const, error: ACCOUNT_CHANGED };
    return returnWithError(resourceErrorCode(error));
  }
  revalidatePath(`/world/${worldId}`);
  return { ok: true as const, href: `/world/${worldId}?saved=resource` };
}

export async function updateResourceEntryAction(worldId: string, formData: FormData) {
  if (!(await getUser())) return { ok: false as const, error: "Sign in again to save this change. Your text is still here." };
  const entityId = text(formData.get("entityId"));
  const title = text(formData.get("title"));
  const description = text(formData.get("description"));
  const status = text(formData.get("status"));
  if (!entityId || !title.trim() || !description.trim() || !isCreativeResourceStatus(status)) {
    return returnWithError("resource-input");
  }

  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, text(formData.get("expectedActorId")));
    await updateCreativeResourceEntry(kernel, {
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
    if (error instanceof Error && error.message === ACCOUNT_CHANGED) return { ok: false as const, error: ACCOUNT_CHANGED };
    return returnWithError(resourceErrorCode(error));
  }
  revalidatePath(`/world/${worldId}`);
  return { ok: true as const, href: `/world/${worldId}?saved=resource` };
}
