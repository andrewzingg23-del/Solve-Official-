"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createIdea, relateIdeas, updateIdeaStatus, type IdeaRelationKind, type IdeaStatus } from "@/lib/world/ideas";

const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value : "";
const list = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

function fail(worldId: string, code: string): never {
  redirect(`/world/${encodeURIComponent(worldId)}/ideas?error=${code}`);
}

async function requireSignedIn(worldId: string) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(`/world/${worldId}/ideas`)}`);
}

export async function createIdeaAction(worldId: string, formData: FormData) {
  await requireSignedIn(worldId);
  try {
    await createIdea(await getKernel(), {
      scope: `world:${worldId}`,
      requestId: text(formData.get("requestId")),
      title: text(formData.get("title")),
      description: text(formData.get("description")),
      assumptions: list(text(formData.get("assumptions"))),
      openQuestions: list(text(formData.get("openQuestions"))),
    });
  } catch (error) {
    fail(worldId, error instanceof KernelError && error.name === "forbidden" ? "access" : error instanceof KernelError && error.name === "invalid" ? "input" : "save");
  }
  revalidatePath(`/world/${worldId}/ideas`);
  redirect(`/world/${worldId}/ideas?saved=idea`);
}

export async function relateIdeaAction(worldId: string, formData: FormData) {
  await requireSignedIn(worldId);
  try {
    await relateIdeas(await getKernel(), {
      scope: `world:${worldId}`,
      fromId: text(formData.get("fromId")),
      toId: text(formData.get("toId")),
      kind: text(formData.get("kind")) as IdeaRelationKind,
      requestId: text(formData.get("requestId")),
    });
  } catch (error) {
    fail(worldId, error instanceof KernelError && error.name === "forbidden" ? "access" : error instanceof KernelError && error.name === "invalid" ? "input" : "save");
  }
  revalidatePath(`/world/${worldId}/ideas`);
  redirect(`/world/${worldId}/ideas?saved=link`);
}

export async function updateIdeaStatusAction(worldId: string, formData: FormData) {
  await requireSignedIn(worldId);
  try {
    await updateIdeaStatus(await getKernel(), {
      scope: `world:${worldId}`,
      ideaId: text(formData.get("ideaId")),
      status: text(formData.get("status")) as IdeaStatus,
      requestId: text(formData.get("requestId")),
      reason: text(formData.get("reason")),
    });
  } catch (error) {
    fail(worldId, error instanceof KernelError && error.name === "forbidden" ? "access" : error instanceof KernelError && error.name === "invalid" ? "input" : "save");
  }
  revalidatePath(`/world/${worldId}/ideas`);
  redirect(`/world/${worldId}/ideas?saved=status`);
}
