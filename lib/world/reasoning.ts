// The reasoning contract shared by the server (which calls the model) and the browser (which
// asks the server): what a model may return, and the validation that output must pass before
// anything uses it. A model interprets language into one of the World's intents and may suggest
// one of the routes the Horizon already computed; it never acts, never sees keys or ids it was not
// given, and never decides authority. The kernel decides every action, as it does for the rules.
import type { Intent } from "./horizon";
import type { LensId } from "./types";

export const LENSES: LensId[] = ["space", "people", "power", "flow", "cause", "proof", "time", "self"];
export const CAPABILITIES = ["contract_manufacturing", "vehicle_engineering", "vehicle_design", "certification", "battery_supply", "chassis_supply", "distribution"];
const INTENT_TYPES = ["build_venture", "discover", "capability_query", "lens", "expand_control", "delegate_contact", "commit", "focus_search", "unknown"] as const;

export const LIMITS = { text: 500, summary: 2_000, routes: 10, rationale: 300 } as const;

// Static, so it caches across requests; everything per-request goes in the user turn.
export const SYSTEM_PROMPT = `You interpret what a person types into Sovereign's World, a map of organizations, people and Worlds that a governed kernel controls. You return one structured interpretation. You never act: every action is decided by the kernel against the person's grants, and consequential steps are always confirmed by the person.

Intent types:
- build_venture: they want to start a company or World. objective = their words; strategy = "least_capital" if they stress little upfront money, else "standard".
- discover: they want to find organizations with a capability. capability = one of ${CAPABILITIES.join(", ")}, or null if they refer to "them"/"these" or none fits.
- capability_query: they ask whether a selected supplier can make or do something. quantity = the number asked about, or null.
- lens: they want to understand something. lens = power (who controls), proof (is it true), flow (where money went), time (what changed), self (what it means for me), cause (what blocks progress), people (who is involved), space (where things are). reason = one short sentence.
- expand_control: they ask what else an organization or person controls.
- delegate_contact: they explicitly allow their companion to contact suppliers. allowPurchases = true only if they explicitly allow buying, ordering or paying.
- commit: they want to accept terms, order, buy, sign or pay.
- focus_search: they ask to see or go to a place. query = the place.
- unknown: none of the above fits, or you are unsure. text = their words.

Rules: choose unknown rather than guess. Never invent capabilities, places or organizations. Fill every field; use null for fields the chosen type does not use.

When asked to choose a route, you receive routes the kernel already computed, each with who acts and what the kernel decides for them. Choose the one that best serves the goal now, preferring routes that are executable, need fewer handoffs, and rest on verified evidence. route_id must be one of the ids given. rationale is one or two plain sentences.`;

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

// One flat object (every field required, unused ones null): simple for constrained decoding, and
// mapped to the Intent union by validateIntent.
export const INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "objective", "strategy", "capability", "quantity", "lens", "reason", "allowPurchases", "query", "text"],
  properties: {
    type: { type: "string", enum: [...INTENT_TYPES] },
    objective: nullable({ type: "string" }),
    strategy: nullable({ type: "string", enum: ["least_capital", "standard"] }),
    capability: nullable({ type: "string", enum: CAPABILITIES }),
    quantity: nullable({ type: "integer" }),
    lens: nullable({ type: "string", enum: LENSES }),
    reason: nullable({ type: "string" }),
    allowPurchases: nullable({ type: "boolean" }),
    query: nullable({ type: "string" }),
    text: nullable({ type: "string" }),
  },
} as const;

export const ROUTE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["route_id", "rationale"],
  properties: { route_id: { type: "string" }, rationale: { type: "string" } },
} as const;

const str = (v: unknown, max: number = LIMITS.text) => (typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : null);

// Whatever the model returned becomes an Intent only if it is one, with values the World knows.
export function validateIntent(raw: unknown, original: string): Intent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case "build_venture":
      return { type: "build_venture", objective: str(r.objective) ?? original.slice(0, LIMITS.text), strategy: r.strategy === "least_capital" ? "least_capital" : "standard" };
    case "discover":
      return { type: "discover", capability: typeof r.capability === "string" && CAPABILITIES.includes(r.capability) ? r.capability : null };
    case "capability_query": {
      const q = r.quantity;
      return { type: "capability_query", quantity: typeof q === "number" && Number.isInteger(q) && q > 0 && q <= 100_000_000 ? q : null };
    }
    case "lens":
      return LENSES.includes(r.lens as LensId) ? { type: "lens", lens: r.lens as LensId, reason: str(r.reason, 200) ?? "" } : null;
    case "expand_control":
      return { type: "expand_control" };
    case "delegate_contact":
      return { type: "delegate_contact", allowPurchases: r.allowPurchases === true };
    case "commit":
      return { type: "commit" };
    case "focus_search": {
      const query = str(r.query, 200);
      return query ? { type: "focus_search", query } : null;
    }
    case "unknown":
      return { type: "unknown", text: original.slice(0, LIMITS.text) };
    default:
      return null;
  }
}

export type RouteOption = { id: string; organization: string; steps: string[]; executable: boolean; blockedBy: string[] };
export type RouteChoice = { routeId: string; rationale: string };

// A suggestion counts only if it names a route the kernel computed.
export function validateRouteChoice(raw: unknown, offered: RouteOption[]): RouteChoice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const option = offered.find((o) => o.id === r.route_id);
  const rationale = str(r.rationale, LIMITS.rationale);
  return option && rationale ? { routeId: option.id, rationale } : null;
}

// Intents with consequences: a model's reading of them is only ever a proposal for the person to
// confirm, never executed from interpretation alone.
export const CONSEQUENTIAL: Intent["type"][] = ["delegate_contact", "commit"];
