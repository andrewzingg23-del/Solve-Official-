import { getUser } from "@/lib/supabase/server";
import { privateJson } from "@/lib/world/http";
import { listPackPreviews } from "@/lib/packs/registry";

export const dynamic = "force-dynamic";

/** Read-only catalog. Pack selection does not create tasks, connect apps or grant authority. */
export async function GET() {
  if (!(await getUser())) return privateJson({ error:"Sign in to view available Packs." }, 401);
  return privateJson({ schema:"solve.pack-catalog.v1", packs:listPackPreviews() });
}
