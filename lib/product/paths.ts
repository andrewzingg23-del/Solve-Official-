// Where an intention gets made.
//
// The unit is the person's intention — a thing, with its goal and the people building it — and it
// always lives in SOLVE. Tools are paths it can take: SOLVE's own (native), a tool SOLVE can act
// in with permission (connected), a tool SOLVE prepares work for and opens for the person
// (handoff), or nothing available (said plainly). No tool is part of the architecture; each is an
// entry here, and adding one is adding an entry.
//
// The recommendation is a function of what the person's own words need — never of which provider
// SOLVE might have a relationship with. There is deliberately no input for that.

import LZString from "lz-string";

export type Support = "native" | "connected" | "handoff" | "unavailable";

/** What an intention needs, read from the person's own words. */
export type Needs = {
  website: boolean;   // a site, page, portfolio
  software: boolean;  // accounts, logins, a database, payments, an app or game — things that need code running
  share: boolean;     // show it to people
};

const has = (words: string, pattern: RegExp) => pattern.test(words.toLowerCase());

export function needsOf(words: string): Needs {
  const software = has(words, /\b(app|apps|application|game|games|login|log in|sign[- ]?up|accounts?|users|database|backend|api|dashboard|booking|bookings|checkout|payments?|store|shop|saas|tool that|calculator|bot)\b/);
  const website = software || has(words, /\b(website|web site|site|landing page|homepage|home page|portfolio|blog|web page|webpage)\b/);
  const share = website || has(words, /\b(show|share|page|profile|gallery|publish)\b/);
  return { website, software, share };
}

export type Path = {
  id: string;
  name: string;
  support: Support;
  /** One sentence, in plain words, about why this path fits — or doesn't. */
  why: string;
  recommended: boolean;
};

export type Tool = {
  id: string;
  name: string;
  support: Support;
  fits: (needs: Needs) => { fits: boolean; strong: boolean; why: string };
};

/** The tools SOLVE knows about. Order here never decides the recommendation. */
export const TOOLS: Tool[] = [
  {
    id: "solve-page",
    name: "Here, as a page",
    support: "native",
    fits: needs => needs.software
      ? { fits: true, strong: false, why: "A page here can show what it is and who's making it, but it can't run logins, stored data or payments." }
      : { fits: true, strong: needs.share, why: "Build it here with your people, then share it as a page anyone can open — no account needed to look." },
  },
  {
    id: "replit",
    name: "Replit",
    support: "handoff",
    fits: needs => needs.software
      ? { fits: true, strong: true, why: "It needs code running — accounts, data or payments. Replit's builder can make that; you review the brief, then it opens there." }
      : needs.website
        ? { fits: true, strong: false, why: "For a custom-designed site. You review the brief, then Replit's visual builder opens with it." }
        : { fits: false, strong: false, why: "" },
  },
];

export function pathsFor(words: string, tools: Tool[] = TOOLS): Path[] {
  const needs = needsOf(words);
  const fitting = tools
    .map(tool => ({ tool, fit: tool.fits(needs) }))
    .filter(entry => entry.fit.fits && entry.tool.support !== "unavailable");
  // Strong fits first; among equals, what can be done right here (native, then connected) before a handoff.
  const rank: Record<Support, number> = { native: 0, connected: 1, handoff: 2, unavailable: 3 };
  fitting.sort((a, b) => Number(b.fit.strong) - Number(a.fit.strong) || rank[a.tool.support] - rank[b.tool.support]);
  return fitting.map((entry, index) => ({
    id: entry.tool.id, name: entry.tool.name, support: entry.tool.support, why: entry.fit.why,
    recommended: index === 0 && entry.fit.strong,
  }));
}

/** The first brief a person sees before anything leaves SOLVE: only the thing's own title and description. They edit it. */
export function briefFor(title: string, summary: string, needs: Needs): string {
  const lines = [title.trim()];
  if (summary.trim() && summary.trim() !== title.trim()) lines.push("", summary.trim());
  lines.push("", needs.software
    ? "Build this as a working web app. Keep it simple and clear, and explain anything I need to set up."
    : "Build this as a clean, fast website that works well on phones.");
  return lines.join("\n");
}

/**
 * Replit's documented "Open in Replit" link (docs.replit.com/references/integrations/open-in-replit):
 * `stack` is Build (Agent, full apps) or Design (Canvas, visual); `prompt` is LZ-string compressed
 * with compressToEncodedURIComponent; up to 50,000 characters before compression.
 */
export function replitLink(brief: string, needs: Needs): string {
  const prompt = brief.trim().slice(0, 50_000);
  if (!prompt) throw new Error("Empty brief");
  const stack = needs.software ? "Build" : "Design";
  return `https://replit.com/?stack=${stack}&prompt=${LZString.compressToEncodedURIComponent(prompt)}&referrer=SOLVE`;
}

/** A link a person brings back from a tool: https only, no credentials, sane length. */
export function cleanLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 2048) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}
