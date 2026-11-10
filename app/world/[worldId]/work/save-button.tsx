"use client";

import { useFormStatus } from "react-dom";

export function SaveWorkButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending} className="solve-button min-h-11 w-full disabled:cursor-wait disabled:opacity-60">
    {pending ? "Saving your work…" : "Save this work"}
  </button>;
}
