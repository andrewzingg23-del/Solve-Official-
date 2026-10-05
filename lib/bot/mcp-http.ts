// The connector over Streamable HTTP (MCP): JSON-RPC in POST bodies, JSON responses, no server-
// initiated stream. Authentication is injected, so this is testable without Supabase. Missing or
// invalid tokens get 401 with a pointer to the protected-resource metadata, which is how MCP
// clients discover Sovereign's OAuth server.
import { createConnector, type Session } from "./connector";

export type McpAuth = Pick<Session, "clientId" | "person" | "botAs" | "onActivity">;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export const resourceMetadataUrl = (origin: string) => `${origin}/.well-known/oauth-protected-resource/mcp`;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS, ...headers } });

export async function serveMcp(
  request: Request,
  deps: { authenticate(token: string): Promise<McpAuth | null>; origin: string; now?: () => Date },
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  // No server-initiated stream and no sessions to end.
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS } });

  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() ?? "";
  const auth = token ? await deps.authenticate(token).catch(() => null) : null;
  if (!auth) {
    const challenge = `Bearer resource_metadata="${resourceMetadataUrl(deps.origin)}"${token ? ', error="invalid_token"' : ""}`;
    return json({ error: token ? "invalid_token" : "unauthorized" }, 401, { "WWW-Authenticate": challenge });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  const connector = createConnector({ ...auth, appUrl: deps.origin, now: deps.now });
  if (Array.isArray(body)) {
    if (body.length === 0) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, 400);
    const responses = (await Promise.all(body.map((m) => connector.handle(m)))).filter(Boolean);
    return responses.length ? json(responses) : new Response(null, { status: 202, headers: CORS });
  }
  const response = await connector.handle(body);
  return response ? json(response) : new Response(null, { status: 202, headers: CORS });
}

// RFC 9728 metadata for the connector: where its authorization server is.
export function protectedResourceMetadata(origin: string, supabaseUrl: string) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [`${supabaseUrl.replace(/\/$/, "")}/auth/v1`],
    bearer_methods_supported: ["header"],
    resource_name: "Sovereign master bot",
    resource_documentation: `${origin}/bot`,
  };
}

export const metadataResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", ...CORS } });

// The public origin of a request, as clients see it.
export function publicOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
