// The model behind the reasoning boundary: Claude, called from the server only (the key never
// reaches a browser), directly or through Vercel AI Gateway. Output is constrained by a JSON schema
// and validated again before use; a refusal, a truncated answer or anything that fails validation
// becomes "no interpretation", and the caller falls back to the rule-based interpreter. Nothing
// here acts.
import type Anthropic from "@anthropic-ai/sdk";
import type { Intent } from "./horizon";
import { INTENT_SCHEMA, LIMITS, ROUTE_SCHEMA, SYSTEM_PROMPT, validateIntent, validateRouteChoice, type RouteChoice, type RouteOption } from "./reasoning";

export const REASONING_MODEL = "claude-opus-5-5";
// The same model through AI Gateway's Anthropic-compatible endpoint (gateway ids are
// provider-prefixed with dotted versions; AI_GATEWAY_MODEL overrides it).
export const GATEWAY_URL = "https://ai-gateway.vercel.sh";
export const GATEWAY_REASONING_MODEL = "anthropic/claude-opus-5.5";

// The slices of the SDK this uses: the beta messages surface carries Anthropic's refusal fallback;
// the gateway is called on the plain surface without it.
export type MessagesApi = Pick<Anthropic["beta"]["messages"], "create">;
export type GatewayMessagesApi = Pick<Anthropic["messages"], "create">;

export type Reasoner = {
  readonly model: string;
  interpret(text: string, summary: string): Promise<Intent | null>;
  chooseRoute(goal: string, routes: RouteOption[]): Promise<RouteChoice | null>;
};

type Ask = { effort: "low" | "medium"; schema: Record<string, unknown>; content: string };
type Reply = { stop_reason: string | null; content: { type: string; text?: string }[] };

// The request both paths send: a static, cacheable system prompt and a schema-constrained answer.
const request = (model: string, { effort, schema, content }: Ask) => ({
  model,
  max_tokens: 8_192,
  system: [{ type: "text" as const, text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } }],
  output_config: { effort, format: { type: "json_schema" as const, schema } },
  messages: [{ role: "user" as const, content }],
});

export function claudeReasoner(messages: MessagesApi, model = REASONING_MODEL): Reasoner {
  // On a classifier decline, the request re-runs on the model Anthropic recommends for it.
  return reasoner(model, (ask) =>
    messages.create({ ...request(model, ask), betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }),
  );
}

// Through Vercel AI Gateway: the same request without Anthropic's refusal-fallback beta, which the
// gateway does not document. A refusal is still no answer.
export function gatewayReasoner(messages: GatewayMessagesApi, model = GATEWAY_REASONING_MODEL): Reasoner {
  return reasoner(model, (ask) => messages.create(request(model, ask)));
}

function reasoner(model: string, send: (ask: Ask) => Promise<Reply>): Reasoner {
  async function structured(effort: "low" | "medium", schema: Record<string, unknown>, content: string): Promise<unknown> {
    const response = await send({ effort, schema, content });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
    const text = response.content.find((b) => b.type === "text");
    if (typeof text?.text !== "string") return null;
    try {
      return JSON.parse(text.text);
    } catch {
      return null;
    }
  }

  return {
    model,
    async interpret(text, summary) {
      const input = text.slice(0, LIMITS.text);
      const raw = await structured("low", INTENT_SCHEMA, `What the person sees now:\n${summary.slice(0, LIMITS.summary)}\n\nWhat they typed:\n${input}`);
      return validateIntent(raw, input);
    },
    async chooseRoute(goal, routes) {
      const offered = routes.slice(0, LIMITS.routes);
      if (offered.length === 0) return null;
      const listing = offered
        .map((r) => `route_id: ${r.id}\norganization: ${r.organization}\n${r.executable ? "executable now" : `blocked: ${r.blockedBy.join("; ")}`}\nsteps:\n${r.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`)
        .join("\n\n");
      const raw = await structured("medium", ROUTE_SCHEMA, `Goal: ${goal.slice(0, 300)}\n\nRoutes the kernel computed:\n\n${listing}`);
      return validateRouteChoice(raw, offered);
    },
  };
}
