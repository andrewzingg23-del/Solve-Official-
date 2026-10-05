"use client";

// Share one of your saves: makes a receipt link anyone can open (see lib/bot/receipt.ts).
import { useActionState } from "react";
import { shareSaveAction, type ShareResult } from "./actions";
import { CopyField } from "./copy-field";

export function ShareSave({ worldId, recordId }: { worldId: string; recordId: string }) {
  const [state, action, pending] = useActionState<ShareResult, FormData>(shareSaveAction, null);
  if (state && "url" in state) return <CopyField value={state.url} name="Receipt link" />;
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 pl-[18px]">
      <input type="hidden" name="world_id" value={worldId} />
      <input type="hidden" name="record_id" value={recordId} />
      <button type="submit" disabled={pending} className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted transition-colors duration-300 ease-calm hover:text-accent disabled:opacity-50">
        {pending ? "Making the link" : "Share"}
      </button>
      {state && "error" in state ? <span role="alert" className="text-xs text-muted">{state.error}</span> : null}
    </form>
  );
}
