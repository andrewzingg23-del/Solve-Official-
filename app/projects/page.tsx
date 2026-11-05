import Link from 'next/link';
import { getUser } from '@/lib/supabase/server';
import { getKernel } from '@/lib/kernel/server';
import { listCreativeWorlds } from '@/lib/world/creative';
import { Projects } from '@/app/product/projects';
export default async function ProjectsPage(){
 const user=await getUser(); const projects=user?await listCreativeWorlds(await getKernel()).catch(()=>null):[];
 return <main className="solve-page"><header className="solve-page-heading sov-page-heading"><div><span className="sov-eyebrow">IDEAS INTO SOMETHING REAL</span><h1>Projects</h1><p>A place for the work you want to keep building.</p></div><Link href="/projects/new" className="solve-button">+ Create Project</Link></header>{projects===null?<div className="solve-empty"><h2>Projects are temporarily unavailable.</h2><p>Your work has not changed. Refresh and try again.</p></div>:<Projects projects={projects}/>}</main>;
}
