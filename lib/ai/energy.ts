// Energy: the person's monthly AI budget, shown as the Energy bar on the AI
// card (One Solve plan, Step 3 / Step 10 "Budgets"). Fast work costs little;
// smart, code, vision, voice and the council cost more. The free tier runs on
// fast models; paid tiers unlock the rest; bring-your-own-key is unlimited.
//
// This module is the pure accounting: costs, monthly pools, what a tier may
// use, and a plain-words reason when a task can't run (never a raw error).
// Spend tracking and the month window live with the caller (kernel/usage log);
// the hourly token cap in lib/bot/chat.ts is a separate, finer guard.

/** A unit of work, mapped to a model class by the outbound router. */
export type TaskClass = "fast" | "smart" | "code" | "vision" | "voice" | "council";

export type Tier = "free" | "paid" | "byok";

/** Energy a single task of each class spends. Fast is the cheap baseline. */
export const ENERGY_COST: Record<TaskClass, number> = {
  fast: 1,
  voice: 3,
  vision: 4,
  smart: 5,
  code: 5,
  council: 12,
};

/** The monthly energy pool per tier. BYOK is unmetered (their key, their bill). */
export const MONTHLY_ENERGY: Record<Tier, number> = {
  free: 100,
  paid: 2000,
  byok: Infinity,
};

/** The free tier runs fast models only; paid and BYOK unlock every class. */
export function classAllowed(tier: Tier, task: TaskClass): boolean {
  if (tier === "free") return task === "fast";
  return true;
}

export function monthlyEnergy(tier: Tier): number {
  return MONTHLY_ENERGY[tier];
}

export function energyCost(task: TaskClass): number {
  return ENERGY_COST[task];
}

/** Energy left this month. Never negative; Infinity for BYOK. */
export function remainingEnergy(tier: Tier, spent: number): number {
  const total = monthlyEnergy(tier);
  if (total === Infinity) return Infinity;
  return Math.max(0, total - Math.max(0, spent));
}

export type Affordability =
  | { ok: true }
  | { ok: false; reason: string; upgrade: boolean };

/**
 * Can this tier run one task of this class given what's already spent?
 * A refusal carries a plain-words reason and whether upgrading would fix it,
 * so the UI can offer the next step instead of a raw error.
 */
export function canAfford(tier: Tier, spent: number, task: TaskClass): Affordability {
  if (!classAllowed(tier, task)) {
    return {
      ok: false,
      reason: `${label(task)} needs a paid plan. The free plan covers quick tasks.`,
      upgrade: true,
    };
  }
  const cost = energyCost(task);
  if (remainingEnergy(tier, spent) < cost) {
    return {
      ok: false,
      reason:
        tier === "byok"
          ? "Your key hit its own limit — check your provider."
          : "You're out of energy for this month. It refills next month, or add your own key for no limit.",
      upgrade: tier !== "byok",
    };
  }
  return { ok: true };
}

export type EnergyReadout = {
  tier: Tier;
  used: number;
  total: number; // Infinity for BYOK
  remaining: number; // Infinity for BYOK
  /** 0–100 for metered tiers; null for BYOK (no bar to fill). */
  percentUsed: number | null;
  unlimited: boolean;
};

/** What the Energy bar on the AI card shows. */
export function energyReadout(tier: Tier, spent: number): EnergyReadout {
  const total = monthlyEnergy(tier);
  const used = Math.max(0, spent);
  if (total === Infinity) {
    return { tier, used, total, remaining: Infinity, percentUsed: null, unlimited: true };
  }
  const remaining = remainingEnergy(tier, spent);
  const percentUsed = total === 0 ? 100 : Math.min(100, Math.round((used / total) * 100));
  return { tier, used, total, remaining, percentUsed, unlimited: false };
}

function label(task: TaskClass): string {
  const names: Record<TaskClass, string> = {
    fast: "Quick answers",
    smart: "Deep thinking",
    code: "Building",
    vision: "Reading images",
    voice: "Voice",
    council: "Asking the council",
  };
  return names[task];
}
