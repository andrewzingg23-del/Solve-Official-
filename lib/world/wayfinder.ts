// Wayfinder: derives a causal route for an objective from the planning knowledge it has. This
// version plans a lean venture from first principles; every number it produces is an ESTIMATE
// and is labelled as one. A model-backed planner can replace it.

export type Milestone = {
  key: string;
  title: string;
  order: number;
  status: "done" | "open";
  capitalUsd: number;
  needs: string[]; // capability keys
  summary: string;
};

export type RoutePlan = {
  domain: "venture";
  strategy: "lean" | "funded";
  title: string;
  milestones: Milestone[];
  capitalUsd: number;
  alternative: { strategy: "lean" | "funded"; capitalUsd: number };
  explanation: string;
  missing: string[];
  source: string;
};

const BASE: Omit<Milestone, "order">[] = [
  { key: "idea", title: "Idea", status: "done", capitalUsd: 0, needs: [], summary: "The objective, stated." },
  {
    key: "validate",
    title: "Validate",
    status: "open",
    capitalUsd: 500,
    needs: ["customer_discovery"],
    summary: "Twenty real conversations with prospective customers before spending more.",
  },
  {
    key: "first_customers",
    title: "First customers",
    status: "open",
    capitalUsd: 2_000,
    needs: ["delivery"],
    summary: "Deliver manually to the first ten. Revenue before process.",
  },
  {
    key: "systematize",
    title: "Systematize",
    status: "open",
    capitalUsd: 5_000,
    needs: ["operations"],
    summary: "Turn what worked into a repeatable process with basic tooling.",
  },
];

const SCALE: Omit<Milestone, "order"> = {
  key: "scale",
  title: "Scale",
  status: "open",
  capitalUsd: 25_000,
  needs: ["distribution"],
  summary: "One working channel, then hire against it.",
};

/** "Help me launch my insurance agency…" → "Your Insurance Agency". */
export function ventureTitle(objective: string): string {
  const m = /\bmy\s+([a-z][a-z ]{1,40}?)\s+(with|for|to|using|from|$)/i.exec(objective);
  const noun = m?.[1]?.trim().replace(/\s+/g, " ");
  if (noun) {
    const titled = noun.replace(/\b\w/g, (c) => c.toUpperCase());
    return `Your ${titled}`;
  }
  return "Your venture";
}

export function planVenture(objective: string, leastCapital: boolean): RoutePlan {
  const milestones = [...BASE, ...(leastCapital ? [] : [SCALE])].map((m, order) => ({ ...m, order }));
  const total = milestones.reduce((s, m) => s + m.capitalUsd, 0);
  const otherTotal = total + (leastCapital ? SCALE.capitalUsd : -SCALE.capitalUsd);
  const missing = [...new Set(milestones.flatMap((m) => m.needs))];
  return {
    domain: "venture",
    strategy: leastCapital ? "lean" : "funded",
    title: leastCapital ? "Venture, lean path" : "Venture, funded path",
    milestones,
    capitalUsd: total,
    alternative: { strategy: leastCapital ? "funded" : "lean", capitalUsd: otherTotal },
    explanation: leastCapital
      ? "Lean avoids the largest upfront cost: scaling before the offer works. You're missing customer conversations first."
      : "The funded path buys speed at higher upfront cost. Lean would need far less capital.",
    missing,
    source: `Rule-based planner; lean-startup estimates for "${objective.slice(0, 80)}"`,
  };
}
