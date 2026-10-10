"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RetryAi() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className="solve-button solve-button-secondary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? "Retrying…" : "Retry"}</button>;
}
