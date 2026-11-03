'use server';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { requireDisplayedActor, ACCOUNT_CHANGED } from '@/lib/product/account-guard';
import { disconnectProvider, saveProvider } from '@/lib/ai/provider';
import type { FormResult } from '@/app/product/recoverable-form';

export async function connectProvider(form: FormData): Promise<FormResult> {
  const user = await getUser();
  if (!user || user.is_anonymous) return {ok:false,error:'Sign in with email before saving a provider key.'};
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel,String(form.get('expectedActorId')??''));
    const apiKey = String(form.get('apiKey')??'').trim(), model=String(form.get('model')??'').trim();
    if (apiKey.length<20 || apiKey.length>512 || /\s/.test(apiKey) || !/^[a-zA-Z0-9_./:-]{1,160}$/.test(model)) return {ok:false,error:'Enter your OpenRouter key and the exact model ID.'};
    // Credential/model metadata checks only: no inference is purchased by this action.
    const [keyResponse,modelsResponse] = await Promise.all([
      fetch('https://openrouter.ai/api/v1/auth/key',{headers:{Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(10000),cache:'no-store',redirect:'error'}),
      fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(10000),cache:'no-store',redirect:'error'}),
    ]);
    if (!keyResponse.ok) return {ok:false,error:'OpenRouter could not verify that key. Check it and try again.'};
    if (!modelsResponse.ok) return {ok:false,error:'The model list is unavailable. Nothing was saved; try again.'};
    const models = await modelsResponse.json() as {data?:{id:string}[]};
    if (!models.data?.some(m=>m.id===model)) return {ok:false,error:'That model ID is not in OpenRouter’s current model list.'};
    await saveProvider(kernel,{apiKey,model});
    revalidatePath('/connect'); revalidatePath('/');
    return {ok:true};
  } catch(error) { return {ok:false,error:error instanceof Error && error.message===ACCOUNT_CHANGED ? ACCOUNT_CHANGED : 'Could not save the connection securely. Your key was not returned to the page. Try again.'}; }
}
export async function removeProvider(form: FormData): Promise<FormResult> {
  if (!await getUser()) return {ok:false,error:'Sign in again.'};
  try {
    const kernel = await getKernel();
    await requireDisplayedActor(kernel,String(form.get('expectedActorId')??''));
    await disconnectProvider(kernel); revalidatePath('/connect'); revalidatePath('/');
    return {ok:true};
  } catch { return {ok:false,error:'Disconnection could not be confirmed. Retry before leaving.'}; }
}
