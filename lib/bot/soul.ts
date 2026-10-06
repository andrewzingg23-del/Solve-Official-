// The bot's soul.md: personality file the user writes in plain words.
// Saved per user on auth user_metadata as `bot_soul` (string).
// Pure module: safe to import from client components and tests.

export const SOUL_VIBES = ["calm", "direct", "warm", "sharp", "playful"] as const;
export type SoulVibe = (typeof SOUL_VIBES)[number];

export const MAX_SOUL_LENGTH = 2000;

export function sanitizeSoul(raw: string): string {
  return raw.trim().slice(0, MAX_SOUL_LENGTH);
}

export function isValidVibe(vibe: string): vibe is SoulVibe {
  return (SOUL_VIBES as readonly string[]).includes(vibe);
}

// Read the user's saved soul from user_metadata, with safe fallbacks.
export function getBotSoul(user: { user_metadata?: Record<string, unknown> } | null): string {
  const raw = user?.user_metadata?.bot_soul;
  return typeof raw === "string" ? sanitizeSoul(raw) : "";
}

// Steps of the guided onboarding flow. Order is the product.
export const ONBOARDING_STEPS = [
  "signin",
  "sovid",
  "avatar",
  "soul",
  "location",
  "knowyou",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function isValidStep(step: string): step is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(step);
}
