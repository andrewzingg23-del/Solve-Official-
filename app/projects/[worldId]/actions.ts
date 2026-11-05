"use server";
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { sameDisplayedAccount, ACCOUNT_CHANGED } from '@/lib/product/account-guard';
import { handleRoomArtifact } from '@/lib/world/http';
import { loadCreativeWorld } from '@/lib/world/creative';

export async function saveProjectDocument(worldId:string,expectedUserId:string,input:unknown){
 const user=await getUser();
 if(!sameDisplayedAccount(expectedUserId,user?.id))return{ok:false as const,status:409,error:ACCOUNT_CHANGED};
 try{
  const kernel=await getKernel();
  const patch=Boolean(input&&typeof input==='object'&&'entityId' in input);
  const response=await handleRoomArtifact(kernel,worldId,new Request('https://sov.internal/document',{method:patch?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}));
  const result=await response.json();
  if(!response.ok)return{ok:false as const,status:response.status,error:String(result.error||'Could not save. Your draft is still here.')};
  const {artifacts}=await loadCreativeWorld(kernel,worldId);
  const artifact=artifacts.find(a=>a.entityId===result.entityId);
  if(!artifact)return{ok:false as const,status:503,error:'Save could not be confirmed. Keep this draft and retry.'};
  const intended=input as {title:string;body:string};
  if(artifact.title!==intended.title.trim()||artifact.body!==intended.body)return{ok:false as const,status:409,error:'Your save was recorded, but a newer revision is now present. Your draft is still here. Export it before reopening the latest document.'};
  revalidatePath(`/projects/${worldId}`);revalidatePath('/projects');revalidatePath('/');
  return{ok:true as const,artifact};
 }catch{return{ok:false as const,status:503,error:'The store is unavailable. Your draft is still here; retry.'};}
}
