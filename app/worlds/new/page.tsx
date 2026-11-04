import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { ProjectComposer } from "@/app/product/project-composer";
export default async function NewProjectPage() {
  const user = await getUser();
  return <main className="solve-page solve-new-page"><Link href="/" className="solve-text-link">← Projects</Link><div className="solve-page-heading"><span className="solve-kicker">Start simply</span><h1>Start a World.</h1><p>Describe what you're working on. Add people, context and AI as you go.</p></div><ProjectComposer owner={user?.id ?? null} worldId={randomUUID()} /></main>;
}
