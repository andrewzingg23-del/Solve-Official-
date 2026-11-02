"use client";
import { useState, useTransition } from "react";
import { checkConnectionsAction } from "./actions";
export function ConnectionCheck({ ownerId }: { ownerId: string }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return <div><button type="button" className="solve-button solve-button-secondary" disabled={pending} onClick={() => {
    setResult(null);
    startTransition(async () => { try { setResult(await checkConnectionsAction(ownerId)); } catch { setResult({ ok: false, message: "The check was interrupted. Retry; no permissions were changed." }); } });
  }}>{pending ? "Checking…" : "Check saved authorizations"}</button>{result ? <p role={result.ok ? "status" : "alert"}>{result.message}</p> : null}</div>;
}
