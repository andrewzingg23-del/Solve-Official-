// The venture doors' class strings, on the brand's white floor: ink type, muted slate, hairline lines,
// and the deep cyan point on light (docs/brand/BRAND.md v3). Shared by the frame and each door's tool.
export const ink = "text-[#04070d]";
export const muted = "text-[#4d5b6c]";
export const line = "border-[#d3dde6]";
export const accent = "text-[#0891b2]";
export const label = `text-[11px] font-semibold uppercase tracking-[0.26em] ${muted}`;
export const primary = "inline-flex h-12 items-center justify-center rounded-md bg-[#04070d] px-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#f2f7fb] transition-opacity duration-300 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40";
export const secondary = `inline-flex h-12 items-center justify-center rounded-md border ${line} px-6 text-xs font-semibold uppercase tracking-[0.22em] ${ink} transition-colors duration-300 hover:border-[#0891b2] hover:text-[#0891b2]`;
export const field = `h-12 w-full rounded-md border ${line} bg-white px-3 text-sm ${ink} outline-none transition-colors focus:border-[#0891b2]`;
export const panel = `rounded-xl border ${line} bg-white/70`;
