import Image from "next/image";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { Icon } from "./product/icons";

export default async function Space() {
  const user=await getUser();
  const projects=user?await listCreativeWorlds(await getKernel()).catch(()=>null):[];
  const name=typeof user?.user_metadata?.display_name==='string'?user.user_metadata.display_name:'';
  return <main className="solve-page sov-space">
    <section className="sov-space-hero">
      <div className="sov-hero-copy"><span className="sov-eyebrow">YOUR SPACE. YOUR POSSIBILITIES.</span><h1>{name?`Welcome home, ${name}.`:'A little space.\nA world of possibility.'}</h1><p>A private place for your ideas, your work,<br/>and whatever comes next.</p><Link className="solve-button" href="/projects/new">Create a Project <Icon name="arrow" width={18}/></Link><span className="sov-hero-footnote">Start with an intention. Make it yours.</span></div>
      <span className="sov-scene-caption">An environment for what matters to you</span>
    </section>
    <div className="sov-space-grid"><section className="sov-panel sov-continue-panel"><header><div><span className="sov-eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Continue</h2></div><Link href="/projects">All Projects <Icon name="arrow" width={16}/></Link></header>
      {projects===null?<div className="sov-space-empty"><Icon name="lock" width={26}/><h3>Your Projects are temporarily unavailable.</h3><p>Your saved work has not changed. Refresh to reconnect.</p><Link href="/">Try again →</Link></div>:projects.length===0?<div className="sov-space-empty"><Icon name="projects" width={28}/><h3>Something worth beginning.</h3><p>Your first Project starts with an idea.<br/>Nothing is created until you choose.</p><Link href="/projects/new">Start your first Project <Icon name="arrow" width={16}/></Link></div>:<div className="sov-continuity-list">{projects.slice(0,4).map(project=><Link key={project.worldId} href={`/projects/${project.worldId}`}><span className="sov-document-icon"><Icon name="document" width={22}/></span><div><strong>{project.title}</strong><small>Project · Saved to your workspace</small></div><Icon name="arrow" width={18}/></Link>)}</div>}
    </section><aside className="sov-panel sov-agent-card"><Image src="/sov/companion-orb.png" width={70} height={70} alt=""/><span className="sov-eyebrow">WITH YOU, ACROSS SOV</span><h2>My Agent</h2><p>Your personal companion.<br/>Your context. Your terms.</p><Link href="/bot">Shape your Agent <Icon name="arrow" width={16}/></Link><small>Configure identity and access. Live execution comes later.</small></aside></div>
    <footer className="sov-space-footer"><span><Icon name="lock" width={13}/>{user?.is_anonymous?'Guest workspace · Claim your SOV ID to make it recoverable.':user?'Your private workspace. You choose what to share.':'Explore freely. Sign in when you are ready to keep your work.'}</span><Link href={user?.is_anonymous?'/login?mode=claim':'/control'}>{user?.is_anonymous?'Keep your Space':'Privacy & control'} →</Link></footer>
  </main>;
}
