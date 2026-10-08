// The venture doors' class strings, on the cinematic dark system.
// Founder law (2026-10-06, in globals.css): one dark cinematic color system app-wide,
// superseding the old light-default product law. Abyssal blue-black surfaces, ice-white
// type, one accent: hologram cyan #22d3ee. Shared by the frame and each door's tool.
export const ink = "text-foreground";
export const muted = "text-muted";
export const line = "border-line";
export const accent = "text-accent";
export const label = `text-[11px] font-semibold uppercase tracking-[0.26em] ${muted}`;

// Primary: the glowing cyan pill — one per screen, same as the product's primary action.
export const primary =
  "inline-flex h-12 items-center justify-center rounded-full bg-accent px-7 text-xs font-bold uppercase tracking-[0.22em] text-accent-ink transition-all duration-300 ease-calm hover:brightness-110 hover:shadow-[0_0_28px_rgb(34_211_238/0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

// Secondary: the glass pill.
export const secondary = `inline-flex h-12 items-center justify-center rounded-full border ${line} bg-surface/60 px-7 text-xs font-semibold uppercase tracking-[0.22em] ${ink} backdrop-blur-md transition-all duration-300 ease-calm hover:border-accent hover:text-accent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40`;

// Dark input field — abyssal, hairline border, cyan on focus.
export const field = `h-12 w-full rounded-xl border ${line} bg-surface-sunken px-4 text-sm ${ink} outline-none transition-colors duration-300 ease-calm placeholder:text-faint focus:border-accent`;

// Glass panel — depth = importance.
export const panel = "glass";
