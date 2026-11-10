import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { myThings } from "@/lib/product/my-things";
import { readWorldMembers } from "@/lib/world/collaboration";
import { PageHead } from "@/app/ui/page-head";
import { Empty, Row, listStyles } from "@/app/ui/list";

export const metadata: Metadata = { title: "People · Solve" };

type Person = { id: string; name: string; spaces: string[] };

// People: everyone you share a Space with, read from the kernel's own membership records — never
// from contacts, and never anyone you haven't built with. Inviting happens inside a Space, because
// an invitation is always to something specific.
export default async function PeoplePage() {
  const user = await getUser();
  const people = user ? await load().catch(() => null) : [];
  return <div>
    <PageHead label="People" title="People">The people you share Spaces with.</PageHead>
    <div className={listStyles.panel}>
      {people === null
        ? <p role="status" className="s-muted" style={{ padding: 16 }}>Your people couldn&apos;t be loaded right now. Nothing has changed.</p>
        : people.length === 0
          ? <Empty icon="people" title="No people yet">
              <span className="s-muted s-small">Open one of your Spaces and invite someone. Anyone you share a Space with appears here.</span>
            </Empty>
          : people.map(p => <Row key={p.id} icon="account" title={p.name} note={`In ${p.spaces.join(", ")}`} />)}
    </div>
  </div>;
}

async function load(): Promise<Person[]> {
  const kernel = await getKernel();
  const me = await kernel.whoami();
  const spaces = (await myThings(kernel)) ?? [];
  const byId = new Map<string, string[]>();
  // One read per Space; a person with very many Spaces sees the people from their 40 most recent.
  await Promise.all(spaces.slice(0, 40).map(async space => {
    const members = await readWorldMembers(kernel, `world:${space.id}`).catch(() => null);
    if (!members) return;
    for (const id of [members.ownerActorId, ...members.members.map(m => m.actorId)]) {
      if (!id || id === me.actor_id) continue;
      byId.set(id, [...(byId.get(id) ?? []), space.title]);
    }
  }));
  if (byId.size === 0) return [];
  const actors = await kernel.readActors([...byId.keys()]).catch(() => []);
  const label = new Map(actors.map(a => [a.actor_id, a.label?.trim() || "Someone"]));
  return [...byId.entries()]
    .map(([id, titles]) => ({ id, name: label.get(id) ?? "Someone", spaces: [...new Set(titles)] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
