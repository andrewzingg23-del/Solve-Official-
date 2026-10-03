// The browser's reasoning provider: asks the server's model for an interpretation, and falls back to
// the rule-based interpreter whenever the model is unavailable (not configured, not signed in, a
// failure) or returns nothing valid. It records which one interpreted, so the World says so and so
// consequential readings from the model become proposals the person confirms.
import type { InteractionContext } from "./types";
import type { Intent, ReasoningProvider } from "./horizon";
import { validateIntent, validateRouteChoice, type RouteChoice, type RouteOption } from "./reasoning";

export type Source = { kind: "model"; model: string } | { kind: "rules" };

export type RemoteProvider = ReasoningProvider & {
  readonly lastSource: Source;
  interpret(text: string, ctx: InteractionContext, summary?: string): Promise<Intent>;
  proposeRoute(goal: string, routes: RouteOption[]): Promise<(RouteChoice & { model: string }) | null>;
};

export function remoteProvider(fallback: ReasoningProvider, fetchImpl: typeof fetch = (...args) => fetch(...args), endpoint = "/api/reason"): RemoteProvider {
  let last: Source = { kind: "rules" };
  // Asked once per page: whether a model is available to this person. Until it is, nothing is sent.
  let availability: Promise<boolean> | null = null;
  const available = () =>
    (availability ??= fetchImpl(endpoint, { method: "GET" })
      .then(async (r) => r.ok && ((await r.json()) as { available?: unknown }).available === true)
      .catch(() => false));

  async function ask(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (!(await available())) return null;
    try {
      const response = await fetchImpl(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) return null;
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return {
    id: "remote",
    get label() {
      return last.kind === "model" ? `${last.model} interpreted this (the kernel still decides every action)` : fallback.label;
    },
    get lastSource() {
      return last;
    },
    async interpret(text, ctx, summary = "") {
      const answer = await ask({ kind: "interpret", text, summary });
      // Validated again here: the browser trusts the contract, not the wire.
      const intent = answer ? validateIntent(answer.intent, text) : null;
      if (intent && typeof answer?.model === "string") {
        last = { kind: "model", model: answer.model };
        return intent;
      }
      last = { kind: "rules" };
      return fallback.interpret(text, ctx);
    },
    async proposeRoute(goal, routes) {
      if (routes.length < 2) return null;
      const answer = await ask({ kind: "route", goal, routes });
      const choice = answer ? validateRouteChoice(answer.choice, routes) : null;
      return choice && typeof answer?.model === "string" ? { ...choice, model: answer.model } : null;
    },
  };
}
