// The reasoning boundary's server side: interprets language and suggests among kernel-computed
// routes with Claude, for signed-in people, when ANTHROPIC_API_KEY is configured. It never acts.
import Anthropic from "@anthropic-ai/sdk";
import { claudeReasoner } from "@/lib/world/claude";
import { handleReason, reasonAvailability } from "@/lib/world/reason-handler";
import { getUser } from "@/lib/supabase/server";

const reasonerFromEnv = () => (process.env.ANTHROPIC_API_KEY ? claudeReasoner(new Anthropic().beta.messages) : null);

export async function GET() {
  const reasoner = reasonerFromEnv();
  const signedIn = reasoner ? Boolean(await getUser().catch(() => null)) : false;
  const { status, body } = reasonAvailability({ signedIn, reasoner });
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const reasoner = reasonerFromEnv();
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
