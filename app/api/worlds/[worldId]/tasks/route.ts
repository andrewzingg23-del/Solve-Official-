import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { KernelError, type KernelErrorName } from "@/lib/kernel/client";
import { privateJson } from "@/lib/world/http";
import { proposeWorldTask, readWorldTasks } from "@/lib/world/tasks";

export const dynamic = "force-dynamic";
const codes: Partial<Record<KernelErrorName, number>> = { unauthenticated:401, forbidden:403, invalid:422, conflict:409, not_found:404 };

function fail(error: unknown) {
  if (error instanceof KernelError) return privateJson({ error: error.message }, codes[error.name] ?? 503);
  return privateJson({ error: "World tasks are unavailable. Nothing has changed." }, 503);
}

export async function GET(_request: Request, context: RouteContext<"/api/worlds/[worldId]/tasks">) {
  if (!(await getUser())) return privateJson({ error: "Sign in to view tasks." }, 401);
  try { return privateJson(await readWorldTasks(await getKernel(), (await context.params).worldId)); }
  catch (error) { return fail(error); }
}

export async function POST(request: Request, context: RouteContext<"/api/worlds/[worldId]/tasks">) {
  if (!(await getUser())) return privateJson({ error: "Sign in to create tasks." }, 401);
  try {
    const raw = await request.text();
    if (raw.length > 10000) return privateJson({ error: "Task request is too large." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return privateJson({ error: "Send valid JSON." }, 422); }
    const result = await proposeWorldTask(await getKernel(), (await context.params).worldId, body);
    return privateJson(result, 201);
  } catch (error) { return fail(error); }
}
