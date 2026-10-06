"use server";

import { getKernel } from "@/lib/kernel/server";

export async function claimIdentity(name: string): Promise<{ actorId: string; label: string }> {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error("Name is required");
  const kernel = await getKernel();
  const me = await kernel.whoami().catch(() => null);
  if (me && me.label) return { actorId: me.actor_id, label: me.label };
  // Register (or re-register) with the chosen label.
  const actorId = await kernel.register(clean);
  return { actorId, label: clean };
}
