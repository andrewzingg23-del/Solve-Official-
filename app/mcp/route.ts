// The master bot's MCP connector. Assistants (Claude, ChatGPT, Meta Muse) add this URL as a custom
// connector and sign in with Sovereign; see lib/bot/connector.ts for what they can do.
import { authenticateConnector } from "@/lib/bot/mcp-auth";
import { publicOrigin, serveMcp } from "@/lib/bot/mcp-http";

const serve = (request: Request) => serveMcp(request, { authenticate: authenticateConnector, origin: publicOrigin(request) });

export const POST = serve;
export const GET = serve;
export const DELETE = serve;
export const OPTIONS = serve;
