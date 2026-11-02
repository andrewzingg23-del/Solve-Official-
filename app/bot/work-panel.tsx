import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { listCreativeWorlds } from "@/lib/world/creative";

export async function AiWork() {
  const user = await getUser();
  const projects = user ? await listCreativeWorlds(await getKernel()).catch(() => null) : [];
  const configured = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  return <div className="solve-ai-stack">
    <section className="solve-panel solve-ai-card">
      <h2>What would you like to move forward?</h2>
      <p>Open a project and ask the room AI to break down your goal, review a document or help with the next step. Your work stays with that project.</p>
      <div className="solve-ai-actions"><Link href="/" className="solve-button">Continue a project</Link><Link href="/worlds/new" className="solve-button solve-button-secondary">Start a project</Link></div>
      {projects === null ? <p role="status">Your projects could not be loaded. Open Projects to retry.</p> : projects.length ? <ul className="solve-ai-records">{projects.slice(0, 5).map(project => <li key={project.worldId} className="solve-ai-record"><Link href={`/world/${project.worldId}/room`} className="solve-text-link">{project.title}</Link><span>Open conversation →</span></li>)}</ul> : <p>Create a project with a clear goal, then turn your first conversation into a plan.</p>}
    </section>
    <section className="solve-panel solve-ai-card">
      <h2>Two ways to use AI here</h2>
      <p><strong>Built-in room AI:</strong> {configured ? "configured on this service; availability is confirmed when a request completes." : "not configured on this service yet."} It works from the project context you may access. An external connector is not required.</p>
      <p><strong>Your personal AI and external assistants:</strong> your saved character, personality and private knowledge can be used by an assistant you authorize separately. This does not run a background worker or automatically import chats.</p>
      <div className="solve-ai-actions"><Link href="/bot?section=knowledge" className="solve-text-link">Add private knowledge →</Link><Link href="/bot?section=connections" className="solve-text-link">Review connections and permissions →</Link><Link href="/bot?section=persona" className="solve-text-link">Customize appearance & personality →</Link></div>
    </section>
  </div>;
}
