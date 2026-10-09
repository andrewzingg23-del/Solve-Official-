"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";

export type InvitationState = { path?: string; invitationId?: string; expiresAt?: string; error?: string };
export type InvitationListItem = { invitation_id: string; role: "editor" | "viewer"; expires_at: string; accepted_by: string | null; cancelled_at: string | null };
const subscribeOrigin = () => () => {};

export function InvitationPanel({ create, cancel, invitations, now }: {
  create: (previous: InvitationState, data: FormData) => Promise<InvitationState>;
  cancel: (invitationId: string) => Promise<{ error?: string }>;
  invitations: InvitationListItem[];
  now: string;
}) {
  const [state, action, pending] = useActionState(create, {});
  const [notice, setNotice] = useState("");
  const [cancelling, startTransition] = useTransition();
  const [cancelled, setCancelled] = useState<string[]>([]);
  const origin = useSyncExternalStore(subscribeOrigin, () => window.location.origin, () => "");
  const link = state.path && origin ? new URL(state.path, origin).href : state.path;
  const router = useRouter();
  const active = invitations.filter(i => !i.accepted_by && !i.cancelled_at && !cancelled.includes(i.invitation_id) && new Date(i.expires_at).getTime() > new Date(now).getTime());
  async function copy() {
    if (!state.path) return;
    try { await navigator.clipboard.writeText(new URL(state.path, window.location.origin).href); setNotice("Invite link copied."); }
    catch { setNotice("Copy the link from the field below."); }
  }
  function remove(id: string) {
    startTransition(async () => {
      const result = await cancel(id);
      if (!result.error) setCancelled(current => [...current, id]);
      setNotice(result.error || "Invitation cancelled."); router.refresh();
    });
  }
  return (
    <div className="flex flex-col gap-3 rounded border border-line p-3">
      <h3 className="text-sm font-medium">Invite with a link</h3>
      <p className="text-xs leading-5 text-muted">Send the link to one person. They sign in and accept; the link expires in 48 hours. Anyone holding an unused link can accept its role.</p>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">Invitation role<select name="role" defaultValue="viewer" className="h-10 rounded border border-line bg-background px-3 text-sm text-foreground"><option value="viewer">Can view</option><option value="editor">Can edit</option></select></label>
        <button disabled={pending} className="h-10 rounded border border-accent/50 px-3 text-sm text-accent disabled:opacity-50">{pending ? "Creating…" : "Create invite link"}</button>
      </form>
      {state.path && !cancelled.includes(state.invitationId!) ? <div className="flex flex-col gap-2">
        <label className="text-xs text-muted">Invite link<input aria-label="Invite link" readOnly value={link} className="mt-1 w-full rounded border border-line bg-background p-2 font-mono text-xs text-foreground" onFocus={e => e.currentTarget.select()} /></label>
        <div className="flex flex-wrap gap-3 text-xs"><button type="button" onClick={copy} className="text-accent underline">Copy invite link</button><button type="button" disabled={cancelling} onClick={() => remove(state.invitationId!)} className="text-muted underline">Cancel this link</button></div>
        <p className="text-[11px] text-muted">Expires {new Date(state.expiresAt!).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })}. This is the only time the full link is shown.</p>
      </div> : null}
      {active.length ? <details><summary className="cursor-pointer text-xs text-muted">Other active links · {active.length}</summary><ul className="mt-2 space-y-2">{active.filter(i => i.invitation_id !== state.invitationId).map(i => <li key={i.invitation_id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>{i.role === "editor" ? "Can edit" : "Can view"} · expires {new Date(i.expires_at).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })}</span><button type="button" disabled={cancelling} onClick={() => remove(i.invitation_id)} className="text-accent underline">Cancel invite</button></li>)}</ul></details> : null}
      {state.error || notice ? <p role="status" className="text-xs text-muted">{state.error || notice}</p> : null}
    </div>
  );
}
