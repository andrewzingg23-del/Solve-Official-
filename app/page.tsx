import { randomUUID } from "node:crypto";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { normalizeAppearance } from "@/lib/product/appearance";
import { isRealityMode } from "./reality/mode";
import { RealityEntry } from "./reality/entry";

export default async function Home() {
  const user = await getUser();
  const signedIn = Boolean(user && !user.is_anonymous);
  const projects = signedIn ? await listCreativeWorlds(await getKernel()).catch(() => null) : [];
  const modeCandidate: unknown = user?.user_metadata?.solve_reality_mode_v1;
  const name = typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name :
    typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
  return <RealityEntry
    owner={signedIn ? user!.id : null}
    initialMode={isRealityMode(modeCandidate) ? modeCandidate : "base"}
    initialAppearance={normalizeAppearance(signedIn ? user?.user_metadata?.sov_space_appearance : null)}
    worldId={randomUUID()}
    projects={projects}
    name={name}
  />;
}
