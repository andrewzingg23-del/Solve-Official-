"use server";
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { requireDisplayedActor, ACCOUNT_CHANGED } from '@/lib/product/account-guard';
import { createCreativeArtifact, loadCreativeWorld, updateCreativeArtifact } from '@/lib/world/creative';
import { stepFromArtifact } from '@/lib/world/progress';
import type { FormResult } from '@/app/product/recoverable-form';
const text = (form: FormData, key: string) => typeof form.get(key) === 'string' ? String(form.get(key)) : '';
export async function saveNextStep(worldId: string, form: FormData): Promise<FormResult> {
  if (!await getUser()) return {ok:false,error:'Sign in again. Your text is still here.'};
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel, text(form,'expectedActorId'));
    const {world,artifacts} = await loadCreativeWorld(kernel,worldId);
    const title = text(form,'step').trim();
    if (!title || title.length > 300 || /[\r\n]/.test(title)) return {ok:false,error:'Write one next step, up to 300 characters.'};
    const body = `- [${text(form,'done') === 'yes' ? 'x' : ' '}] ${title}`;
    const entityId = text(form,'entityId');
    const requestId = text(form,'requestId');
    if (entityId) {
      const existing = artifacts.find(a => a.entityId === entityId);
      if (!existing || !stepFromArtifact(existing)) return {ok:false,error:'That saved step could not be found. Reload the project.'};
      await updateCreativeArtifact(kernel,{scope:world.scope,entityId,requestId,expectedVersion:Number(text(form,'version')),title:'Next step',body,position:existing.position});
    } else await createCreativeArtifact(kernel,{scope:world.scope,worldEntityId:world.entityId,requestId,title:'Next step',body,position:{x:50,y:50}});
    revalidatePath('/'); revalidatePath(`/world/${worldId}`); revalidatePath(`/world/${worldId}/room`);
    return {ok:true};
  } catch(error) { return {ok:false,error:error instanceof Error && error.message === ACCOUNT_CHANGED ? ACCOUNT_CHANGED : 'The step could not be saved. Your text is still here. Reload if someone else edited it, or retry.'}; }
}

export async function saveStarterPlan(worldId: string, form: FormData): Promise<FormResult> {
  if (!await getUser()) return {ok:false,error:'Sign in again to save a plan.'};
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel,text(form,'expectedActorId'));
    const { createStarterPlan } = await import('@/lib/world/progress');
    await createStarterPlan(kernel,worldId);
    revalidatePath('/'); revalidatePath(`/world/${worldId}`); revalidatePath(`/world/${worldId}/room`);
    return {ok:true};
  } catch(error) { return {ok:false,error:error instanceof Error && error.message === ACCOUNT_CHANGED ? ACCOUNT_CHANGED : 'The starter plan could not be fully saved. Retry safely to finish saving it; existing steps will not be duplicated.'}; }
}
