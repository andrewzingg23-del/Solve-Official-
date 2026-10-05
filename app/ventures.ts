// The ten doors. One frame (app/venture-template.tsx) renders all of them, each with one working tool.
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
    slug: "real-estate",
    name: "The Estate",
    kicker: "The Estate · Land",
    headline: "Land is the final asset.",
    thesis: "Walk the development before a shovel hits dirt. Commercial builds delivered nationwide, and the estate they all point to.",
    tool: "Walk the development",
    proofs: [
      "Every phase modeled in 3D before it's built.",
      "Commercial builds, delivered nationwide.",
      "The estate is the phase-three north star.",
    ],
    cta: { label: "Walk the land", href: "/real-estate#model", note: "Turn the model. Step through each phase." },
    metaTitle: "The Estate · Land is the final asset",
    metaDescription: "Walk the development in 3D before it's built: homes, commercial, and the estate.",
  },
  {
    slug: "insurance",
    name: "Protection",
    kicker: "Family First Life · Protection",
    headline: "A promise is only good if it's kept.",
    thesis: "Life insurance for people who take care of their own. Written by an agent who answers his phone.",
    tool: "How much coverage your family needs",
    proofs: [
      "Coverage written around your life, not a script.",
      "One agent from quote to claim. No call centers.",
      "The mission is the message.",
    ],
    goal: { value: "150", label: "agents by the end of year one" },
    cta: { label: "Get covered", href: "/start", note: "Know your number. Then talk to an agent." },
    metaTitle: "Protection · A promise is only good if it's kept",
    metaDescription: "Work out how much life insurance your family needs, then talk to an agent who answers his phone.",
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
    thesis: "Faith. Sovereignty. Brotherhood. A private community for men building themselves.",
    tool: "Take the oath",
    proofs: [
      "Fifty founding seats. Small on purpose.",
      "Oath and vouch. Nobody buys their way in.",
      "Rank is earned. Never sold.",
    ],
    goal: { value: "50", label: "founding seats" },
    cta: { label: "Apply for a seat", href: "/start", note: "Read the oath. If you can keep it, apply." },
    metaTitle: "Members Only · Become the man other men trust",
    metaDescription: "Faith. Sovereignty. Brotherhood. Fifty founding seats, by oath and vouch.",
  },
  {
    slug: "zuber-pen",
    name: "Zuber Pen",
    kicker: "Zuber Pen · Instruments",
    headline: "Never lose your pen again.",
    thesis: "A Bluetooth pen that finds your phone, captures your handwriting, and signs like it's 2030.",
    tool: "Turn the pen",
    proofs: [
      "Find-My built in. Ring it from your phone.",
      "Your notes, digitized as you write.",
      "Sign documents with a stroke.",
    ],
    cta: { label: "Join the waitlist", href: "/start", note: "In design now. Be first when it ships." },
    metaTitle: "Zuber Pen · Never lose your pen again",
    metaDescription: "A Bluetooth pen that finds your phone, captures your handwriting, and signs documents.",
  },
  {
    slug: "samantha",
    name: "Samantha",
    kicker: "Zest AI · Samantha",
    headline: "She never misses a lead.",
    thesis: "An AI receptionist that answers every call, books every job, and forgets nothing.",
    tool: "What missed calls cost you",
    proofs: [
      "Every call answered in seconds, day and night.",
      "Books straight into your calendar.",
      "Every conversation remembered. Every follow-up kept.",
    ],
    cta: { label: "Put her on your phones", href: "/start", note: "Know what you're missing. Then stop missing it." },
    metaTitle: "Samantha · She never misses a lead",
    metaDescription: "Work out what missed calls cost your business, and put an AI receptionist on your phones.",
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
    slug: "vantage",
    name: "Vantage OS",
    kicker: "Vantage OS · The Machine",
    headline: "One operator. A fleet of machines.",
    thesis: "The personal operating system behind every venture. Agents that report. A commander that decides.",
    tool: "The fleet",
    proofs: [
      "Silent workers. Loud results.",
      "Every venture, one Command Center.",
      "Built for one operator. It shows; it doesn't sell.",
    ],
    cta: { label: "Step inside", href: "/command", note: "Your Command Center. Sign in to see it." },
    metaTitle: "Vantage OS · One operator. A fleet of machines.",
    metaDescription: "The personal operating system behind every venture: agents that report, a commander that decides.",
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
