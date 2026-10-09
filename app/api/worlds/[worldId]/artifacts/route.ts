import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { handleRoomArtifact, privateJson } from "@/lib/world/http";

export const dynamic = "force-dynamic";
async function save(request: Request, context: RouteContext<"/api/worlds/[worldId]/artifacts">) {
  if (!(await getUser())) return privateJson({ error: "Sign in to save shared work." }, 401);
  return handleRoomArtifact(await getKernel(), (await context.params).worldId, request);
}
export const POST = save;
export const PATCH = save;
