// "Your AI's brain" — a per-person choice of which model powers their AI (One Solve directive,
// 2026-11-01). Solve's memory, projects, grants and approvals NEVER change based on this choice:
// the kernel is the source of truth regardless of which brain reads/acts through it.
//
// Pure and typed: the selection model, the default, free-model resolution, and room-policy limits.
// The actual provider call, key sealing (like passport tokens), spend-cap and daily-limit
// accounting live in the chat route / kernel (they need I/O) — not here.

export type BrainKind = "own_app" | "byok" | "free" | "credits";
export type ByokProvider = "openrouter" | "openai" | "anthropic" | "google";
export type BrainStatus = "ready" | "coming_soon";

export type BrainOption = { kind: BrainKind; name: string; what: string; status: BrainStatus };

export const BRAIN_OPTIONS: Record<BrainKind, BrainOption> = {
  own_app: {
    kind: "own_app",
    name: "Your own AI app",
    what: "Use the Claude, ChatGPT or Gemini you already pay for — connect it to Solve over MCP. Solve spends nothing.",
    status: "ready",
  },
  byok: {
    kind: "byok",
    name: "Your own API key",
    what: "Bring an OpenAI, Anthropic, Google or OpenRouter key — sealed like your passport tokens, never logged, with a spend cap you set.",
    status: "ready",
  },
  free: {
    kind: "free",
    name: "Solve's free AI",
    what: "Free models with a daily limit. Good to start; switch any time.",
    status: "ready",
  },
  credits: {
    kind: "credits",
    name: "Solve credits",
    what: "Pay-as-you-go Solve credits.",
    status: "coming_soon",
  },
};

/** A person's brain setting. `keyRef` points at the sealed key event (BYOK) — never the key itself. */
export type Brain = { kind: BrainKind; byokProvider?: ByokProvider; keyRef?: string };

/** Andrew defaults to his own apps (Claude Pro + ChatGPT Plus) over MCP. Everyone else: free. */
export const FOUNDER_BRAIN: Brain = { kind: "own_app" };
export const DEFAULT_BRAIN: Brain = { kind: "free" };

export function defaultBrainFor(opts: { isFounder?: boolean } = {}): Brain {
  return opts.isFounder ? FOUNDER_BRAIN : DEFAULT_BRAIN;
}

// Solve's free AI uses OpenRouter ":free" models (no spend). Env-overridable; verify current ids
// against https://openrouter.ai/api/v1/models (the ":free" suffix is required).
export const FREE_MODEL_DEFAULT = "deepseek/deepseek-chat-v3.1:free";
export const FREE_MODEL_SMART_DEFAULT = "deepseek/deepseek-r1:free";
export const FREE_DAILY_LIMIT = 25;
export const FREE_LIMIT_MESSAGE =
  "You've used today's free AI. It resets tomorrow — or connect your own AI app or key in Your AI → Brain for no limit.";

export function freeModel(tier: "flash" | "smart" = "flash", env: Partial<NodeJS.ProcessEnv> = process.env): string {
  const override = (tier === "smart" ? env.OPENROUTER_FREE_MODEL_SMART : env.OPENROUTER_FREE_MODEL)?.trim();
  if (override) return override;
  return tier === "smart" ? FREE_MODEL_SMART_DEFAULT : FREE_MODEL_DEFAULT;
}

/** True when a model id is a no-spend OpenRouter free model. */
export const isFreeModel = (model: string): boolean => model.trim().endsWith(":free");

// Room policies (Part F) can restrict which brains a room allows. `approvedModels`, when set, is an
// allow-list of model ids (company/walled rooms pin the model list).
export type BrainPolicy = { allow: BrainKind[] | "all"; approvedModels?: string[] };
export const BRAIN_POLICY_OPEN: BrainPolicy = { allow: "all" };
/** Kid rooms: Solve's free AI only (parent-approved brains are added via explicit grants, not here). */
export const BRAIN_POLICY_KID: BrainPolicy = { allow: ["free"] };
/** Company rooms: an admin-approved model allow-list across the connect methods. */
export const brainPolicyCompany = (approvedModels: string[]): BrainPolicy => ({
  allow: ["own_app", "byok", "free"],
  approvedModels,
});

export type BrainResolution = { brain: Brain; allowed: boolean; reason?: string };

/**
 * Apply a room policy to a person's chosen brain. When the room forbids the choice, fall back to
 * free if the room allows it (with a plain reason), else block. Model allow-lists are enforced where
 * the model is known (the caller passes the resolved model id for approvedModels checks).
 */
export function resolveBrain(chosen: Brain, policy: BrainPolicy = BRAIN_POLICY_OPEN): BrainResolution {
  if (policy.allow === "all") return { brain: chosen, allowed: true };
  if (policy.allow.includes(chosen.kind)) return { brain: chosen, allowed: true };
  if (policy.allow.includes("free")) {
    return {
      brain: DEFAULT_BRAIN,
      allowed: true,
      reason: `This room allows only: ${policy.allow.join(", ")}. Using Solve's free AI here; your own choice is unchanged elsewhere.`,
    };
  }
  return { brain: chosen, allowed: false, reason: `This room doesn't allow the "${chosen.kind}" brain.` };
}
