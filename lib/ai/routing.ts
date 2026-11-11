// Which engine answers this turn.
//
// A master bot is not one model: it is a standing identity that several intelligences answer
// for. This is the rule that decides which one, and it is the whole difference between
// "multiple engines" and "one bot made of several". Pure and deterministic, so the decision
// can be tested, logged and explained to the person afterwards.
//
// Five rules, in order. The first that applies wins:
//
//   1. Sensitivity. A turn marked local-only may only reach an engine that runs locally. If
//      none is available the turn FAILS with a clear reason — it never falls through to a
//      cloud engine. This is the one rule that refuses rather than degrades, because the
//      cost of getting it wrong is disclosure, which cannot be undone.
//   2. Preference. Otherwise the bot's configured engine, if it is eligible.
//   3. Escalation. After two malformed tool calls, the configured escalation engine: the
//      model is failing to follow a schema, and a stronger one usually does.
//   4. Budget. If the window's spend is used up, the cheapest eligible engine; if none is
//      cheaper than what has already been spent against, pause and tell the person.
//   5. Availability. An engine that just failed is skipped, so a provider outage degrades
//      to another engine instead of ending the turn.
//
// What this deliberately does NOT do: pick by quality. Nothing here claims one engine
// answers better than another — that is the arbitration problem, it needs recorded outcomes
// to answer honestly, and guessing at it would be the dishonest kind of cleverness.

export type EngineLocation = "local" | "cloud";

export type Engine = {
  /** Stable id, e.g. "anthropic" or "openai". */
  id: string;
  location: EngineLocation;
  model: string;
  /** USD per million output tokens; the comparable number for "cheapest". */
  outputPricePerMTok: number;
  /** False when the engine has no credential on this deployment. */
  configured: boolean;
};

export type Turn = {
  /** The turn may not leave the machine: only a local engine may serve it. */
  localOnly?: boolean;
  /** The bot's configured engine id. */
  prefer?: string;
  /** Where to go when the preferred engine keeps failing a schema. */
  escalateTo?: string;
  /** Consecutive malformed tool calls this turn. */
  malformedToolCalls?: number;
  /** Engine ids that already failed this turn. */
  failed?: readonly string[];
  /** True when the spend window is used up (lib/bot/meter.ts decides this). */
  overBudget?: boolean;
};

export type Choice =
  | { engine: Engine; rule: "preference" | "escalation" | "budget" | "availability"; why: string }
  | { engine: null; rule: "sensitivity" | "budget" | "availability"; why: string };

const eligible = (engines: readonly Engine[], turn: Turn): Engine[] =>
  engines.filter(
    (e) =>
      e.configured &&
      !(turn.failed ?? []).includes(e.id) &&
      (!turn.localOnly || e.location === "local"),
  );

const cheapest = (engines: readonly Engine[]): Engine | null =>
  engines.length
    ? [...engines].sort(
        (a, b) => a.outputPricePerMTok - b.outputPricePerMTok || a.id.localeCompare(b.id),
      )[0]
    : null;

/** Applies the five rules in order. Never throws; a refusal is a Choice with no engine. */
export function chooseEngine(engines: readonly Engine[], turn: Turn = {}): Choice {
  const open = eligible(engines, turn);

  // 1. Sensitivity — refuse, never degrade.
  if (turn.localOnly && open.length === 0) {
    return {
      engine: null,
      rule: "sensitivity",
      why: "This turn may not leave the machine, and no local engine is available. Nothing was sent.",
    };
  }

  if (open.length === 0) {
    const reason = (turn.failed ?? []).length
      ? "Every engine that could serve this turn has already failed."
      : "No engine is configured on this deployment.";
    return { engine: null, rule: "availability", why: reason };
  }

  // 4. Budget — checked before preference, because an exhausted budget outranks a wish.
  if (turn.overBudget) {
    const cheap = cheapest(open);
    const preferred = open.find((e) => e.id === turn.prefer);
    // Only a genuinely cheaper engine is worth switching to; otherwise pause.
    if (cheap && (!preferred || cheap.outputPricePerMTok < preferred.outputPricePerMTok)) {
      return {
        engine: cheap,
        rule: "budget",
        why: `The spend window is used up, so this turn goes to the cheapest available engine (${cheap.id}).`,
      };
    }
    return {
      engine: null,
      rule: "budget",
      why: "The spend window is used up and no cheaper engine is available. Nothing was sent.",
    };
  }

  // 3. Escalation — two malformed tool calls means the schema, not the task, is the problem.
  if ((turn.malformedToolCalls ?? 0) >= 2 && turn.escalateTo) {
    const stronger = open.find((e) => e.id === turn.escalateTo);
    if (stronger) {
      return {
        engine: stronger,
        rule: "escalation",
        why: `Two malformed tool calls, so this turn escalates to ${stronger.id}.`,
      };
    }
  }

  // 2. Preference.
  const preferred = open.find((e) => e.id === turn.prefer);
  if (preferred) {
    return { engine: preferred, rule: "preference", why: `The configured engine (${preferred.id}).` };
  }

  // 5. Availability — whatever is left, cheapest first, so a fallback is never a surprise bill.
  const fallback = cheapest(open)!;
  const why = (turn.failed ?? []).length
    ? `The configured engine failed, so this turn falls back to ${fallback.id}.`
    : `No engine was configured for this bot, so this turn goes to ${fallback.id}.`;
  return { engine: fallback, rule: "availability", why };
}
