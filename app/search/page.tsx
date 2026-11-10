import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { myThings } from "@/lib/product/my-things";
import { PageHead } from "@/app/ui/page-head";
import { Empty, Row, listStyles } from "@/app/ui/list";

export const metadata: Metadata = { title: "Search · Solve" };

// Search: your Spaces, by their names and descriptions — only what you can already open. Searching
// inside everything you've added, people and apps comes later; this says what it searched.
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, 200);
  const user = await getUser();
  const spaces = user ? await myThings(await getKernel()) : [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = (spaces ?? []).filter(s => words.length > 0 && words.every(w => `${s.title} ${s.summary}`.toLowerCase().includes(w)));

  return <div>
    <PageHead label="Search" title={q ? `“${q}”` : "Search"}>Searching the names and descriptions of your Spaces.</PageHead>
    <div className={listStyles.panel}>
      {spaces === null
        ? <p role="status" className="s-muted" style={{ padding: 16 }}>Your Spaces couldn&apos;t be searched right now. Nothing has changed.</p>
        : !q
          ? <Empty icon="search" title="Type above to search your Spaces" />
          : hits.length === 0
            ? <Empty icon="search" title="Nothing found"><span className="s-muted s-small">No Space of yours has those words in its name or description.</span></Empty>
            : hits.map(s => <Row key={s.id} icon="space" title={s.title}
                note={s.summary && s.summary !== s.title ? s.summary : undefined} href={`/world/${encodeURIComponent(s.id)}`} />)}
    </div>
  </div>;
}
