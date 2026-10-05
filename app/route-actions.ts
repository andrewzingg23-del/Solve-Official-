"use server";

// The person's side of routes: taking one, and marking its steps done. Both run with the person's own
// sign-in, so the kernel records them as the actor; a bot cannot do either.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
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
