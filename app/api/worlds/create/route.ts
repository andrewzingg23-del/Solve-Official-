// Create a venture world from Talk's "Build this way" approval.
// Thin JSON wrapper around the same kernel path as createWorldAction
// (app/worlds/actions.ts), so the client TalkPanel never imports a
// server-actions module — its import graph must stay server-only-free
// (room.test.ts renders the room view in a plain tsx process).
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeWorld } from "@/lib/world/creative";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const user = await getUser().catch(() => null);
  if (!user)
    return json(
      { error: "Creating a world needs your sign-in — a world lives on someone's record." },
      401,
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send a valid JSON request." }, 400);
  }
  const title = typeof (body as any)?.title === "string" ? (body as any).title.trim().slice(0, 160) : "";
  const goal = typeof (body as any)?.goal === "string" ? (body as any).goal.trim().slice(0, 7000) : "";
  if (!title || !goal) return json({ error: "A title and a goal are required." }, 422);
  try {
    const kernel = await getKernel();
    const world = await createCreativeWorld(kernel, {
      worldId: crypto.randomUUID(),
      title,
      goal,
    });
    return json({ worldId: world.worldId, roomUrl: `/world/${world.worldId}/room` });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message.slice(0, 200) : "The world couldn't be created." },
      502,
    );
  }
}
