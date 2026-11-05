import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { loadCreativeWorld } from '@/lib/world/creative';
import { KernelError } from '@/lib/kernel/client';
import { ProjectEditor } from './project-editor';
export default async function ProjectPage({params}:PageProps<'/projects/[worldId]'>){
 const {worldId}=await params;const user=await getUser();
 if(!user)return <main className="solve-page"><div className="solve-empty"><h1>Sign in to open this Project.</h1><p>Private work is available only to authorized accounts.</p><Link className="solve-button" href={`/login?next=${encodeURIComponent('/projects/'+worldId)}`}>Sign in</Link></div></main>;
 const loaded=await (async()=>{
  try{
   const kernel=await getKernel();const {world,artifacts}=await loadCreativeWorld(kernel,worldId);const {actor_id}=await kernel.whoami();
   const decision=await kernel.authorize({capability:'world.entity.write',scope:world.scope});
   return {kind:'ready' as const,world,artifacts,actor_id,decision};
  }catch(error){return {kind:'failed' as const,denied:error instanceof KernelError&&['forbidden','not_found','invalid'].includes(error.name)};}
 })();
 if(loaded.kind==='failed')return <main className="solve-page"><div className="solve-empty"><h1>{loaded.denied?'Project unavailable':'Your workspace could not connect.'}</h1><p>{loaded.denied?'This Project is unavailable to your current identity. Private content has not been loaded.':'Your work has not changed. Please retry shortly.'}</p><Link href="/projects" className="solve-text-link">Back to Projects →</Link></div></main>;
 const {world,artifacts,actor_id,decision}=loaded;
  return <main className="solve-page sov-project-page"><Link href="/projects" className="solve-text-link">← Projects</Link><header className="solve-page-heading"><span className="sov-eyebrow">PRIVATE PROJECT</span><h1>{world.title}</h1><p>{world.summary==='A private World. Start with a blank canvas and shape it as you go.'?'A place to begin. Your work stays connected to this Project.':world.summary}</p></header><ProjectEditor key={worldId+user.id} worldId={worldId} userId={user.id} actorId={actor_id} artifacts={artifacts} canEdit={decision.decision==='ALLOW'}/><footer className="sov-project-footer"><span>Saved in SOV’s versioned record · {user.is_anonymous?'Guest session: claim your identity for recovery.':'Owned by your signed-in account.'}</span><Link href={`/world/${worldId}/room`}>Open existing Room →</Link></footer></main>;
}
