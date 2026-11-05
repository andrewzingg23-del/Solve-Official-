import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { Projects, type ProjectCard } from "@/app/product/projects";

export const metadata = { title: "Projects — SOV" };

export default async function ProjectsPage() {
  const user = await getUser();
  let projects: ProjectCard[] | null = null;
  if (user) { try { projects = await listCreativeWorlds(await getKernel()); } catch { projects = null; } }
  return <main className="solve-page">
    <header className="solve-page-heading">
      <span className="solve-kicker">Projects</span><h1>What you're building.</h1>
      <p>Your work and its history stay in the Project. Connections and Agent permissions are separate.</p>
    </header>
    {user ? projects ? <Projects projects={projects} /> : <section className="solve-empty"><h2>Projects are temporarily unavailable.</h2><p>Your work has not been deleted. Try again when the connection returns.</p></section> :
      <section className="solve-panel"><h2>Make something real.</h2><p>Explore SOV, then sign in to create and preserve your own Projects.</p><div className="solve-profile-save"><Link className="solve-button" href="/login?next=%2Fprojects">Sign in</Link><Link className="solve-text-link" href="/onboarding">Explore setup →</Link></div></section>}
    <div className="solve-page-footer"><Link href="/worlds/new" className="solve-text-link">Start a Project →</Link><Link href="/onboarding#apps" className="solve-text-link">Choose optional apps →</Link></div>
  </main>;
}
