// The doors. One frame (app/venture-template.tsx) renders all of them, each with one working tool.
// Copy is in the founder's voice: terse, declarative. Brand rules hold: nothing static pretends to be
// state (a target is shown as "the goal", never as a count), no earnings promises, and any number a
// visitor sees comes from their own inputs or a cited source.

export interface Venture {
  slug: string;
  name: string;
  kicker: string;
  headline: string;
  thesis: string;
  tool?: string; // what the working piece on the page is called
  proofs: [string, string, string];
  goal?: { value: string; label: string };
  cta: { label: string; href: string; note: string };
  metaTitle: string;
  metaDescription: string;
}

export const VENTURES: Venture[] = [
  {
    slug: "solar",
    name: "Zest Solar",
    kicker: "Zest Solar · Energy",
    headline: "Your roof is a power plant.",
    thesis: "Direct to the installer. No middlemen, no games. See your system, your numbers and your roof in 3D before anyone knocks.",
    tool: "Your solar proposal",
    proofs: [
      "FPL and Duke territory. Five years on the doors.",
      "You see the full math before you sign anything.",
      "Own your power. Stop renting it from the grid.",
    ],
    cta: { label: "See your numbers", href: "/solar#numbers", note: "Start with your bill. Two numbers, one minute." },
    metaTitle: "Zest Solar · Your roof is a power plant",
    metaDescription: "See your solar system, your savings and your home in 3D. Then get the real design, made in Aurora.",
  },
  {
    slug: "insurance",
    name: "The Agency",
    kicker: "Family First Life · The Agency",
    headline: "Every lead called. Every promise kept.",
    thesis: "The dialer for agents who answer their phone: a queue that dials, a script that closes, and follow-ups that run themselves.",
    tool: "The dialer, in Practice",
    proofs: [
      "Power dial your leads, inside calling hours, never the do-not-call list.",
      "Every outcome sets the next step: retries, reminders, welcome texts, the annual review.",
      "One agent from quote to claim. No call centers.",
    ],
    goal: { value: "150", label: "agents by the end of year one" },
    cta: { label: "Join the agency", href: "/start", note: "Agents: start with your SOV ID." },
    metaTitle: "The Agency · Every lead called. Every promise kept.",
    metaDescription: "A dialer for life insurance agents: power dialing inside calling hours, a live script, and automations for every outcome.",
  },
  {
    slug: "trading",
    name: "The Arena",
    kicker: "Sovereign · The Arena",
    headline: "The market doesn't care about your feelings.",
    thesis: "Trade virtual. Learn real. Rank by verified results, not by hype.",
    tool: "Size your position like a professional",
    proofs: [
      "Practice first. The market teaches; you don't pay tuition.",
      "Every result saved on the record. No screenshots, no stories.",
      "Rank is earned in the market. Never sold.",
    ],
    goal: { value: "100", label: "first players in the arena" },
    cta: { label: "Enter the arena", href: "/start", note: "Start in Practice. Real money stays off." },
    metaTitle: "The Arena · Trade virtual. Learn real.",
    metaDescription: "Size every trade by the risk you can take. Practice first, rank by verified results.",
  },
  {
    slug: "membership",
    name: "Members Only",
    kicker: "Members Only · The Club",
    headline: "Become the man other men trust.",
    thesis: "Faith. Sovereignty. Brotherhood. A private club for men building themselves, where your word is kept on the record.",
    tool: "Take the oath",
    proofs: [
      "Fifty founding seats. Small on purpose.",
      "Oath, vouch and interview. Nobody buys their way in.",
      "Rank is earned. Never sold.",
    ],
    goal: { value: "50", label: "founding seats" },
    cta: { label: "Apply for a seat", href: "/start", note: "Read the oath. If you can keep it, apply." },
    metaTitle: "Members Only · Become the man other men trust",
    metaDescription: "Faith. Sovereignty. Brotherhood. Fifty founding seats, by oath, vouch and interview.",
  },
  {
    slug: "zuber-pen",
    name: "Zuber Pen",
    kicker: "Zuber Pen · Instruments",
    headline: "Never lose your pen again. Or your phone.",
    thesis: "A pen that finds your phone, and a phone that finds your pen. Pair a key finder and your keys join them.",
    tool: "Turn the pen",
    proofs: [
      "Lost the pen? Ring it from your phone.",
      "Lost the phone? Ring it from the pen.",
      "Pair a key finder: pen, phone and keys, never apart.",
    ],
    cta: { label: "Join the waitlist", href: "/start", note: "In design now. Be first when it ships." },
    metaTitle: "Zuber Pen · Never lose your pen, or your phone",
    metaDescription: "A pen that finds your phone, a phone that finds your pen, and a key finder that pairs with both.",
  },
  {
    slug: "meta-ads",
    name: "Attention",
    kicker: "Attention · Meta Ads",
    headline: "Attention is inventory.",
    thesis: "Performance advertising run like a trading desk. Every dollar tracked to revenue.",
    tool: "Your break-even numbers",
    proofs: [
      "Creative tested like positions. Cut losers fast.",
      "Media buying with a P&L, not a prayer.",
      "Built inside a real operating business. Not an agency deck.",
    ],
    cta: { label: "Scale with us", href: "/start", note: "Know your break-even before you spend a dollar." },
    metaTitle: "Attention · Attention is inventory",
    metaDescription: "Work out the return on ad spend you need to break even, then run ads like a trading desk.",
  },
  {
    slug: "solve",
    name: "solve",
    kicker: "solve · The World",
    headline: "The world that grows around you.",
    thesis: "Identity, memory, rooms and proof. One world where everything you build compounds.",
    proofs: [
      "Your SOV ID. Every agent traces to a person.",
      "The record remembers what happened, and who did it.",
      "Bounded agents with receipts.",
    ],
    cta: { label: "Enter the world", href: "/start", note: "Start with what you're making real." },
    metaTitle: "solve · The world that grows around you",
    metaDescription: "Identity, memory, rooms and proof. One world where everything you build compounds.",
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
