import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { myThings } from "@/lib/product/my-things";
import { PageHead } from "@/app/ui/page-head";
import { Things } from "@/app/ui/things";

export const metadata: Metadata = { title: "Space · SOLVE" };

// Space: where a person's things live. Rebuilt from zero (2026-11-10).
export default async function SpacePage() {
  const user = await getUser();
  const things = user ? await myThings(await getKernel()) : [];
  return <div>
    <PageHead label="Space" title="Everything that's yours.">
      Each thing keeps its whole history — who did what, what proves it, and who else can reach it.
    </PageHead>
    <Things things={things} empty="Nothing here yet. What you write down on Home lives here." />
    {things && things.length === 0 ? <p style={{ marginTop: 24 }}><Link href="/" className="s-button">Write something down</Link></p> : null}
  </div>;
}
