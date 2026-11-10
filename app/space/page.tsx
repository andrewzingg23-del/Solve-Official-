import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { myThings } from "@/lib/product/my-things";
import { readSpaceShared } from "@/lib/product/page";
import { PageHead } from "@/app/ui/page-head";
import { SpaceShare } from "./space-share";

export const metadata: Metadata = { title: "Share & publish · Solve" };

// Space: your MySpace — the public page that is you, and what you've chosen to show on it. What you
// make lives on Bench; this is what the world sees of it, and only what you choose.
export default async function SpacePage() {
  const user = await getUser();
  if (!user) return <Header />;
  const data = await load().catch(() => null);
  if (!data) return <div className="s-stack"><Header /><p role="status" className="s-muted">Your Space couldn&apos;t be loaded right now. Nothing has changed.</p></div>;
  return <div className="s-stack" style={{ "--gap": "32px" } as React.CSSProperties}>
    <Header />
    <SpaceShare name={data.name} shared={data.shared} path={data.path} pages={data.pages} />
  </div>;
}

async function load() {
  const kernel = await getKernel();
  const me = await kernel.whoami();
  const [[profile], mine, things, shared] = await Promise.all([
    kernel.readActors([me.actor_id]).catch(() => []),
    kernel.readWorld(`actor:${me.actor_id}`).catch(() => []),
    myThings(kernel).catch(() => null),
    readSpaceShared(kernel, me.actor_id).catch(() => ({ entityId: null, shared: false })),
  ]);
  // What a visitor would see: the things this person has shared as pages.
  const titles = new Map((things ?? []).map(t => [t.id.toLowerCase(), t.title]));
  const pages = mine
    .filter(e => e.attributes?.sov === "solve.page" && e.attributes?.published === true && typeof e.attributes?.worldId === "string")
    .map(e => String(e.attributes.worldId).toLowerCase())
    .filter(id => titles.has(id))
    .map(id => ({ id, title: titles.get(id)! }));
  return { name: profile?.label?.trim() ?? "", shared: shared.shared, path: shared.shared ? `/s/${me.actor_id}` : null, pages };
}

function Header() {
  return <PageHead label="Control" title="Share & publish">
    Your Space is private by default. Share your name and the pages you choose at one link anyone can open — only what you share is ever shown.
  </PageHead>;
}
