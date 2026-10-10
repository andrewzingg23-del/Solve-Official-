"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
export type FormResult = { ok: true; href?: string } | { ok: false; error: string };

// Calling a Server Action from onSubmit avoids React clearing an uncontrolled
// form after a failed action. The text and request IDs remain until a saved result.
export function RecoverableForm({ action, children, className, ownerActorId, ownerUserId, successMessage = "Saved." }: {
  action: (data: FormData) => Promise<FormResult | void>; children: ReactNode; className?: string;
  ownerActorId?: string; ownerUserId?: string; successMessage?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const request = useRef<{ signature: string; ids: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  return <form ref={formRef} className={className} onSubmit={event => {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form, (event.nativeEvent as SubmitEvent).submitter);
    const names = ["requestId", "request_id", "nonce"].filter(name => data.has(name));
    const signature = JSON.stringify([...data.entries()].filter(([name]) => !names.includes(name)));
    if (request.current?.signature !== signature) request.current = { signature, ids: Object.fromEntries(names.map(name => [name, crypto.randomUUID()])) };
    for (const name of names) data.set(name, request.current.ids[name]);
    setError(null); setSuccess(null);
    startTransition(async () => {
      try {
        const result = await action(data);
        if (result && !result.ok) { setError(result.error); return; }
        form.reset();
        request.current = null;
        setSuccess(successMessage);
        if (result?.ok && result.href) router.push(result.href);
        else router.refresh();
      } catch { setError("The connection was interrupted. Your text is still here; keep this page open and retry."); }
    });
  }}>
    <fieldset disabled={busy} className="solve-recoverable-fields">
      {ownerActorId ? <input type="hidden" name="expectedActorId" value={ownerActorId} /> : null}
      {ownerUserId ? <input type="hidden" name="expectedUserId" value={ownerUserId} /> : null}
      {children}
    </fieldset>
    {error ? <p role="alert" className="solve-error">{error}</p> : success ? <p role="status" className="solve-success">{success}</p> : null}
    {busy ? <p role="status" className="solve-muted">Saving…</p> : null}
  </form>;
}
