"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { grantWorldAccess, revokeWorldAccess, type WorldAccessRole } from "@/lib/world/collaboration";

const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value : "";

function fail(worldId: string, code: string): never {
  redirect("/world/" + encodeURIComponent(worldId) + "?error=" + code);
}

async function requireSignedIn(worldId: string) {
  if (!(await getUser())) redirect("/login?next=" + encodeURIComponent("/world/" + worldId));
}

function errorCode(error: unknown): string {
  if (!(error instanceof KernelError)) return "access-save";
  if (error.name === "invalid") return "access-input";
  if (error.name === "not_found") return "access-missing";
  if (error.name === "conflict") return "access-conflict";
  if (error.name === "forbidden") return "access";
  return "access-save";
}

export async function grantWorldAccessAction(worldId: string, formData: FormData) {
  await requireSignedIn(worldId);
  try {
    await grantWorldAccess(await getKernel(), {
      scope: "world:" + worldId,
      granteeActorId: text(formData.get("actorId")),
      role: text(formData.get("role")) as WorldAccessRole,
      requestId: text(formData.get("requestId")),
    });
  } catch (error) {
    fail(worldId, errorCode(error));
  }
  revalidatePath("/world/" + worldId);
  redirect("/world/" + worldId + "?saved=collaborator");
}

export async function revokeWorldAccessAction(worldId: string, formData: FormData) {
  await requireSignedIn(worldId);
  try {
    await revokeWorldAccess(await getKernel(), {
      scope: "world:" + worldId,
      granteeActorId: text(formData.get("actorId")),
      requestId: text(formData.get("requestId")),
    });
  } catch (error) {
    fail(worldId, errorCode(error));
  }
  revalidatePath("/world/" + worldId);
  redirect("/world/" + worldId + "?saved=collaborator");
}
