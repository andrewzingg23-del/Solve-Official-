'use server';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { KernelError } from '@/lib/kernel/client';
import { ACCOUNT_CHANGED, sameDisplayedAccount } from '@/lib/product/account-guard';
import { parseProjectBackup, restoreProjectBackup } from '@/lib/world/backup';
export async function restoreBackupAction(data:FormData){
 const user=await getUser();
 if(!user||!sameDisplayedAccount(data.get('expectedUserId'),user.id))return {ok:false as const,error:ACCOUNT_CHANGED};
 try{
  if(data.get('reviewed')!=='yes')return {ok:false as const,error:'Review the preview before restoring a copy.'};
  const backup=parseProjectBackup(String(data.get('backup')??''));
  const world=await restoreProjectBackup(await getKernel(),{backup,requestId:String(data.get('requestId')??''),expectedActorId:String(data.get('expectedActorId')??'')});
  return {ok:true as const,href:`/world/${world.worldId}/room`};
 }catch(error){return {ok:false as const,error:error instanceof KernelError?error.message:'The restore was interrupted. Keep this page open and retry to continue the same copy.'};}
}
