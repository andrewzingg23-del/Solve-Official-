"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { becomeGuest } from "@/lib/supabase/become-guest";

// Shown in place of a page when this browser has no identity yet: it makes one here and carries on.
// No sign-in screen. If it can't, the person can try again; nothing they did is lost.
export function GuestGate() {
  const router = useRouter();
  const [state, setState] = useState<"working" | "failed">("working");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    becomeGuest().then(ok => {
      if (!live) return;
      if (ok) router.refresh(); else setState("failed");
    });
    return () => { live = false; };
  }, [attempt, router]);
  return <div className="s-stack" data-guest-gate>
    {state === "working"
      ? <p role="status" className="s-muted">Opening…</p>
      : <>
          <p role="alert">SOLVE couldn&apos;t get this ready just now.</p>
          <div><button type="button" className="s-button" onClick={() => { setState("working"); setAttempt(n => n + 1); }}>Try again</button></div>
        </>}
  </div>;
}
