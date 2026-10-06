// Shared class strings for the cinematic system. One dark language everywhere.
// Cyan is the single accent — used for the primary action, key numbers, active states. Never two accents.
export const label = "text-xs font-medium uppercase tracking-[0.24em] text-muted";

export const eyebrow = "eyebrow";
export const eyebrowAccent = "eyebrow eyebrow-accent";

// Primary action: glowing cyan pill, abyssal text. One per screen.
export const primaryAction =
  "inline-flex h-12 items-center justify-center rounded-full bg-accent px-7 text-xs font-bold uppercase tracking-[0.2em] text-accent-ink transition-all duration-300 ease-calm hover:brightness-110 hover:shadow-[0_0_28px_rgb(34_211_238/0.4)] active:scale-[0.98]";

// Secondary: glass pill.
export const secondaryAction =
  "inline-flex h-12 items-center justify-center rounded-full border border-line bg-surface/60 px-7 text-xs font-semibold uppercase tracking-[0.2em] text-foreground backdrop-blur-md transition-all duration-300 ease-calm hover:border-accent hover:text-accent active:scale-[0.98]";

export const quietLink =
  "text-xs uppercase tracking-[0.2em] text-muted transition-colors duration-300 ease-calm hover:text-accent";

// Glass card shell — depth = importance. Pair with p-5/p-6.
export const glassCard = "glass p-5";

// Big stat number (tabular, tight).
export const statNumber = "stat-number text-4xl text-foreground";

// Dark input field.
export const field =
  "h-12 w-full rounded-xl border border-line bg-surface-sunken px-4 text-foreground outline-none transition-colors duration-300 ease-calm placeholder:text-faint focus:border-accent";
