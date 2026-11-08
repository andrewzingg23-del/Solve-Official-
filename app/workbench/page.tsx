import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";

export default async function WorkbenchEntryPage() {
  const user = await getUser();
  if (!user || user.is_anonymous) redirect("/login?next=%2Fworkbench");
  const worlds = await listCreativeWorlds(await getKernel()).catch(() => null);
  if (worlds && worlds.length > 0) redirect("/world/" + encodeURIComponent(worlds[0].worldId) + "/workbench");
  redirect("/");
}
