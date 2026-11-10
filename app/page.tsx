import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { Home } from "./home/home";

// Home. A visitor already has a kernel identity (the proxy registers an anonymous one), so what they
// write down is recorded as theirs straight away; `durable` is only whether that identity outlives
// this browser.
export default async function HomePage() {
  const user = await getUser();
  let name = "";
  let things: { id: string; title: string; summary: string }[] | null = [];
  if (user) {
    try {
      const kernel = await getKernel();
      const me = await kernel.whoami();
      const [profile] = await kernel.readActors([me.actor_id]).catch(() => []);
      name = profile?.label?.trim() ?? "";
      things = (await listCreativeWorlds(kernel)).map(w => ({ id: w.worldId, title: w.title, summary: w.summary }));
    } catch {
      things = null;
    }
  }
  return <Home owner={user?.id ?? null} durable={Boolean(user && !user.is_anonymous)} name={name} things={things} />;
}
