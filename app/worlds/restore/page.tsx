import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { RestoreBackup } from './restore';
export default async function RestorePage(){
 const user=await getUser();
 const actor=user?await (await getKernel()).whoami().catch(()=>null):null;
 return <main className="solve-page"><Link href="/worlds">← Projects</Link><h1>Restore a project backup</h1><p>Preview a SOLVE backup, then save its text into a new private project. The original project stays as it is. Account access, people, connected services and permissions are never imported.</p>{user&&actor?<RestoreBackup userId={user.id} actorId={actor.actor_id}/>:<p>Open your <Link href="/account">workspace profile</Link> first, then return here.</p>}</main>;
}
