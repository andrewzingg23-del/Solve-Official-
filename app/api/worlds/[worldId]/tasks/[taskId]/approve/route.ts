import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { KernelError, type KernelErrorName } from "@/lib/kernel/client";
import { privateJson } from "@/lib/world/http";
import { approveWorldTask } from "@/lib/world/tasks";

export const dynamic = "force-dynamic";
const codes: Partial<Record<KernelErrorName, number>> = { unauthenticated:401, forbidden:403, invalid:422, conflict:409, not_found:404 };

// This intentionally does not dispatch a workflow or grant an executor any authority.
export async function POST(_request: Request, context: RouteContext<"/api/worlds/[worldId]/tasks/[taskId]/approve">) {
  if (!(await getUser())) return privateJson({ error: "Sign in to approve a task." }, 401);
  try {
    const { worldId, taskId } = await context.params;
    return privateJson(await approveWorldTask(await getKernel(), worldId, taskId));
  } catch (error) {
    if (error instanceof KernelError) return privateJson({ error:error.message }, codes[error.name] ?? 503);
    return privateJson({ error:"Could not approve this task. No agent was dispatched." }, 503);
  }
}
