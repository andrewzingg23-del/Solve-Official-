import { connectionStatus } from "@/lib/ai/provider";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { projectProgress } from "@/lib/world/progress";
import { loadCreativeWorld, listCreativeWorlds } from "@/lib/world/creative";
import { ProjectComposer } from "./product/project-composer";
import { Projects, type ProjectCard } from "./product/projects";
import { Icon } from "./product/icons";

export default async function Home() {
  const user = await getUser();
  let projects: ProjectCard[] | null = null;
  let connected = false;
  if (user) {
    const kernel = await getKernel();
    connected = await connectionStatus(kernel).then(s=>s.active).catch(()=>false);
    projects = await listCreativeWorlds(kernel).then(worlds => Promise.all(worlds.map(async world => {
      const loaded = await loadCreativeWorld(kernel, world.worldId);
      const progress = projectProgress(loaded.artifacts);
      return {...world, status: progress.status, nextStep: progress.nextStep, updatedAt: progress.updatedAt ?? world.updatedAt};
    }))).then(rows => rows.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))).catch(() => null);
  }
  return <main className="solve-page solve-home">
    {user && projects ? <Projects projects={projects} /> : null}
    <section className={`solve-home-intro ${user ? "solve-home-member" : ""}`}>
      <div className="solve-home-copy"><span className="solve-kicker">Your ideas. Your intelligence.</span><h1>{user ? "What’s next?" : <>Your ideas deserve<br />a place to <span>grow.</span></>}</h1><p>{user ? "Pick up where you left off, or make room for something new." : "Bring your people and your AIs into one shared place. Think it through, make a plan, and build something together."}</p>{!user ? <div className="solve-home-benefits"><span><Icon name="chat" width={16} />Think together</span><span><Icon name="document" width={16} />Keep the context</span><span><Icon name="ai" width={16} />Bring your own AI</span></div> : null}</div>
      {connected ? <ProjectComposer owner={user?.id ?? null} worldId={randomUUID()} /> : <section className="solve-composer"><span className="solve-kicker">Start here</span><h2>Bring your AI. Make this yours.</h2><p className="solve-muted">Connect an assistant or your own model key, then create a space for anything you want to work on. Invite someone when you’re ready.</p><Link href="/connect" className="solve-button">Connect your AI</Link>{!user || user.is_anonymous ? <Link href="/login?next=%2Fconnect" className="solve-text-link">Sign in or create an account →</Link> : null}</section>}
    </section>
    {user ? projects ? null : <section className="solve-empty" role="status"><h2>Your projects couldn’t be loaded.</h2><p>Your work is still saved. Try again, or check your profile to finish account setup.</p><Link href="/account" className="solve-text-link">Open profile <Icon name="arrow" width={15} /></Link></section> : <section className="solve-how" aria-labelledby="how-heading"><div className="solve-section-heading"><h2 id="how-heading">From “what if” to working on it.</h2><span>A shared place for any kind of idea</span></div><div className="solve-how-grid">{[{ icon: "projects" as const, title: "Make a space for it", text: "Start with the thing you want to do. Your project keeps the conversation, documents and decisions together." }, { icon: "community" as const, title: "Bring your people", text: "Invite a friend, your team or your community. Choose who can view and who can contribute." }, { icon: "ai" as const, title: "Put your AIs to work", text: "Ask about the shared work. Bring selected knowledge or connect an assistant you already use." }].map((step, index) => <article key={step.title}><div><Icon name={step.icon} /><span>0{index + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div></section>}
    <footer className="solve-page-footer"><span>Ideas become shared work.</span><Link href="/bot">Make your AI yours <Icon name="arrow" width={14} /></Link></footer>
  </main>;
}
