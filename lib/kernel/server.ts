import "server-only";

import { createClient } from "@/lib/supabase/server";
import { kernelClient } from "./client";

// The kernel as the signed-in user. Every call is gated by that user's identity and grants.
export async function getKernel() {
  return kernelClient(await createClient());
}
