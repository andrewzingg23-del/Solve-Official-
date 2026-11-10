import type { Kernel } from "@/lib/kernel/client";
import { listCreativeWorlds } from "@/lib/world/creative";

/** A person's things, as the new surfaces list them. Null means they could not be read. */
export async function myThings(kernel: Kernel): Promise<{ id: string; title: string; summary: string }[] | null> {
  try {
    return (await listCreativeWorlds(kernel)).map(w => ({ id: w.worldId, title: w.title, summary: w.summary }));
  } catch {
    return null;
  }
}
