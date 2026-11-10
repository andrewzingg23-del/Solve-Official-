"use server";

import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";

export type ExportResult = { ok: true; json: string; filename: string } | { ok: false; error: string };

// Everything a person holds authority over, as one document they can keep. The kernel decides what
// is theirs; this only hands it over. Nothing of anyone else's is included.
export async function exportEverything(): Promise<ExportResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const data = await (await getKernel()).exportMine();
    const stamp = new Date().toISOString().slice(0, 10);
    return { ok: true, json: JSON.stringify(data, null, 2), filename: `solve-export-${stamp}.json` };
  } catch {
    return { ok: false, error: "Your export couldn't be prepared here yet. Nothing has changed." };
  }
}
