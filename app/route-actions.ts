"use server";

// The person's side of routes and outreach: taking a route, marking its steps done, approving a
// message. All run with the person's own sign-in, so the kernel records them as the actor; a bot can
// do none of them.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { approveAndSend } from "@/lib/bot/outreach";
import { markStepDone, takeRoute } from "@/lib/bot/routes";
import { WorldInputError } from "@/lib/bot/worlds";

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : "");
const worldPath = (worldId: string) => `/world/${encodeURIComponent(worldId)}`;

function failed(worldId: string, error: unknown): never {
  const code = error instanceof WorldInputError ? "route-input" : error instanceof KernelError && error.name === "forbidden" ? "route-access" : "route-save";
  redirect(`${worldPath(worldId)}?error=${code}`);
}

export async function takeRouteAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(worldPath(worldId))}`);
  try {
    await takeRoute(await getKernel(), { worldId, pieceId: text(formData.get("pieceId")), route: Number(text(formData.get("route"))) });
  } catch (error) {
    failed(worldId, error);
  }
  revalidatePath(worldPath(worldId));
  redirect(`${worldPath(worldId)}?saved=route`);
}

export async function stepDoneAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(worldPath(worldId))}`);
  try {
    await markStepDone(await getKernel(), { worldId, taskId: text(formData.get("taskId")) });
  } catch (error) {
    failed(worldId, error);
  }
  revalidatePath(worldPath(worldId));
  redirect(`${worldPath(worldId)}?saved=step`);
}

// Approving one outreach message. On the Practice channel it is recorded and not sent outside solve.
export async function approveOutreachAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(worldPath(worldId))}`);
  try {
    await approveAndSend(await getKernel(), { worldId, pieceId: text(formData.get("pieceId")), lead: Number(text(formData.get("lead"))) });
  } catch (error) {
    failed(worldId, error);
  }
  revalidatePath(worldPath(worldId));
  redirect(`${worldPath(worldId)}?saved=outreach`);
}

