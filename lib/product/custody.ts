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
 * What the person is told on Apps about who the things they connect there belong to.
 *
 * A guest identity lives in one browser. A real run (BUILD-STREAM.md, 2026-11-11) connected GitHub
 * in one browser while the Space belonged to the guest in another: the product behaved honestly but
 * never said why, so the person had no way to understand it. This is where it says why.
 */
export function connectionNotice(custody: Custody): string {
  switch (custody) {
    case "durable":
      return "Signed in. Apps and tools you connect here are reachable on every device you sign in on.";
    case "browser":
      return "You're a guest in this browser. Apps and tools you connect here belong to this browser alone — another browser is a different guest and won't see them, or your Spaces. Sign in first to keep them together.";
    case "device":
      return "Sign in to connect anything. Without an identity there is nothing here for an app to reach.";
  }
}
