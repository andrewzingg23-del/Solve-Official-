// Creates the server-side reasoning client without exposing provider credentials.
// On Vercel, OIDC arrives as a trusted function request header at runtime. The env fallback
// covers builds and local development where Vercel provides VERCEL_OIDC_TOKEN directly.
import Anthropic from "@anthropic-ai/sdk";
import { claudeReasoner, gatewayReasoner, GATEWAY_URL, type Reasoner } from "./claude";

type ReasoningEnvironment = {
  NODE_ENV?: string;
  ANTHROPIC_API_KEY?: string;
  AI_GATEWAY_API_KEY?: string;
  VERCEL_OIDC_TOKEN?: string;
  AI_GATEWAY_MODEL?: string;
};

export function reasonerFromEnv(
  env: ReasoningEnvironment = process.env,
  requestOidcToken?: string | null,
): Reasoner | null {
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return claudeReasoner(new Anthropic({ apiKey: anthropicKey }).beta.messages);
  }

  const gatewayKey = env.AI_GATEWAY_API_KEY?.trim();
  const oidcToken = requestOidcToken?.trim() || env.VERCEL_OIDC_TOKEN?.trim();
  const apiKey = gatewayKey || oidcToken;
  if (!apiKey) return null;

  const gateway = new Anthropic({ apiKey, baseURL: GATEWAY_URL });
  return gatewayReasoner(gateway.messages, env.AI_GATEWAY_MODEL?.trim() || undefined);
}

export function reasonerForRequest(
  request: Pick<Request, "headers">,
  env: ReasoningEnvironment = process.env,
): Reasoner | null {
  return reasonerFromEnv(env, request.headers.get("x-vercel-oidc-token"));
}
