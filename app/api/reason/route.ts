// The reasoning boundary's server side: interprets language and suggests among kernel-computed
// routes with Claude, for signed-in people, when ANTHROPIC_API_KEY (direct) or AI_GATEWAY_API_KEY
// (through Vercel AI Gateway) is configured. It never acts.
import Anthropic from "@anthropic-ai/sdk";
import { claudeReasoner, gatewayReasoner, GATEWAY_URL } from "@/lib/world/claude";
import { handleReason, reasonAvailability } from "@/lib/world/reason-handler";
import { getUser } from "@/lib/supabase/server";

function reasonerFromEnv() {
  if (process.env.ANTHROPIC_API_KEY) return claudeReasoner(new Anthropic().beta.messages);
  if (process.env.AI_GATEWAY_API_KEY) {
    const gateway = new Anthropic({ apiKey: process.env.AI_GATEWAY_API_KEY, baseURL: GATEWAY_URL });
    return gatewayReasoner(gateway.messages, process.env.AI_GATEWAY_MODEL || undefined);
  }
  return null;
}

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
