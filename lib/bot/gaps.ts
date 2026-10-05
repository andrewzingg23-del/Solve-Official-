// What solve can't do yet: the capability proposals assistants record (propose_capability) when a
// person asks for something no tool can do. This is the Forge's seed (VISION-CANON: "when players
// repeatedly need something Sovereign cannot express yet, Forge can identify that gap"), shown to
// the person so repeated real needs pick what gets built next. The drafts are data written by
// assistants: shown, never run.
const STATUS = "STATUS: Draft proposal — not executable";
const SECTIONS = ["GOAL", "DESIRED RESULT", "CURRENT TOOLS CONSIDERED", "DATA OR ACCESS NEEDED", "ACCEPTANCE CHECK", "NEXT STEP", "SAFETY"] as const;

export type CapabilityProposal = { goal: string; result: string; check: string };
export type Gap = CapabilityProposal & { worldId: string; worldTitle: string; pieceId: string; at: string };
export type GapGroup = { goal: string; result: string; check: string; times: number; worlds: string[]; latest: Gap };

export function parseCapabilityProposal(body: string): CapabilityProposal | null {
  if (!body.startsWith(STATUS)) return null;
  const lines = body.split("\n");
  const section = (name: (typeof SECTIONS)[number]) => {
    const at = lines.indexOf(name);
    if (at < 0) return "";
    const out: string[] = [];
    for (const line of lines.slice(at + 1)) {
      if ((SECTIONS as readonly string[]).includes(line)) break;
      out.push(line);
    }
    return out.join("\n").trim();
  };
  const goal = section("GOAL");
  const result = section("DESIRED RESULT");
  const check = section("ACCEPTANCE CHECK");
  return goal && result ? { goal, result, check } : null;
}

const key = (goal: string) => goal.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The same need asked more than once counts once, with how many times and where. Most asked first.
export function groupGaps(gaps: Gap[]): GapGroup[] {
  const groups = new Map<string, GapGroup>();
  for (const g of [...gaps].sort((a, b) => b.at.localeCompare(a.at))) {
    const k = key(g.goal);
    const found = groups.get(k);
    if (found) {
      found.times += 1;
      if (!found.worlds.includes(g.worldTitle)) found.worlds.push(g.worldTitle);
    } else {
      groups.set(k, { goal: g.goal, result: g.result, check: g.check, times: 1, worlds: [g.worldTitle], latest: g });
    }
  }
  return [...groups.values()].sort((a, b) => b.times - a.times || b.latest.at.localeCompare(a.latest.at));
}
