// RFC 9728 protected-resource metadata for the master bot connector at /mcp.
import { metadataResponse, protectedResourceMetadata, publicOrigin } from "@/lib/bot/mcp-http";
import { supabaseUrl } from "@/lib/supabase/config";

export function GET(request: Request) {
  // Without Supabase there is no authorization server to point to.
  if (!supabaseUrl) return new Response(null, { status: 404 });
  return metadataResponse(protectedResourceMetadata(publicOrigin(request), supabaseUrl));
}
