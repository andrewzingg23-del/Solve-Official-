import { randomUUID } from "node:crypto";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { normalizeAppearance } from "@/lib/product/appearance";
import { isRealityMode } from "./reality/mode";
import { RealityEntry } from "./reality/entry";

export default async function Home() {
  const user = await getUser();
  // A visitor already has a kernel identity (proxy.ts registers an anonymous one), so their
  // first line can be recorded as theirs straight away. `durable` is the narrower question of
  // whether that identity survives this browser — which is what signing in actually buys.
  const durable = Boolean(user && !user.is_anonymous);
  const projects = user ? await listCreativeWorlds(await getKernel()).catch(() => null) : [];
  const modeCandidate: unknown = user?.user_metadata?.solve_reality_mode_v1;
  return <RealityEntry
    owner={user ? user.id : null}
    durable={durable}
    initialMode={isRealityMode(modeCandidate) ? modeCandidate : "base"}
    initialAppearance={normalizeAppearance(user?.user_metadata?.sov_space_appearance)}
    worldId={randomUUID()}
    projects={projects}
  />;
}
