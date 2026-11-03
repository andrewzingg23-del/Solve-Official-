import { createHash } from 'node:crypto';
import { KernelError, type Kernel, type KernelEvent } from '../kernel/client';
import { loadCreativeWorld, type CreativeWorld } from './creative';
import { parseRepoUrl, repoUrl, type RepoRef } from '../github/repo';

export type DevelopmentChange = {
 id:string; title:string; problem:string; expected:string; checks:string; boundaries:string; fingerprint:string;
 createdAt:string; proposedBy:string; reviewId:string|null; reviewNotes:string; approvedAt:string|null;
 stage:'proposed'|'reviewed'|'approved'; pullNumber:number|null;
 repository:RepoRef|null;
};
type ChangeInput={requestId:string;title:string;problem:string;expected:string;checks:string;boundaries:string};
const invalid=(message:string)=>new KernelError('invalid',message,'');
const key=(id:string)=>{if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw invalid('Refresh this form and retry.');return id;};
const text=(value:string,max:number,required=true)=>{if(typeof value!=='string'||value.trim().length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)||required&&!value.trim())throw invalid('Complete the change, expected result and checks within the displayed limits.');return value.trim();};

async function context(kernel:Kernel,worldId:string,ownerOnly=false){
 const {world}=await loadCreativeWorld(kernel,worldId);
 const [actor,first,grants]=await Promise.all([kernel.whoami(),kernel.readEvents(world.scope,{limit:1}),kernel.myGrants()]);
 const owner=first.find(e=>e.type==='kernel.scope.claimed')?.actor_id;
 if(ownerOnly&&(actor.kind!=='human'||actor.actor_id!==owner||!grants.some(g=>g.scope===world.scope&&g.capability==='*')))throw new KernelError('forbidden','Only the project owner can review and approve development work.','');
 return {world,actor,owner};
}
async function events(kernel:Kernel,scope:string){
 const endSeq=(await kernel.readEvents(scope,{newestFirst:true,limit:1}))[0]?.seq??0;
 const result:KernelEvent[]=[];let afterSeq=0;
 for(;;){const page=await kernel.readEvents(scope,{afterSeq,limit:500});if(!page.length)break;result.push(...page.filter(e=>e.seq<=endSeq));const next=page.at(-1)!.seq;if(next<=afterSeq)throw new Error('Project history is out of order.');afterSeq=next;if(page.length<500||next>=endSeq)break;}
 return result;
}
function changesFrom(history:KernelEvent[],owner:string|undefined):DevelopmentChange[]{
 const changes=new Map<string,DevelopmentChange>();
 for(const e of history){
  if(e.actor_id!==owner)continue;
  const p=e.payload;
  if(e.type==='development.change.proposed'&&typeof p.fingerprint==='string'&&typeof p.title==='string'&&typeof p.problem==='string'&&typeof p.expected==='string'&&typeof p.checks==='string'&&typeof p.boundaries==='string'){
   const repository=typeof p.repository==='string'?parseRepoUrl(p.repository):null;
   changes.set(e.id,{id:e.id,title:p.title,problem:p.problem,expected:p.expected,checks:p.checks,boundaries:p.boundaries,fingerprint:p.fingerprint,createdAt:e.occurred_at,proposedBy:'Project owner',reviewId:null,reviewNotes:'',approvedAt:null,stage:'proposed',pullNumber:null,repository});
  }else if(typeof p.proposalId==='string'){
   const row=changes.get(p.proposalId);if(!row||p.fingerprint!==row.fingerprint)continue;
   if(e.type==='development.change.reviewed'&&row.stage!=='approved'){row.reviewId=e.id;row.reviewNotes=typeof p.notes==='string'?p.notes:'';row.stage='reviewed';}
   if(e.type==='development.change.approved'&&row.reviewId===p.reviewId){row.approvedAt=e.occurred_at;row.stage='approved';}
   if(e.type==='development.change.implementation_linked'&&row.stage==='approved'&&Number.isSafeInteger(p.pullNumber)&&Number(p.pullNumber)>0)row.pullNumber=Number(p.pullNumber);
  }
 }
 return [...changes.values()].reverse();
}
export async function listDevelopmentChanges(kernel:Kernel,worldId:string){const {world,owner}=await context(kernel,worldId);return changesFrom(await events(kernel,world.scope),owner);}
export async function developmentOwner(kernel:Kernel,worldId:string){const {actor,owner}=await context(kernel,worldId);return actor.kind==='human'&&actor.actor_id===owner;}
export async function proposeDevelopmentChange(kernel:Kernel,worldId:string,input:ChangeInput,repository:RepoRef|null=null){
 const {world,actor}=await context(kernel,worldId,true);
 const repositoryUrl=repository?`${repoUrl(repository)}${repository.trunk?`/tree/${repository.trunk}`:''}`:null;
 if(repositoryUrl&&!parseRepoUrl(repositoryUrl))throw invalid('Choose a valid repository before proposing development work.');
 const payload={requestId:key(input.requestId),title:text(input.title,160),problem:text(input.problem,2000),expected:text(input.expected,2000),checks:text(input.checks,2000),boundaries:text(input.boundaries,1000,false),repository:repositoryUrl};
 const fingerprint=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 const history=await events(kernel,world.scope);
 const existing=history.find(e=>e.type==='development.change.proposed'&&e.actor_id===actor.actor_id&&e.payload.requestId===payload.requestId);
 if(existing){if(existing.payload.fingerprint!==fingerprint)throw invalid('This request was already saved with different content. Refresh before making a new proposal.');return existing.id;}
 return kernel.recordEvent({scope:world.scope,type:'development.change.proposed',payload:{...payload,fingerprint},idempotencyKey:`development:proposal:${payload.requestId}`});
}
async function ownedChange(kernel:Kernel,worldId:string,proposalId:string){const c=await context(kernel,worldId,true);const rows=changesFrom(await events(kernel,c.world.scope),c.owner);const change=rows.find(r=>r.id===proposalId);if(!change)throw invalid('This change is not in this project.');return {...c,change};}
export async function reviewDevelopmentChange(kernel:Kernel,worldId:string,proposalId:string,requestId:string,notes:string){
 const {world,change}=await ownedChange(kernel,worldId,proposalId);
 if(change.stage==='approved')throw invalid('This approved scope is fixed. Propose another change to revise it.');
 const payload={proposalId,fingerprint:change.fingerprint,notes:text(notes,2000,false),requestId:key(requestId)};
 const existing=(await events(kernel,world.scope)).find(e=>e.type==='development.change.reviewed'&&e.payload.requestId===payload.requestId);
 if(existing){if(Object.entries(payload).some(([name,value])=>existing.payload[name]!==value))throw invalid('This review request already contains different content. Refresh before reviewing again.');return existing.id;}
 return kernel.recordEvent({scope:world.scope,type:'development.change.reviewed',payload,idempotencyKey:`development:review:${payload.requestId}`});
}
export async function approveDevelopmentChange(kernel:Kernel,worldId:string,proposalId:string,reviewId:string){
 const {world,change}=await ownedChange(kernel,worldId,proposalId);
 if(!change.reviewId||change.reviewId!==reviewId)throw invalid('Review the saved scope and checks before approving this handoff.');
 return kernel.recordEvent({scope:world.scope,type:'development.change.approved',payload:{proposalId,fingerprint:change.fingerprint,reviewId},idempotencyKey:`development:approve:${proposalId}`});
}
export async function linkDevelopmentPull(kernel:Kernel,worldId:string,proposalId:string,pullNumber:number){
 const {world,change}=await ownedChange(kernel,worldId,proposalId);
 if(change.stage!=='approved'||!Number.isSafeInteger(pullNumber)||pullNumber<=0)throw invalid('Approve the handoff and choose a valid implementation pull request.');
 return kernel.recordEvent({scope:world.scope,type:'development.change.implementation_linked',payload:{proposalId,fingerprint:change.fingerprint,pullNumber},idempotencyKey:`development:pull:${proposalId}:${pullNumber}`});
}
export function developmentHandoff(change:DevelopmentChange,world:Pick<CreativeWorld,'worldId'|'title'>){
 if(change.stage!=='approved')throw invalid('Approve this reviewed change before handing it to a builder.');
 const repo=change.repository;
 return `Implement this owner-approved SOLVE development request.\nProject: ${world.title}\nRepository: ${repo?`${repo.owner}/${repo.repo}${repo.trunk?` (${repo.trunk})`:''}`:'Connect the intended repository before making code changes.'}\nChange: ${change.title}\nProblem: ${change.problem}\nExpected result: ${change.expected}\nAcceptance checks: ${change.checks}\nBoundaries: ${change.boundaries||'Preserve existing data, accounts, permissions and unrelated work.'}\n\nRun the checks, show the resulting diff, and return the implementation pull request and exact commit. Do not merge or deploy without separate review and approval. Never report an approval as execution or a successful deployment.\n\nApproved proposal: ${change.id}\nReviewed scope fingerprint: ${change.fingerprint}\nProject path: /world/${world.worldId}/room`;
}
