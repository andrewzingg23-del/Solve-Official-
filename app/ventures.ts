// The ten doors. One shared template (app/venture-template.tsx) renders all of
// them — adding venture eleven is one object here, not a new page build.
// Copy is in the founder's voice: terse, declarative, authority-first.

export interface Venture {
  slug: string;
  kicker: string;
  headline: string;
  thesis: string;
  proofs: [string, string, string];
  stat: { value: string; label: string };
  cta: { label: string; href: string };
  metaTitle: string;
  metaDescription: string;
}

export const VENTURES: Venture[] = [
  {
    slug: "trading",
    kicker: "Sovereign · The Game",
    headline: "The market doesn't care about your feelings.",
    thesis: "Trade virtual. Learn real. Rank by verified results, not by hype.",
    proofs: [
      "Risk-free first trade — the market teaches, you don't pay tuition.",
      "Every result verified on the ledger. No screenshots, no stories.",
      "Rank is earned in the market. Never sold.",
    ],
    stat: { value: "100", label: "first players in the arena" },
    cta: { label: "Enter the arena", href: "/start" },
    metaTitle: "Sovereign — Trade virtual. Learn real.",
    metaDescription:
      "The market doesn't care about your feelings. Trade virtual, learn real, rank by verified results.",
  },
  {
    slug: "insurance",
    kicker: "Family First Life · Protection",
    headline: "A promise is only good if it's kept.",
    thesis:
      "Life insurance for people who take care of their own. Written by an agent who answers his phone.",
    proofs: [
      "Coverage written around your life, not a script.",
      "One agent from quote to claim. No call centers.",
      "Building 150 agents. The mission is the message.",
    ],
    stat: { value: "150", label: "agents by year one" },
    cta: { label: "Get covered", href: "/start" },
    metaTitle: "Insurance — A promise is only good if it's kept",
    metaDescription:
      "Life insurance for people who take care of their own. Written by an agent who answers his phone.",
  },
  {
    slug: "solar",
    kicker: "Zest Solar · Energy",
    headline: "Your roof is a power plant.",
    thesis:
      "Direct to the installer. No middlemen, no games — the numbers speak.",
    proofs: [
      "FPL and Duke territory. Five years on the doors.",
      "You see the full math before you sign anything.",
      "Own your power. Stop renting it from the grid.",
    ],
    stat: { value: "5", label: "years door-to-door" },
    cta: { label: "See your numbers", href: "/start" },
    metaTitle: "Zest Solar — Your roof is a power plant",
    metaDescription:
      "Direct to the installer. No middlemen, no games — the numbers speak.",
  },
  {
    slug: "membership",
    kicker: "Members Only · The Club",
    headline: "Become the man other men trust.",
    thesis:
      "Faith. Sovereignty. Brotherhood. A private community for men building themselves.",
    proofs: [
      "Fifty founding seats. Small on purpose.",
      "Oath and vouch. Nobody buys their way in.",
      "Rank is earned. Never sold.",
    ],
    stat: { value: "50", label: "founding seats" },
    cta: { label: "Apply for a seat", href: "/start" },
    metaTitle: "Members Only — Become the man other men trust",
    metaDescription:
      "Faith. Sovereignty. Brotherhood. A private community for men building themselves.",
  },
  {
    slug: "zuber-pen",
    kicker: "Zuber Pen · Instruments",
    headline: "Never lose your pen again.",
    thesis:
      "A Bluetooth pen that finds your phone, captures your handwriting, and signs like it's 2030.",
    proofs: [
      "Find-My built in. Ring it from your phone.",
      "Your notes, digitized as you write.",
      "Sign documents with a stroke. Literally.",
    ],
    stat: { value: "1", label: "pen to replace them all" },
    cta: { label: "Join the waitlist", href: "/start" },
    metaTitle: "Zuber Pen — Never lose your pen again",
    metaDescription:
      "A Bluetooth pen that finds your phone, captures your handwriting, and signs like it's 2030.",
  },
  {
    slug: "real-estate",
    kicker: "The Estate · Land",
    headline: "Land is the final asset.",
    thesis:
      "3D-visualized developments, commercial builds delivered nationwide, and the estate they all point to.",
    proofs: [
      "Walk the development before a shovel hits dirt.",
      "Commercial builds, delivered nationwide.",
      "The estate is the phase-three north star.",
    ],
    stat: { value: "100%", label: "visualized before built" },
    cta: { label: "Walk the land", href: "/start" },
    metaTitle: "Real Estate — Land is the final asset",
    metaDescription:
      "3D-visualized developments, commercial builds delivered nationwide, and the estate they all point to.",
  },
  {
    slug: "samantha",
    kicker: "Zest AI · Samantha",
    headline: "She never misses a lead.",
    thesis:
      "An AI receptionist that answers every call, books every job, and forgets nothing.",
    proofs: [
      "Every call answered in seconds. 24/7.",
      "Books straight into your calendar.",
      "Every conversation remembered. Every follow-up kept.",
    ],
    stat: { value: "24/7", label: "on the phones" },
    cta: { label: "Hear her work", href: "/start" },
    metaTitle: "Samantha — She never misses a lead",
    metaDescription:
      "An AI receptionist that answers every call, books every job, and forgets nothing.",
  },
  {
    slug: "meta-ads",
    kicker: "Attention · Meta Ads",
    headline: "Attention is inventory.",
    thesis:
      "Performance advertising run like a trading desk. Every dollar tracked to revenue.",
    proofs: [
      "Creative tested like positions. Cut losers fast.",
      "Media buying with a P&L, not a prayer.",
      "Built inside a real operating business. Not an agency deck.",
    ],
    stat: { value: "100%", label: "of spend accountable" },
    cta: { label: "Scale with us", href: "/start" },
    metaTitle: "Meta Ads — Attention is inventory",
    metaDescription:
      "Performance advertising run like a trading desk. Every dollar tracked to revenue.",
  },
  {
    slug: "vantage",
    kicker: "Vantage OS · The Machine",
    headline: "One operator. A fleet of machines.",
    thesis:
      "The personal operating system behind the empire. Agents that report. A commander that decides.",
    proofs: [
      "Silent workers. Loud results.",
      "Every venture, one dashboard.",
      "Built for one operator. It shows, it doesn't sell.",
    ],
    stat: { value: "1", label: "operator" },
    cta: { label: "Step inside", href: "/start" },
    metaTitle: "Vantage OS — One operator. A fleet of machines.",
    metaDescription:
      "The personal operating system behind the empire. Agents that report. A commander that decides.",
  },
  {
    slug: "solve",
    kicker: "Solve · The World",
    headline: "The world that grows around you.",
    thesis:
      "Identity, memory, rooms, and proof — one world where everything you build compounds.",
    proofs: [
      "Your SOV ID. Every agent traces to a verified human.",
      "The kernel remembers everything. Nothing learned is ever lost.",
      "Bounded agents with receipts.",
    ],
    stat: { value: "01", label: "world. Yours." },
    cta: { label: "Enter the world", href: "/start" },
    metaTitle: "Solve — The world that grows around you",
    metaDescription:
      "Identity, memory, rooms, and proof — one world where everything you build compounds.",
  },
];

export function getVenture(slug: string): Venture {
  const venture = VENTURES.find((v) => v.slug === slug);
  if (!venture) throw new Error(`Unknown venture: ${slug}`);
  return venture;
}

export function nextVenture(slug: string): Venture {
  const index = VENTURES.findIndex((v) => v.slug === slug);
  return VENTURES[(index + 1) % VENTURES.length];
}
