import {getUser} from "@/lib/supabase/server";
import {getKernel} from "@/lib/kernel/server";
import {listCreativeWorlds} from "@/lib/world/creative";
import {assembleStudio} from "@/lib/studio/document";
import {StudioWorkspace} from "./studio/workspace";
export default async function Home(){const user=await getUser();const worlds=user?await listCreativeWorlds(await getKernel()).catch(()=>[]):[];return <StudioWorkspace initial={assembleStudio("architecture","A place to create","personal-studio")} worlds={worlds.map(w=>({worldId:w.worldId,title:w.title}))}/>;}
