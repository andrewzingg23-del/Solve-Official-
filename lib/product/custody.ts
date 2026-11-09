// Who is holding a person's work, and how to say so without overstating it.
//
// There are exactly three situations, and conflating any two of them is a lie:
//
//   "device"  — there is no identity at all (Supabase unconfigured, or no session). Only the
//               browser's own storage is holding their words. Nothing is recorded.
//   "browser" — they have a kernel identity, but an anonymous one. The thing is genuinely theirs,
//               with a scope and a history, and it is reachable only from this browser.
//   "durable" — a signed-in account. Theirs, and reachable from anywhere they sign in.
//
// Signing in does not create ownership; a visitor already owns what they record. It buys reach.

export type Custody = "device" | "browser" | "durable";

export function custodyOf(owner: string | null, durable: boolean): Custody {
  if (durable) return "durable";
  return owner ? "browser" : "device";
}

/** What the person is told about where their work lives. Never claims more than is true. */
export function custodyNotice(custody: Custody): string {
  switch (custody) {
    case "durable":
      return "Private until you choose to share.";
    case "browser":
      return "Yours and private. Sign in to reach it from another browser.";
    case "device":
      return "Your words stay on this device until you sign in.";
  }
}

/**
 * Where "open this thing" goes. The workbench needs an account that outlives the browser, so a
 * person without one is sent to sign in *for that thing* rather than bounced by a guard.
 */
export function openWorldHref(worldId: string, durable: boolean): string {
  const workbench = `/world/${encodeURIComponent(worldId)}/workbench`;
  return durable ? workbench : `/login?next=${encodeURIComponent(workbench)}`;
}

export function openWorldLabel(durable: boolean): string {
  return durable ? "Private workspace" : "Sign in to open";
}
