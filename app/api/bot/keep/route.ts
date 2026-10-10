// "Keep this": a line from Talk goes into the avatar's shared memory, sealed and erasable like
// every other memory. What the person said is theirs ("You"); what the avatar said is kept with the
// model that said it, so the memory always shows where it came from. Signed-in people only.
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { MemoryInputError, MemoryUnavailableError, noteMemory } from "@/lib/bot/memory";
import { keepInput } from "@/lib/bot/knowing";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const user = await getUser().catch(() => null);
  if (!user) return json({ error: "Sign in so your avatar has somewhere to keep this." }, 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Send a valid JSON request." }, 400);
  }
  const keep = keepInput(body);
  if (!keep) return json({ error: "Send the words to keep (up to 2,000 characters)." }, 422);
  try {
    const kernel = await getKernel();
    const me = await kernel.whoami();
    const saved = await noteMemory(kernel, me.actor_id, { text: keep.text, source: keep.source }, keep.via);
    return json({ id: saved.id, duplicate: saved.duplicate });
  } catch (error) {
    if (error instanceof MemoryUnavailableError) return json({ error: "Memory isn't switched on for this deployment yet. Nothing was kept." }, 503);
    if (error instanceof MemoryInputError) return json({ error: error.message }, 422);
    return json({ error: "That wasn't kept. Try again in a moment." }, 502);
  }
}
