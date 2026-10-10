import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { assembleStudio } from "@/lib/studio/document";
import { StudioWorkspace } from "./workspace";

// Preserved experimental entry. The proxy requires explicit experimental opt-in.
export default async function ExperimentalStudio() {
  const user = await getUser();
  const worlds = user ? await listCreativeWorlds(await getKernel()).catch(() => []) : [];
  return <StudioWorkspace initial={assembleStudio("architecture", "A place to create", "personal-studio")} worlds={worlds.map(world => ({ worldId: world.worldId, title: world.title }))} />;
}
