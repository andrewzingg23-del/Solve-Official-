"use server";

import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";

// Registers the browser's own guest session with the kernel. Called after the browser has made
// that session itself, when the server couldn't (see lib/supabase/become-guest.ts).
export async function registerGuest(): Promise<{ ok: boolean }> {
  if (!(await getUser())) return { ok: false };
  try {
    const kernel = await getKernel();
    try { await kernel.whoami(); } catch (error) {
      if (!(error instanceof KernelError) || error.name !== "unauthenticated") throw error;
      await kernel.register();
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
