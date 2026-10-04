import "server-only";

// Verifies a connector token with Supabase Auth and builds the two kernel sessions the connector
// uses: as the person (their own OAuth token) and as their bot (the service key, acting as the bot
// agent; null when this deployment has no service key, so the bot cannot write).
import { createClient } from "@supabase/supabase-js";
import { kernelClient } from "@/lib/kernel/client";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import type { McpAuth } from "./mcp-http";

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

// The token's client_id claim, read after Supabase Auth has verified the token.
function clientIdOf(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { client_id?: unknown };
    return typeof payload.client_id === "string" && payload.client_id ? payload.client_id : null;
  } catch {
    return null;
  }
}

export async function authenticateConnector(token: string): Promise<McpAuth | null> {
  if (!isSupabaseConfigured) return null;
  const asPerson = createClient(supabaseUrl, supabasePublishableKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: noSession });
  const { data, error } = await asPerson.auth.getUser(token);
  if (error || !data.user) return null;
  // Only tokens Sovereign issued to an OAuth client (a connected assistant) open the connector; an
  // ordinary app session cannot be replayed here.
  const clientId = clientIdOf(token);
  if (!clientId) return null;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const service = secret ? createClient(supabaseUrl, secret, { auth: noSession }) : null;
  return {
    clientId,
    person: kernelClient(asPerson),
    botAs: service ? (agentId: string) => kernelClient(service, { actAs: agentId }) : null,
  };
}
