import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { ProjectComposer } from "./product/project-composer";
import { Projects, type ProjectCard } from "./product/projects";
import { Icon } from "./product/icons";

export default async function Home() {
  const user = await getUser();
  let projects: ProjectCard[] | null = null;
  if (user) projects = await listCreativeWorlds(await getKernel()).catch(() => null);
  return <main className="solve-page solve-home">
    <section className={`solve-home-intro ${user ? "solve-home-member" : ""}`}>
      <div className="solve-home-copy"><span className="solve-kicker">People. Ideas. Your AIs.</span><h1>{user ? "What’s next?" : <>Good ideas deserve<br />a place to <span>grow.</span></>}</h1><p>{user ? "Pick up where you left off, or make room for something new." : "Bring your people and your AIs into one shared place. Think it through, make a plan, and build something together."}</p>{!user ? <div className="solve-home-benefits"><span><Icon name="chat" width={16} />Think together</span><span><Icon name="document" width={16} />Keep the context</span><span><Icon name="ai" width={16} />Bring your own AI</span></div> : null}</div>
      <ProjectComposer owner={user?.id ?? null} worldId={randomUUID()} />
    </section>
    {user ? projects ? <Projects projects={projects} /> : <section className="solve-empty" role="status"><h2>Your projects couldn’t be loaded.</h2><p>Your work is still saved. Try again, or check your profile to finish account setup.</p><Link href="/account" className="solve-text-link">Open profile <Icon name="arrow" width={15} /></Link></section> : <section className="solve-how" aria-labelledby="how-heading"><div className="solve-section-heading"><h2 id="how-heading">From “what if” to working on it.</h2><span>A shared place for any kind of idea</span></div><div className="solve-how-grid">{[{ icon: "projects" as const, title: "Make a space for it", text: "Start with the thing you want to do. Your project keeps the conversation, documents and decisions together." }, { icon: "community" as const, title: "Bring your people", text: "Invite a friend, your team or your community. Choose who can view and who can contribute." }, { icon: "ai" as const, title: "Put your AIs to work", text: "Ask about the shared work. Bring selected knowledge or connect an assistant you already use." }].map((step, index) => <article key={step.title}><div><Icon name={step.icon} /><span>0{index + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>}
    <footer className="solve-page-footer"><span>Ideas become shared work.</span><Link href="/onboarding">Make your Space yours · optional apps <Icon name="arrow" width={14} /></Link><Link href="/bot">My Agent <Icon name="arrow" width={14} /></Link></footer>
  </main>;
}
