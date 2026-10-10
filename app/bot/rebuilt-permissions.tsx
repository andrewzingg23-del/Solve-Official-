import { randomUUID } from "node:crypto";
import Link from "next/link";
import { ACCESS_DAYS, type WorldAccess, type WorldWithAccess } from "@/lib/bot/worlds";
import { setWorldAccessAction } from "./actions";
import { CopyField } from "./copy-field";

const LEVELS: Array<{ value: WorldAccess; label: string }> = [
  { value: "none", label: "No access" },
  { value: "read", label: "Read" },
  { value: "add", label: "Read and add" },
];

export type ProjectAccessWorld = WorldWithAccess & { canManage: boolean };

export function ProjectAccess({ botName, botAgentId, worlds }: { botName: string; botAgentId: string; worlds: ProjectAccessWorld[] }) {
  return (
    <section className="solve-panel solve-ai-card" aria-labelledby="ai-project-access">
      <h2 id="ai-project-access">Project access</h2>
      <p>Choose what {botName} may read or add to each project. A connection needs both the mode you approved and the project permission shown here. Grants last {ACCESS_DAYS} days; you can revoke them at any time.</p>
      {worlds.length ? (
        <ul className="solve-ai-records">
          {worlds.map((world) => (
            <li key={world.worldId} className="solve-ai-record solve-ai-project-access">
              <div><Link href={`/world/${world.worldId}`} className="solve-text-link">{world.title}</Link><p className="solve-ai-record-meta">{world.access === "add" ? "Reads and adds" : world.access === "read" ? "Read only" : "No access"}</p></div>
              {world.canManage ? <form action={setWorldAccessAction} aria-label={`${botName} permissions in ${world.title}`}>
                <input type="hidden" name="world_id" value={world.worldId} />
                <input type="hidden" name="request_id" value={randomUUID()} />
                <div role="group" aria-label="Project permission" className="solve-ai-access-levels">
                  {LEVELS.map((level) => (
                    <button type="submit" key={level.value} name="access" value={level.value} aria-pressed={world.access === level.value}>{level.label}</button>
                  ))}
                </div>
              </form> : <p className="solve-ai-record-meta">The project owner manages this access.</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="solve-ai-small-empty"><p>No projects are available in your account yet.</p><Link href="/worlds/new" className="solve-text-link">Start a project</Link></div>
      )}
      <details className="solve-ai-setup">
        <summary>Invite your AI to someone else’s project</summary>
        <p>Give the project owner this AI actor ID. They decide whether to grant read or add access from their project.</p>
        <CopyField value={botAgentId} name="Your AI actor ID" />
      </details>
    </section>
  );
}
