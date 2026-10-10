import { randomUUID } from "node:crypto";
import Link from "next/link";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { label, secondaryAction } from "@/app/ui";
import { readWorldMembers, listWorldCollaborators } from "@/lib/world/collaboration";
import { grantWorldAccessAction, revokeWorldAccessAction } from "./access-actions";
import { createInvitationAction, cancelInvitationAction } from "./invitation-actions";
import { InvitationPanel } from "./invitation-panel";

export async function WorldAccessPanel({ worldId, scope, saved, error }: {
  worldId: string;
  scope: string;
  saved: boolean;
  error?: string;
}) {
  let collaborators;
  try {
    collaborators = await listWorldCollaborators(await getKernel(), scope);
  } catch (caught) {
    if (caught instanceof KernelError && caught.name === "forbidden") {
      const kernel = await getKernel();
      const roster = await readWorldMembers(kernel, scope);
      const profiles = await kernel.readActors([roster.ownerActorId, ...roster.members.map(person => person.actorId)]);
      return <section aria-labelledby="people-heading" className="solve-panel">
        <h2 id="people-heading">People in this project</h2>
        <p className="mt-3">The owner manages invitations and access. Everyone listed here has access to shared work.</p>
        <ul className="mt-4 divide-y divide-line">{profiles.map(person => <li key={person.actor_id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{person.label || "Project member"}</span><span className="text-xs text-muted">{person.actor_id === roster.ownerActorId ? "Owner" : person.kind === "agent" ? "AI" : roster.members.find(member => member.actorId === person.actor_id)?.role === "editor" ? "Can edit" : "Can view"}</span></li>)}</ul>
      </section>;
    }
    throw caught;
  }

  const grant = grantWorldAccessAction.bind(null, worldId);
  const revoke = revokeWorldAccessAction.bind(null, worldId);
  const invitations = await (await getKernel()).readWorldInvitations(worldId);
  const accessError = ["access", "access-input", "access-missing", "access-conflict", "access-save"].includes(error ?? "")
    ? error
    : undefined;

  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-4 rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={label}>Project access</p>
          <h2 id="people-heading" className="mt-1 text-lg font-medium">People who can contribute</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Invite someone with a link or their Solve ID. Choose what they can do in this project.</p>
        </div>
        <Link href="/account" className="text-xs text-accent underline underline-offset-4">Open my Profile</Link>
      </div>

      {saved && <p role="status" className="rounded border border-positive/25 bg-positive/5 px-3 py-2 text-sm text-positive">Project access updated.</p>}
      {accessError && (
        <p role="alert" className="rounded border border-negative/30 bg-negative/10 px-3 py-2 text-sm text-negative">
          {accessError === "access-input" ? "Enter another registered person’s Solve ID and choose a role." :
            accessError === "access-missing" ? "That Solve ID or active access could not be found. Ask them to sign in and register first." :
              accessError === "access-conflict" ? "That person already has a different role. Remove their current access before granting another role." :
                accessError === "access" ? "Only the project owner can manage access." :
                  "The access change could not be saved. Keep this page open and try again."}
        </p>
      )}

      <InvitationPanel create={createInvitationAction.bind(null, worldId)} cancel={cancelInvitationAction.bind(null, worldId)} invitations={invitations} now={new Date().toISOString()} />

      <form action={grant} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input type="hidden" name="requestId" value={randomUUID()} />
        <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted">
          Collaborator Solve ID
          <input name="actorId" required maxLength={36} autoComplete="off" placeholder="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" className="h-10 rounded border border-line bg-background px-3 font-mono text-xs text-foreground outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Role
          <select name="role" defaultValue="editor" className="h-10 min-w-32 rounded border border-line bg-background px-3 text-xs text-foreground">
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
        </label>
        <button type="submit" className={secondaryAction + " self-end"}>Grant access</button>
      </form>

      {collaborators.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line rounded border border-line">
          {collaborators.map((person) => (
            <li key={person.actorId} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <p className="break-all font-mono text-xs">{person.actorId}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{person.role === "editor" ? "Can edit" : "Can view"}</p>
              </div>
              <form action={revoke}>
                <input type="hidden" name="actorId" value={person.actorId} />
                <input type="hidden" name="requestId" value={randomUUID()} />
                <button type="submit" className="rounded border border-negative/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-negative">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded border border-dashed border-line p-4 text-sm text-muted">Only you have access right now.</p>
      )}

      <p className="text-[11px] leading-5 text-muted">Editors can create and revise items inside this project. Other authorized people see saved changes automatically; revisions and authorship stay in project history.</p>
    </section>
  );
}

