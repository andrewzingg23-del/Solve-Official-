// Horizon: intent in, structured interpretation out. A ReasoningProvider turns language plus the
// shared context into an Intent; it never acts, never sees keys, and never touches the scene.
// The default provider is deterministic and rule-based, and says so; a model provider can replace
// it behind the same interface.
import type { InteractionContext, LensId } from "./types";

export type Intent =
  | { type: "build_venture"; objective: string; strategy: "least_capital" | "standard" }
  | { type: "discover"; capability: string | null }
  | { type: "capability_query"; quantity: number | null }
  | { type: "lens"; lens: LensId; reason: string }
  | { type: "expand_control" }
  | { type: "delegate_contact"; allowPurchases: boolean }
  | { type: "commit" }
  | { type: "focus_search"; query: string }
  | { type: "unknown"; text: string };

export interface ReasoningProvider {
  readonly id: string;
  readonly label: string;
  interpret(text: string, ctx: InteractionContext): Promise<Intent>;
}

function quantity(text: string): number | null {
  const m = /(\d[\d,.]*)\s*(k|thousand)?\b/i.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(m[2] ? n * 1000 : n);
}

const CAPABILITY_WORDS: [RegExp, string][] = [
  [/manufactur|assembl|build (them|it|cars|vehicles)|produce|factory/i, "contract_manufacturing"],
  [/engineer/i, "vehicle_engineering"],
  [/design/i, "vehicle_design"],
  [/certif|homolog|lab/i, "certification"],
  [/batter/i, "battery_supply"],
  [/chassis|casting/i, "chassis_supply"],
  [/distribut|logistic|ship/i, "distribution"],
];

export const ruleProvider: ReasoningProvider = {
  id: "rules",
  label: "Rule-based interpreter (no AI model connected)",
  async interpret(raw: string): Promise<Intent> {
    const text = raw.trim().replace(/^nova[,:]?\s*/i, "");
    const t = text.toLowerCase();

    const ventureRe =
      /(car|vehicle|ev|automotive|auto)\s*(company|brand|business|startup|maker)|build (a |an )?(car|vehicle)|(build|launch|start)\s+(my|a|an)\s+[\w ]{2,40}?\s*(agency|business|company|startup|venture|brand|practice|firm)/i;
    if (ventureRe.test(t)) {
      return { type: "build_venture", objective: text, strategy: /least|minim|low|little|cheap|lean|without much|capital/.test(t) ? "least_capital" : "standard" };
    }
    if (/may contact|can contact|allowed to contact|permission to contact|you may (message|reach out|talk)|go ahead and contact/.test(t)) {
      return { type: "delegate_contact", allowPurchases: !/not|no\s+(buy|purchas|pay|commit)|don't|do not/.test(t) && /buy|purchas|pay/.test(t) };
    }
    if (/^can (they|it|he|she|this|that|you)\b.*\b(make|build|produce|manufacture|deliver|supply|do)\b/.test(t) || /how many can (they|it)/.test(t)) {
      return { type: "capability_query", quantity: quantity(t) };
    }
    if (/what else do (they|he|she|it) (control|own|run)/.test(t)) return { type: "expand_control" };
    if (/who (controls|owns|runs|is in charge|approves|governs)|who'?s in charge/.test(t)) return { type: "lens", lens: "power", reason: "Control is structure, so Power shows it." };
    if (/is (this|that|it|the claim|their claim) true|can (i|we) trust|prove|proof|verified|is it real|real\?/.test(t)) return { type: "lens", lens: "proof", reason: "Proof separates claims from what is verified." };
    if (/where did (the|my) (money|payment|\$|dollars|solve)|money go|payment (go|went)|show (me )?(my|the) payment|flow of|how did .* move/.test(t)) return { type: "lens", lens: "flow", reason: "Flow traces how value moved." };
    if (/what changed|what happened|history|timeline|since i/.test(t)) return { type: "lens", lens: "time", reason: "Time shows what changed, from the record." };
    if (/what does (this|that|it) mean for me|mean for me|about me|my (identity|assets|worlds|authority)|who am i/.test(t)) return { type: "lens", lens: "self", reason: "Self places it against you." };
    if (/block|slowing|stuck|bottleneck|holding (us|me|it) up|what's next|critical path/.test(t)) return { type: "lens", lens: "cause", reason: "Cause shows what depends on what." };
    if (/who (can help|matters|is involved|knows)|people|relationships/.test(t)) return { type: "lens", lens: "people", reason: "People shows who is connected." };
    if (/^(find|search|look for|discover)|who can (manufacture|build|make|engineer|design|certify|help)|find (me )?(someone|people|partners|suppliers|a )/.test(t)) {
      const capability = CAPABILITY_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
      return { type: "discover", capability: /\b(them|these|those)\b/.test(t) ? null : capability };
    }
    if (/\b(accept|buy|purchase|sign|commit|place (an |the )?order|order (them|it)|pay (them|it))\b/.test(t)) return { type: "commit" };
    if (/^(where is|show me|take me to|fly to|go to|zoom to)\s+/.test(t)) return { type: "focus_search", query: t.replace(/^(where is|show me|take me to|fly to|go to|zoom to)\s+/, "") };
    return { type: "unknown", text };
  },
};
