// What a person can reach, said in words they have.
//
// A grant is a capability over a scope. Neither is a word a person uses: "world.entity.write on
// world:5f2…" means "you can change Fence repair". This turns the kernel's grants into that.

const CAPABILITY: Record<string, string> = {
  "*": "Everything",
  "kernel.read": "See it",
  "world.entity.read": "See it",
  "world.entity.write": "Change it",
  "kernel.evidence.attach": "Add proof",
  "kernel.grant.issue": "Share it",
};

export function capabilityWords(capability: string): string {
  if (CAPABILITY[capability]) return CAPABILITY[capability];
  const last = capability.split(".").pop() ?? capability;
  const spaced = last.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Something";
}

export type Reach = { what: string; can: string[] };

/**
 * Group grants by what they cover. Scopes the person owns read as their own things; their own
 * actor scope reads as their SOV ID; anything unrecognised is said plainly rather than shown raw.
 */
export function reachFrom(
  grants: Array<{ capability: string; scope: string }>,
  names: { actorId: string | null; things: Record<string, string> },
): Reach[] {
  const byWhat = new Map<string, Set<string>>();
  for (const g of grants) {
    const world = /^world:([0-9a-f-]{36})$/i.exec(g.scope)?.[1];
    const what = g.scope === `actor:${names.actorId}` ? "Your SOV ID"
      : world ? (names.things[world.toLowerCase()] ?? "Something shared with you")
        : g.scope === "*" ? "Everything"
          : "Something else";
    const set = byWhat.get(what) ?? new Set<string>();
    set.add(capabilityWords(g.capability));
    byWhat.set(what, set);
  }
  return [...byWhat.entries()].map(([what, can]) => ({ what, can: [...can].sort() }));
}
