// The reasoning boundary's server side: interprets language and suggests among kernel-computed
// routes with Claude, for signed-in people, using a direct provider key or Vercel AI Gateway.
// It never acts.
import { handleReason, reasonAvailability } from "@/lib/world/reason-handler";
import { openRouterReasoner } from "@/lib/world/claude";
import { readProvider } from "@/lib/ai/provider";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";

async function personalReasoner() {
  const user = await getUser().catch(() => null);
  if (!user) return { user: null, reasoner: null };
  const provider = await readProvider(await getKernel()).catch(() => null);
  return { user, reasoner: provider ? openRouterReasoner(provider.apiKey, provider.model) : null };
}

export async function GET() {
  const { user, reasoner } = await personalReasoner();
  const signedIn = Boolean(user);
  const { status, body } = reasonAvailability({ signedIn, reasoner });
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const { user, reasoner } = await personalReasoner();
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const signedIn = Boolean(user);
  const { status, body: out } = await handleReason(body, { signedIn, reasoner });
  return Response.json(out, { status });
}
