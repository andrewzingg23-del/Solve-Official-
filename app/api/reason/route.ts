// The reasoning boundary's server side: interprets language and suggests among kernel-computed
// routes with Claude, for signed-in people, using a direct provider key or Vercel AI Gateway.
// It never acts.
import { claudeReasoner } from "@/lib/world/claude";
import { handleReason, reasonAvailability } from "@/lib/world/reason-handler";
import { reasonerForRequest } from "@/lib/world/reasoning-config";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const reasoner = reasonerForRequest(request);
  const signedIn = reasoner ? Boolean(await getUser().catch(() => null)) : false;
  const { status, body } = reasonAvailability({ signedIn, reasoner });
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const reasoner = reasonerForRequest(request);
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const signedIn = reasoner ? Boolean(await getUser().catch(() => null)) : false;
  const { status, body: out } = await handleReason(body, { signedIn, reasoner });
  return Response.json(out, { status });
}
