// For MCP clients that look for authorization-server metadata on the resource's own origin: the
// same document Supabase Auth publishes for Sovereign's OAuth server.
import { metadataResponse } from "@/lib/bot/mcp-http";
import { supabaseUrl } from "@/lib/supabase/config";

export async function GET() {
  if (!supabaseUrl) return new Response(null, { status: 404 });
  const upstream = await fetch(`${supabaseUrl.replace(/\/$/, "")}/.well-known/oauth-authorization-server/auth/v1`, { next: { revalidate: 300 } }).catch(() => null);
  if (!upstream?.ok) return new Response(null, { status: 502 });
  return metadataResponse(await upstream.json());
}
