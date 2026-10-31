// Packs: the reusable tools a community runs on. A pack is built once and any community can switch
// it on, so a venture is never a separate app: Zest Solar is a community with the solar pack, an
// insurance agency is a community with the dialer, and the next person who starts one gets the same
// tools. Safe to import from client components (no kernel, no secrets).
export type PackId = "build" | "solar" | "dialer" | "risk" | "trading" | "travel";

export type Pack = {
  id: PackId;
  name: string;
  what: string;
  // Where a member uses it, when it lives on its own page.
  href: string | null;
  // Simulated until a real channel is connected; shown with the Practice label.
  practice: boolean;
};

export const PACKS: Record<PackId, Pack> = {
  build: {
    id: "build",
    name: "Build room",
    what: "Link a GitHub repository. The room shows who built what, which builds passed, and saves passed builds as proof.",
    href: null,
    practice: false,
  },
  solar: {
    id: "solar",
    name: "Solar desk",
    what: "Homeowners see their price, check whether they qualify and ask for a real design. Their requests land here, sealed, and you answer with the proposal.",
    href: "/solar",
    practice: false,
  },
  dialer: {
    id: "dialer",
    name: "Sales dialer",
    what: "Power dialing with follow-ups that keep calling hours, text consent and do-not-call for you.",
    href: "/insurance",
    practice: true,
  },
  risk: {
    id: "risk",
    name: "Risk tools",
    what: "Size every position to its stop before the trade.",
    href: "/trading",
    practice: false,
  },
  trading: {
    id: "trading",
    name: "Trading",
    what: "Live market charts with your bot reading the trend, the momentum, and the one thing to watch.",
    href: "/packs/trading",
    practice: true,
  },
  travel: {
    id: "travel",
    name: "Travel",
    what: "Your AI plans the ride or the stay; Uber and Airbnb open with it filled in, and you book there with one tap.",
    href: "/travel",
    practice: false,
  },
};

export const PACK_IDS = Object.keys(PACKS) as PackId[];

export const isPackId = (value: unknown): value is PackId => typeof value === "string" && value in PACKS;

export function packsFrom(values: unknown): PackId[] {
  const list = Array.isArray(values) ? values : [];
  return PACK_IDS.filter((id) => list.includes(id));
}
