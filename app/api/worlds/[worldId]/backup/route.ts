import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { KernelError } from '@/lib/kernel/client';
import { exportProjectBackup } from '@/lib/world/backup';
import { privateJson } from '@/lib/world/http';
export const dynamic='force-dynamic';
export async function GET(request:Request,context:RouteContext<'/api/worlds/[worldId]/backup'>){
 if(!await getUser())return privateJson({error:'Open your workspace before downloading a backup.'},401);
 try{
  const backup=await exportProjectBackup(await getKernel(),(await context.params).worldId,new URL(request.url).searchParams.get('messages')==='yes');
  return new Response(JSON.stringify(backup,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="solve-project-backup.json"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return privateJson({error:error instanceof KernelError&&error.name==='invalid'?error.message:'This project backup could not be read. Check your access and retry.'},error instanceof KernelError&&error.name==='invalid'?422:403);}
}
