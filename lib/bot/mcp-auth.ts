import "server-only";

// Verifies a connector token with Supabase Auth. Only an app connected as itself is served: the
// kernel resolves its token to the app's own agent (20261110070000), and that token is the only
// authority the connector uses — no service key, no acting as anyone else. Any other token (an app
// connected before per-app agents, or a person's own session) gets 401, which sends the client back
// through sign-in and consent, where it is connected as itself (20261111000000).
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
  const asApp = createClient(supabaseUrl, supabasePublishableKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: noSession });
  const { data, error } = await asApp.auth.getUser(token);
  if (error || !data.user) return null;
  const clientId = clientIdOf(token);
  if (!clientId) return null;
  const app = kernelClient(asApp);
  const me = await app.whoami().catch(() => null);
  return me?.kind === "agent" ? { clientId, app } : null;
}
