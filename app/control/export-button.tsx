"use client";

import { useState, useTransition } from "react";
import { exportEverything } from "./export-action";

export function ExportButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return <div className="s-stack" style={{ "--gap": "10px" } as React.CSSProperties}>
    <div><button type="button" className="s-button" disabled={pending} onClick={() => start(async () => {
      setMessage(null);
      const result = await exportEverything();
      if (!result.ok) { setMessage({ ok: false, text: result.error }); return; }
      const url = URL.createObjectURL(new Blob([result.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = result.filename; a.click();
      URL.revokeObjectURL(url);
      setMessage({ ok: true, text: `Downloaded ${result.filename}.` });
    })}>{pending ? "Preparing…" : "Download everything"}</button></div>
    {message ? <p role={message.ok ? "status" : "alert"} className={message.ok ? "s-ok" : "s-error"}>{message.text}</p> : null}
  </div>;
}
