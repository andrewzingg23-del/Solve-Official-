"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadCreativeWorld } from "@/lib/world/creative";
import { parseWorkIntent } from "@/lib/work/intent";

const address = (worldId: string) => `/world/${encodeURIComponent(worldId)}/work`;

function errorCode(error: unknown): string {
  if (error instanceof KernelError && (error.name === "forbidden" || error.name === "not_found")) return "access";
  if (error instanceof KernelError && error.name === "invalid") return "input";
  return "unavailable";
}

/**
 * The user authorizes creation of a task record, not model execution.
 * Kernel checks task.create on the *loaded* World scope before writing.
 * A future worker must independently obtain a scoped task.perform grant.
 */
export async function createWorkTaskAction(worldId: string, formData: FormData) {
  const path = address(worldId);
  if (!(await getUser())) redirect(`/login?next=${encodeURIComponent(path)}`);

  let intent: ReturnType<typeof parseWorkIntent>;
  try {
    intent = parseWorkIntent({
      title: formData.get("title"),
      objective: formData.get("objective"),
      independentReview: formData.get("review"),
      requestId: formData.get("requestId"),
    });
  } catch {
    redirect(`${path}?error=input`);
  }

  let code: string | null = null;
  try {
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    const decision = await kernel.authorize({ capability: "task.create", scope: world.scope });
    if (decision.decision !== "ALLOW") {
      code = "access";
    } else {
      await kernel.createTask({
        scope: world.scope,
        title: intent.title,
        objective: intent.objective,
        requiredCapability: "task.perform",
        risk: "low",
        reversible: true,
        verification: intent.independentReview ? "distinct_actor" : "none",
        inputs: { origin: "solve.world.work.v1" },
        idempotencyKey: intent.requestId,
      });
    }
  } catch (error) {
    code = errorCode(error);
  }

  if (code) redirect(`${path}?error=${code}`);
  revalidatePath(path);
  redirect(`${path}?saved=task`);
}
