"use server";
import {revalidatePath} from "next/cache";
import {getUser} from "@/lib/supabase/server";
import {getKernel} from "@/lib/kernel/server";
import {createCreativeWorld} from "@/lib/world/creative";
import {saveStudioRevision} from "@/lib/world/studio";
import {validateStudio,type StudioDocument} from "@/lib/studio/document";
import {KernelError} from "@/lib/kernel/client";
export async function saveSharedStudioAction(worldId:string,input:{document:StudioDocument;parents:string[];requestId:string}):Promise<{ok:true;id:string}|{ok:false;error:string}>{
 if(!(await getUser()))return {ok:false,error:"This account is not authorized to save shared work. Your on-device draft is still available."};
 try{const id=await saveStudioRevision(await getKernel(),{worldId,...input});revalidatePath("/world/"+worldId+"/studio");revalidatePath("/world/"+worldId);return {ok:true,id};}
 catch(e){return {ok:false,error:e instanceof KernelError&&e.name==="forbidden"?"World access is read only or has been revoked.":e instanceof Error?e.message:"The revision could not be saved."};}
}
export async function publishStudioAction(input:{document:StudioDocument;worldId:string|null;requestId:string}):Promise<{ok:true;worldId:string}|{ok:false;error:string}>{
 if(!(await getUser()))return {ok:false,error:"Cloud sharing requires an existing authorized account. Keep or export the private draft on this device."};
 try{const document=validateStudio(input.document),kernel=await getKernel();
 const worldId=input.worldId??crypto.randomUUID();
 if(!input.worldId)await createCreativeWorld(kernel,{worldId,title:document.title,goal:document.brief});
 await saveStudioRevision(kernel,{worldId,document,parents:[],requestId:input.requestId});
 revalidatePath("/worlds");return {ok:true,worldId};
 }catch(e){return {ok:false,error:e instanceof KernelError&&e.name==="conflict"?"That World already has this studio. Open its studio to continue the existing history.":e instanceof KernelError&&e.name==="forbidden"?"You do not have permission to save work in that World.":"The World could not be saved. Your private draft is still available."};}
}
