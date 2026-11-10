import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { myThings } from "@/lib/product/my-things";
import { PageHead } from "@/app/ui/page-head";
import { Things } from "@/app/ui/things";

export const metadata: Metadata = { title: "Bench · SOLVE" };

// Bench: everything a person has made or joined, in one place — the only list of their things.
// Starting something happens anywhere; each thing opens with everything about it.
export default async function BenchPage() {
  const user = await getUser();
  const things = user ? await myThings(await getKernel()) : [];
  return <div>
    <PageHead label="Bench" title="Your things.">
      Everything you&apos;ve made or joined. Every change is kept, so nothing is ever lost.
    </PageHead>
    <p style={{ marginBottom: 40 }}><Link href="/" className="s-button">Start something</Link></p>
    <Things things={things} empty="Nothing yet. What you start will be here." action="Open it" />
  </div>;
}
