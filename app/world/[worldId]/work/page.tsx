import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { KernelError } from '@/lib/kernel/client';
import { loadCreativeWorld } from '@/lib/world/creative';
import { connectionStatus } from '@/lib/ai/provider';
import { stepFromArtifact } from '@/lib/world/progress';
import { looksLikeHtmlDocument } from '@/lib/product/website-draft';
import { RecoverableForm } from '@/app/product/recoverable-form';
import { WorldAccessPanel } from '../access-panel';
import { WorldLiveSync } from '../live-sync';
import { NextSteps } from '../next-steps/panel';
import { ProjectNav } from '../project-nav';
import { WorkEditor } from './editor';
import { saveWork, generateWork } from './actions';
import './workspace.css';
export const maxDuration=60;
export default async function WorkPage({params,searchParams}:PageProps<'/world/[worldId]/work'>) {
  const {worldId}=await params;
  const user=await getUser();if(!user)redirect(`/login?next=${encodeURIComponent(`/world/${worldId}/work`)}`);
  const kernel=await getKernel();
  let loaded;
  try {loaded=await loadCreativeWorld(kernel,worldId);}catch(error){if(error instanceof KernelError&&['forbidden','not_found','invalid'].includes(error.name))notFound();throw error;}
  const {world,artifacts}=loaded;
  const [actor,authority,status]=await Promise.all([kernel.whoami(),kernel.authorize({capability:'world.entity.write',scope:world.scope}),connectionStatus(kernel)]);
  const canWrite=authority.decision==='ALLOW'&&status.active;
  const docs=artifacts.filter(a=>!stepFromArtifact(a));
  const {document}=await searchParams;
  const selected=docs.find(a=>a.entityId===document)??docs.find(a=>looksLikeHtmlDocument(a.body))??docs.at(-1);
  const goal=artifacts.find(a=>a.title==='Goal')?.body||world.summary;
  return <main className="solve-page solve-workspace">
    <header className="solve-work-header"><div><Link href="/" className="solve-text-link">← Your projects</Link><h1>{world.title}</h1><p>{goal.startsWith('A private World.')?'A place for whatever you want to make happen.':goal}</p></div><a href="#workspace-people" className="solve-button solve-button-secondary">People &amp; invitations</a></header>
    <ProjectNav worldId={worldId}/><div className="solve-work-status"><WorldLiveSync worldId={worldId} authUserId={user.id}/><span>Saved changes keep their authorship and revisions.</span></div>
    {!status.active?<div className="solve-notice">Your saved work is available to read. <Link href="/connect" className="solve-text-link">Connect your AI to continue creating →</Link></div>:null}
    {user.is_anonymous?<div className="solve-notice">This is a browser-bound guest workspace. <Link href="/login?next=%2Fconnect" className="solve-text-link">Sign in for an account across devices →</Link></div>:null}
    <div className="solve-work-grid"><aside className="solve-work-library"><span className="solve-kicker">In this space</span><h2>Your work <small>{docs.length}</small></h2><nav aria-label="Saved documents">{docs.map(doc=><Link key={doc.entityId} href={`/world/${worldId}/work?document=${doc.entityId}`} aria-current={selected?.entityId===doc.entityId?'page':undefined}><strong>{doc.title}</strong><span>{looksLikeHtmlDocument(doc.body)?'Page':'Document'} · v{doc.version}</span></Link>)}</nav>
    {canWrite?<details className="solve-work-new" open={!docs.length}><summary>New document</summary><RecoverableForm action={saveWork.bind(null,worldId)} ownerActorId={actor.actor_id} className="solve-form" successMessage="Document saved."><input type="hidden" name="requestId" value={randomUUID()}/><input type="hidden" name="kind" value="text"/><label htmlFor="work-title">Title</label><input id="work-title" name="title" required maxLength={160} placeholder="An idea, note, or plan"/><label htmlFor="work-body">Text</label><textarea id="work-body" name="body" maxLength={7000} rows={6} placeholder="Write here, or paste something from your assistant…"/><button className="solve-button">Save document</button></RecoverableForm></details>:null}
    <Link href={`/world/${worldId}/room`} className="solve-text-link">Open shared conversation →</Link><a href={`/api/worlds/${worldId}/backup`} className="solve-text-link">Download project backup</a></aside>
    <div className="solve-work-main">{selected?<WorkEditor key={selected.entityId} worldId={worldId} actorId={actor.actor_id} artifact={selected} canWrite={canWrite} hasModel={Boolean(status.model)}/>:<section className="solve-work-empty"><span className="solve-kicker">A little room for possibility</span><h2>Make something yours.</h2><p>Keep an idea, work out a plan, or bring something from your assistant. Invite someone to shape it with you.</p></section>}
    {canWrite&&status.model&&!docs.some(a=>looksLikeHtmlDocument(a.body))?<details className="solve-panel mt-5"><summary>Create a visual page with your AI</summary><p className="solve-muted my-4">Turn an idea into a page you can preview and revise here. Pages are visual drafts; scripts, external resources and live app integrations do not run.</p><RecoverableForm action={generateWork.bind(null,worldId)} ownerActorId={actor.actor_id} className="solve-form"><label htmlFor="page-goal">Describe your page</label><textarea id="page-goal" name="goal" defaultValue={goal.startsWith('A private World.')?'':goal} required maxLength={7000} rows={4}/><button className="solve-button">Create page with my AI</button></RecoverableForm></details>:null}
    <div className="mt-6"><NextSteps worldId={worldId} actorId={actor.actor_id} artifacts={artifacts} canWrite={canWrite}/></div></div></div>
    <section id="workspace-people" className="solve-work-people"><WorldAccessPanel worldId={worldId} scope={world.scope} saved={false}/></section>
  </main>;
}
