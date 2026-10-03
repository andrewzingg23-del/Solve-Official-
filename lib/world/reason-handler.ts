// The /api/reason request, as a pure function: who may ask, what a request may contain, and what
// comes back. Only signed-in people may use the model (it costs money and the preview is public);
// without a configured model the answer says so and the browser keeps the rules.
import type { Reasoner } from "./claude";
import { LIMITS, type RouteOption } from "./reasoning";

export type ReasonResponse = { status: number; body: Record<string, unknown> };

const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

function routeOptions(v: unknown): RouteOption[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > LIMITS.routes) return null;
  const out: RouteOption[] = [];
  for (const r of v) {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    if (!isText(o.id, 100) || !isText(o.organization, 200) || typeof o.executable !== "boolean") return null;
    if (!Array.isArray(o.steps) || o.steps.length > 10 || !o.steps.every((s) => isText(s, 300))) return null;
    if (!Array.isArray(o.blockedBy) || o.blockedBy.length > 10 || !o.blockedBy.every((s) => isText(s, 300))) return null;
    out.push({ id: o.id, organization: o.organization, steps: o.steps as string[], executable: o.executable, blockedBy: o.blockedBy as string[] });
  }
  return out;
}

// Whether this person can use the model right now (always 200, so the browser never logs an error
// for the ordinary "not available" answer).
export function reasonAvailability(deps: { signedIn: boolean; reasoner: Reasoner | null }): ReasonResponse {
  if (!deps.reasoner) return { status: 200, body: { available: false, reason: "no reasoning model is configured" } };
  if (!deps.signedIn) return { status: 200, body: { available: false, reason: "sign in to use the reasoning model" } };
  return { status: 200, body: { available: true, model: deps.reasoner.model } };
}

export async function handleReason(body: unknown, deps: { signedIn: boolean; reasoner: Reasoner | null }): Promise<ReasonResponse> {
  if (!deps.reasoner) return { status: 503, body: { available: false, reason: "no reasoning model is configured" } };
  if (!deps.signedIn) return { status: 401, body: { available: false, reason: "sign in to use the reasoning model" } };
  if (!body || typeof body !== "object") return { status: 422, body: { error: "expected a JSON object" } };
  const b = body as Record<string, unknown>;
  try {
    if (b.kind === "interpret") {
      if (!isText(b.text, LIMITS.text)) return { status: 422, body: { error: `text must be 1 to ${LIMITS.text} characters` } };
      const summary = typeof b.summary === "string" ? b.summary.slice(0, LIMITS.summary) : "";
      const intent = await deps.reasoner.interpret(b.text, summary);
      return { status: 200, body: { model: deps.reasoner.model, intent } };
    }
    if (b.kind === "route") {
      const routes = routeOptions(b.routes);
      if (!isText(b.goal, 300) || !routes) return { status: 422, body: { error: "goal and up to 10 well-formed routes are required" } };
      const choice = await deps.reasoner.chooseRoute(b.goal, routes);
      return { status: 200, body: { model: deps.reasoner.model, choice } };
    }
    return { status: 422, body: { error: "kind must be interpret or route" } };
  } catch (error) {
    // The model service failed: the browser falls back to the rules; nothing was decided.
    return { status: 502, body: { available: false, reason: error instanceof Error ? error.message.slice(0, 200) : "the model call failed" } };
  }
}
