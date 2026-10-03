// Wayfinder: derives a causal route for an objective from the planning knowledge it has. This
// version knows one domain (starting a vehicle company) from Arcadia's planning notes; every
// number it produces is an ESTIMATE and is labelled as one. A model-backed planner can replace it.

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
  domain: "vehicle_company";
  strategy: "contract_manufacturing" | "own_plant";
  title: string;
  milestones: Milestone[];
  capitalUsd: number;
  alternative: { strategy: "own_plant" | "contract_manufacturing"; capitalUsd: number };
  explanation: string;
  missing: string[];
  source: string;
};

const BASE: Omit<Milestone, "order">[] = [
  { key: "idea", title: "Idea", status: "done", capitalUsd: 0, needs: [], summary: "The objective, stated." },
  { key: "design", title: "Design", status: "open", capitalUsd: 12_000_000, needs: ["vehicle_design", "vehicle_engineering"], summary: "Vehicle concept to production-intent design." },
  { key: "prototype", title: "Prototype", status: "open", capitalUsd: 28_000_000, needs: ["vehicle_engineering"], summary: "Engineering prototypes and validation builds." },
  { key: "certification", title: "Certification", status: "open", capitalUsd: 9_000_000, needs: ["certification"], summary: "Homologation and safety certification." },
];

export function planVehicleCompany(objective: string, leastCapital: boolean): RoutePlan {
  const contract: Omit<Milestone, "order"> = {
    key: "manufacturing",
    title: "Contract manufacturing",
    status: "open",
    capitalUsd: 85_000_000,
    needs: ["contract_manufacturing", "battery_supply"],
    summary: "Tooling and a production contract with an existing plant.",
  };
  const plant: Omit<Milestone, "order"> = {
    key: "manufacturing",
    title: "Own plant",
    status: "open",
    capitalUsd: 1_150_000_000,
    needs: ["battery_supply", "chassis_supply"],
    summary: "Build and staff a vehicle plant.",
  };
  const distribution: Omit<Milestone, "order"> = {
    key: "distribution",
    title: "Distribution",
    status: "open",
    capitalUsd: 6_000_000,
    needs: ["distribution"],
    summary: "Logistics into first markets.",
  };
  const chosen = leastCapital ? contract : plant;
  const milestones = [...BASE, chosen, distribution].map((m, order) => ({ ...m, order }));
  const total = milestones.reduce((s, m) => s + m.capitalUsd, 0);
  const otherTotal = total - chosen.capitalUsd + (leastCapital ? plant : contract).capitalUsd;
  const missing = [...new Set(milestones.flatMap((m) => m.needs))];
  return {
    domain: "vehicle_company",
    strategy: leastCapital ? "contract_manufacturing" : "own_plant",
    title: leastCapital ? "Vehicle company, contract-manufactured" : "Vehicle company, own plant",
    milestones,
    capitalUsd: total,
    alternative: { strategy: leastCapital ? "own_plant" : "contract_manufacturing", capitalUsd: otherTotal },
    explanation: leastCapital
      ? "Contract manufacturing avoids the largest upfront cost: a plant. You're missing engineering and manufacturing capability."
      : "An own plant gives control at the highest upfront cost. Contract manufacturing would need far less capital.",
    missing,
    source: `Rule-based planner; Arcadia planning estimates for "${objective.slice(0, 80)}"`,
  };
}
