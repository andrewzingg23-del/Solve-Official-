'use server';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { ACCOUNT_CHANGED, sameDisplayedAccount } from '@/lib/product/account-guard';
import { KernelError } from '@/lib/kernel/client';
import { loadCreativeWorld } from '@/lib/world/creative';
import { approveDevelopmentChange, linkDevelopmentPull, listDevelopmentChanges, proposeDevelopmentChange, reviewDevelopmentChange } from '@/lib/world/development';
import { repoForWorld } from '@/lib/github/repo';
import { deploymentRooms } from '@/lib/github/rooms';
import { parseImplementationPull, readChangeEvidence } from '@/lib/github/change-evidence';

const text=(data:FormData,name:string)=>typeof data.get(name)==='string'?String(data.get(name)):'';
export async function developmentAction(worldId:string,data:FormData){
 const user=await getUser();
 if(!user||!sameDisplayedAccount(data.get('expectedUserId'),user.id))return {ok:false as const,error:ACCOUNT_CHANGED};
 try{
  const kernel=await getKernel();
  const actor=await kernel.whoami();
  if(data.get('expectedActorId')!==actor.actor_id)return {ok:false as const,error:ACCOUNT_CHANGED};
  const {world,resources}=await loadCreativeWorld(kernel,worldId);
  const selected=repoForWorld({worldId:world.worldId,viewerEmail:user.email,links:resources.filter(r=>r.status==='open'&&r.sourceUrl).map(r=>r.sourceUrl),rooms:deploymentRooms()});
  const intent=text(data,'intent');
  if(intent==='propose'){
   if(!selected)return {ok:false as const,error:'Link the repository below before proposing a code change.'};
   await proposeDevelopmentChange(kernel,worldId,{requestId:text(data,'requestId'),title:text(data,'title'),problem:text(data,'problem'),expected:text(data,'expected'),checks:text(data,'checks'),boundaries:text(data,'boundaries')},selected.ref);
  }else if(intent==='review'){
   if(data.get('reviewed')!=='yes')return {ok:false as const,error:'Review the scope, result and acceptance checks first.'};
   await reviewDevelopmentChange(kernel,worldId,text(data,'proposalId'),text(data,'requestId'),text(data,'notes'));
  }else if(intent==='approve'){
   if(data.get('approved')!=='yes')return {ok:false as const,error:'Confirm this handoff after reviewing the saved scope.'};
   await approveDevelopmentChange(kernel,worldId,text(data,'proposalId'),text(data,'reviewId'));
  }else if(intent==='link'){
   const change=(await listDevelopmentChanges(kernel,worldId)).find(c=>c.id===text(data,'proposalId'));
   if(!change?.repository||change.stage!=='approved')return {ok:false as const,error:'Approve a reviewed change with a repository first.'};
   const number=parseImplementationPull(text(data,'pullUrl'),change.repository);
   if(!number)return {ok:false as const,error:'Use a pull request from the repository approved in this proposal.'};
   // A token is used only if the existing deployment pairing still names this exact repository.
   const paired=selected?.paired&&selected.ref.owner.toLowerCase()===change.repository.owner.toLowerCase()&&selected.ref.repo.toLowerCase()===change.repository.repo.toLowerCase();
   if(!await readChangeEvidence(change.repository,number,{token:paired?process.env.GITHUB_TOKEN:null}))return {ok:false as const,error:'GitHub could not verify that pull request. Check repository access and retry.'};
   await linkDevelopmentPull(kernel,worldId,change.id,number);
  }else return {ok:false as const,error:'Choose a development action.'};
  revalidatePath(`/world/${worldId}/room`);
  return {ok:true as const};
 }catch(error){return {ok:false as const,error:error instanceof KernelError?error.message:'Development work could not be saved. Your text is still here; retry shortly.'};}
}
