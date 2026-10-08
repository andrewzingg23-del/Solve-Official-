import Link from "next/link";
import {getUser} from "@/lib/supabase/server";
import {getKernel} from "@/lib/kernel/server";
import {loadCreativeWorld} from "@/lib/world/creative";
import {readStudios,type SharedStudio} from "@/lib/world/studio";
import {assembleStudio} from "@/lib/studio/document";
import {StudioWorkspace} from "@/app/studio/workspace";
import {WorldLiveSync} from "../live-sync";
export default async function SharedStudioPage({params,searchParams}:PageProps<"/world/[worldId]/studio">){
 const{worldId}=await params,{studio:requested}=await searchParams,user=await getUser();
 if(!user)return <main className="mx-auto max-w-xl p-8 pb-32"><h1 className="text-3xl">This is a private World.</h1><p className="mt-4 text-muted">Shared studios use the World’s existing account permissions. You can create a private draft on this device now.</p><Link href="/" className="mt-6 inline-block text-accent">Open your personal studio →</Link></main>;
 let data:{title:string;studio:SharedStudio|null}|null=null;
 try{const kernel=await getKernel(),{world}=await loadCreativeWorld(kernel,worldId),studios=await readStudios(kernel,worldId);data={title:world.title,studio:studios.find(s=>s.id===requested)??studios[0]??null};}catch{}
 if(!data)return <main className="mx-auto max-w-xl p-8 pb-32"><h1 className="text-3xl">This studio is unavailable.</h1><p className="mt-4 text-muted">The World may be private, access may have ended, or its store may be unavailable.</p><Link href="/worlds" className="mt-6 inline-block text-accent">Your Worlds →</Link></main>;
 const initial=data.studio?.heads.at(-1)?.document??assembleStudio("blank","New creation","studio-"+worldId);
 return <><StudioWorkspace key={initial.id} initial={initial} shared={{worldId,title:data.title,studio:data.studio}}/><div className="sr-only"><WorldLiveSync worldId={worldId} authUserId={user.id}/></div></>;
}
