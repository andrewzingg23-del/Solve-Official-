// The engines this deployment can actually reach, assembled from its configuration.
//
// An engine exists here only if its credential is present, so the routing policy
// (lib/ai/routing.ts) never chooses something that would 503 a moment later. Pure given an
// env object, so the whole table is testable without a key.
//
// Credentials are read here and nowhere else in the AI path; the adapters take a key as an
// argument. Nothing in this module is sent to a browser, and no model id or key is ever
// accepted from one.

import { ANTHROPIC_DEFAULT_MODEL, ANTHROPIC_MODELS, type AnthropicModel } from "./anthropic";
import { OPENAI_DEFAULT_MODEL } from "./openai";
import type { Engine } from "./routing";

export type EngineId = "anthropic" | "openai";

/**
 * A price we do not know. Routing compares prices only to find something *cheaper*, so an
 * unknown price means "never chosen as a cost saving" — it can still be chosen by
 * preference or as an availability fallback. Inventing a number would be worse than this.
 */
export const UNKNOWN_PRICE = Number.POSITIVE_INFINITY;

/**
 * The configuration this module reads. An index signature, so `process.env` is accepted
 * directly; the keys below are the ones that matter:
 *   ANTHROPIC_API_KEY, ANTHROPIC_MODEL, OPENAI_API_KEY, OPENAI_MODEL,
 *   SOLVE_AI_ENGINE — which engine this deployment prefers; unset lets the policy decide.
 */
export type AiEnv = Record<string, string | undefined>;

const clean = (v: string | undefined): string => (typeof v === "string" ? v.trim() : "");

/** The Anthropic model for this deployment, and its output price if we know it. */
function anthropicModel(env: AiEnv): { model: string; price: number } {
  const configured = clean(env.ANTHROPIC_MODEL) || ANTHROPIC_DEFAULT_MODEL;
  const known = ANTHROPIC_MODELS[configured as AnthropicModel];
  return { model: configured, price: known ? known.output : UNKNOWN_PRICE };
}

/** Every engine with a credential present, in a stable order. */
export function enginesFrom(env: AiEnv): Engine[] {
  const anthropic = anthropicModel(env);
  return [
    {
      id: "anthropic",
      location: "cloud",
      model: anthropic.model,
      outputPricePerMTok: anthropic.price,
      configured: Boolean(clean(env.ANTHROPIC_API_KEY)),
    },
    {
      id: "openai",
      location: "cloud",
      model: clean(env.OPENAI_MODEL) || OPENAI_DEFAULT_MODEL,
      // This deployment's OpenAI model has no published price in this repo. Unknown, not zero.
      outputPricePerMTok: UNKNOWN_PRICE,
      configured: Boolean(clean(env.OPENAI_API_KEY)),
    },
  ];
}

/** The deployment's preferred engine id, if it names a real one. */
export function preferredEngine(env: AiEnv): EngineId | undefined {
  const named = clean(env.SOLVE_AI_ENGINE);
  return named === "anthropic" || named === "openai" ? named : undefined;
}

/** The key for an engine. Returned to the caller, never logged or returned to a browser. */
export function keyFor(id: string, env: AiEnv): string {
  if (id === "anthropic") return clean(env.ANTHROPIC_API_KEY);
  if (id === "openai") return clean(env.OPENAI_API_KEY);
  return "";
}

/** True when this deployment can answer at all. */
export function anyEngineConfigured(env: AiEnv): boolean {
  return enginesFrom(env).some((e) => e.configured);
}

export const NO_ENGINE_ERROR =
  "No AI engine is configured on this SOLVE deployment. An Anthropic or OpenAI API key is needed.";
