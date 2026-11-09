import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadCreativeWorld } from "@/lib/world/creative";
import { readWorldMembers } from "@/lib/world/collaboration";
import { ThingInspector } from "@/app/product/thing-inspector";
import { fieldsFromType, proofOf, actsFrom, accessFrom } from "@/lib/product/thing";

export const metadata: Metadata = { title: "Record · SOLVE" };

// The guaranteed record of one thing. Readable by anyone the kernel lets read it, including a
// visitor holding an anonymous identity: they own what they recorded, so they can inspect it.
// Editing is what needs an account that outlives the browser, not reading.
export default async function WorldRecordPage({ params }: PageProps<"/world/[worldId]/record">) {
  const { worldId } = await params;
  const user = await getUser();
  if (!user) redirect("/login?next=" + encodeURIComponent("/world/" + worldId + "/record"));

  const kernel = await getKernel();
  let data: Awaited<ReturnType<typeof loadCreativeWorld>>;
  try {
    data = await loadCreativeWorld(kernel, worldId);
  } catch (error) {
    if (error instanceof KernelError && (error.name === "forbidden" || error.name === "not_found" || error.name === "invalid")) notFound();
    return <main className="solve-page">
      <h1>This record is temporarily unavailable.</h1>
      <p>Nothing was deleted. Reopen it when the connection is restored.</p>
      <Link href="/">Return to SOLVE</Link>
    </main>;
  }

  const { world } = data;
  const scope = world.scope;

  // Each read is allowed to fail on its own. A part we could not read says so; it never renders
  // as an empty part, which would read as "nothing here".
  const [events, confirmations, membership, me] = await Promise.all([
    kernel.readEvents(scope, { limit: 50, newestFirst: true }).catch(() => null),
    kernel.readConfirmations(world.entityId).catch(() => null),
    readWorldMembers(kernel, scope).catch(() => null),
    kernel.whoami().catch(() => null),
  ]);
  const collaborators = membership?.members ?? null;

  // Evidence hangs off events, so it is gathered for the most recent handful rather than all.
  const evidence = events
    ? (await Promise.all(events.slice(0, 10).map(event => kernel.readEvidence(event.id).catch(() => []))))
      .flat()
    : [];

  const actorIds = Array.from(new Set([
    ...(events ?? []).map(event => event.actor_id),
    ...(events ?? []).map(event => event.on_behalf_of).filter((id): id is string => Boolean(id)),
    ...(collaborators ?? []).map(entry => entry.actorId),
    ...(membership?.ownerActorId ? [membership.ownerActorId] : []),
  ]));
  const actors = actorIds.length ? await kernel.readActors(actorIds).catch(() => []) : [];
  const labels = Object.fromEntries(actors.map(actor => [actor.actor_id, actor.label]));

  const granteeOf: Record<string, string> = {};
  const grants: Array<{ id: string; capability: string; scope: string; issued_by: string }> = [];
  for (const collaborator of collaborators ?? []) {
    for (const grant of collaborator.grants) {
      granteeOf[grant.id] = collaborator.actorId;
      grants.push({ id: grant.id, capability: grant.capability, scope, issued_by: "" });
    }
  }

  // A World records its goal as its summary; there is no declared type for it yet, so its own
  // attributes are shown rather than invented fields.
  const fields = fieldsFromType(null, world.summary ? { goal: world.summary } : {});

  // Who holds it is read, not inferred. If it is the viewer, say so plainly.
  const ownerActorId = membership?.ownerActorId;
  const ownerName = ownerActorId ? labels[ownerActorId] ?? "Someone" : "Not recorded";
  const ownerLabel = ownerActorId && me?.actor_id === ownerActorId ? `${ownerName} (you)` : ownerName;

  // Only an action that exists. Asking for confirmation has a kernel behind it but no surface
  // yet, so nothing here offers it.
  const durable = Boolean(user && !user.is_anonymous);
  const next = durable
    ? { label: "Open the workbench", href: `/world/${encodeURIComponent(world.worldId)}/workbench` }
    : null;

  return <ThingInspector
    title={world.title}
    /* No type has been declared for this yet, and "World" is our word for a scope, not
       the person's word for their thing. Absence is shown instead of invented. */
    typeName={null}
    fields={fields}
    scope={scope}
    ownerLabel={ownerLabel}
    acts={actsFrom(events ?? [], labels)}
    proof={proofOf(evidence, confirmations ?? [])}
    next={next}
    access={accessFrom(grants, labels, granteeOf)}
  />;
}
