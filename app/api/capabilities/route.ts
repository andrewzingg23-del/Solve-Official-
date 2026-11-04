import { getUser } from "@/lib/supabase/server";
import { privateJson } from "@/lib/world/http";
import { listCapabilities } from "@/lib/capabilities/registry";

export const dynamic = "force-dynamic";

// Configuration status is deliberately distinct from runtime verification.
// No secrets, tokens, callback endpoints, or private Passport data are returned.
export async function GET() {
  if (!(await getUser())) return privateJson({ error: "Sign in first." }, 401);
  return privateJson({ schema: "solve.capability-catalog.v1", capabilities: listCapabilities() });
}
