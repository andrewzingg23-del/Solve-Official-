'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CreativeArtifact } from '@/lib/world/creative';
import { looksLikeHtmlDocument } from '@/lib/product/website-draft';
import { RecoverableForm } from '@/app/product/recoverable-form';
import { DraftPreview } from '../draft-preview';
import { saveWork, reviseWork } from './actions';

export function WorkEditor({worldId,actorId,artifact,canWrite,hasModel}:{worldId:string;actorId:string;artifact:CreativeArtifact;canWrite:boolean;hasModel:boolean}) {
  const [draft,setDraft]=useState<{title:string;body:string;version:number}|null>(null);
  const [notice,setNotice]=useState('');
  const [busy,startTransition]=useTransition();
  const request=useRef<{signature:string;id:string}|null>(null);
  const router=useRouter();
  const current=draft??artifact, stale=Boolean(draft&&draft.version!==artifact.version), website=looksLikeHtmlDocument(artifact.body);
  const update=(field:'title'|'body',value:string)=>{setDraft({...current,[field]:value});setNotice('');};
  return <article className="solve-work-editor">
    <header className="solve-work-document-heading"><div><span className="solve-kicker">{website?'Page draft':'Document'} · saved v{artifact.version}</span><h2>{artifact.title}</h2></div><span className="solve-muted">{draft?'Unsaved changes':'Saved to this project'}</span></header>
    {website ? <DraftPreview html={artifact.body} title={artifact.title}/> : <div className="solve-work-reading">{artifact.body||'This document is empty.'}</div>}
    {canWrite ? <><details className="solve-work-edit" open={!artifact.body}><summary>{website?'Edit page source':'Edit document'}</summary><form className="solve-form" onSubmit={event=>{
      event.preventDefault();if(busy||stale)return;
      const form=new FormData();form.set('expectedActorId',actorId);form.set('entityId',artifact.entityId);form.set('version',String(current.version));form.set('title',current.title);form.set('body',current.body);
      const signature=JSON.stringify([...form]);if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};form.set('requestId',request.current.id);
      startTransition(async()=>{try{const result=await saveWork(worldId,form);if(!result.ok){setNotice(result.error);router.refresh();return;}setDraft(null);request.current=null;setNotice('Revision saved.');router.refresh();}catch{setNotice('The connection was interrupted. Your edits are still here.');}});
    }}><label>Document title<input value={current.title} onChange={e=>update('title',e.target.value)} required maxLength={160} disabled={busy}/></label><label>{website?'HTML source':'Document text'}<textarea value={current.body} onChange={e=>update('body',e.target.value)} rows={12} maxLength={website?12000:7000} disabled={busy}/></label>
    {stale ? <div role="alert" className="solve-notice"><p>A collaborator saved v{artifact.version}. Copy any edits you want to keep, then load the saved version before revising it.</p><button type="button" className="solve-text-link" onClick={()=>setDraft(null)}>Load saved version</button></div> : null}
    {notice?<p role="status">{notice}</p>:null}<button className="solve-button" disabled={busy||stale||!draft}>{busy?'Saving…':'Save revision'}</button></form></details>
    {hasModel ? <section className="solve-work-refine"><h3>What would you like to change?</h3><p className="solve-muted">Your model revises the saved version. Successful changes are saved as a new revision.</p>{draft?<p className="solve-notice">Save or discard your edits before asking AI to revise.</p>:<RecoverableForm action={reviseWork.bind(null,worldId)} ownerActorId={actorId} className="solve-form" successMessage="AI revision saved."><input type="hidden" name="entityId" value={artifact.entityId}/><input type="hidden" name="version" value={artifact.version}/><input type="hidden" name="requestId" value="revision"/><label htmlFor="revision-request">Requested change</label><textarea id="revision-request" name="instruction" placeholder="Make this clearer, explore another approach, or change the layout…" required maxLength={2000} rows={3}/><button className="solve-button">Revise with my AI</button></RecoverableForm>}</section>:<p className="solve-muted mt-4">Ask your connected assistant to revise this document, or connect a model key to ask from here.</p>}</>:null}
  </article>;
}
