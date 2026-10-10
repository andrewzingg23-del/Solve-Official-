import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { ProjectComposer } from "@/app/product/project-composer";
export default async function NewProjectPage() {
  const user = await getUser();
  return <main className="solve-page solve-new-page"><Link href="/" className="solve-text-link">← Projects</Link><div className="solve-page-heading"><span className="solve-kicker">A new beginning</span><h1>Make room for your idea.</h1><p>Start small. Bring someone in. Figure out the next step together.</p></div><ProjectComposer owner={user?.id ?? null} worldId={randomUUID()} /></main>;
}
